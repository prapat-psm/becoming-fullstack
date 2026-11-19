import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Body, Catch, Controller, Delete, Get, HttpCode, HttpException, Inject, Module, Post, Req, Res, ServiceUnavailableException, UnsupportedMediaTypeException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { resolve } from 'node:path';
import { Auth } from './auth.js';
import { Database } from './db.js';
import { BookingsController, databaseCode, RoomsController } from './rooms.js';
import { requiredText } from './validation.js';

@Controller('session')
class SessionController {
  constructor(@Inject(Auth) private readonly auth: Auth) {}

  @Get()
  async current(@Req() req: Request) {
    return { user: await this.auth.current(req) };
  }

  @Post()
  @HttpCode(200)
  async signIn(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body?: Record<string, unknown>) {
    if (!req.is('application/json')) throw new UnsupportedMediaTypeException('Send an application/json body.');
    const email = requiredText(body?.email, 'Email', 254).toLowerCase();
    const password = body?.password;
    if (typeof password !== 'string' || !password.length || password.length > 256) {
      return { user: await this.auth.signIn(req, res, email, '') };
    }
    return { user: await this.auth.signIn(req, res, email, password) };
  }

  @Delete()
  @HttpCode(204)
  signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.signOut(req, res);
  }
}

@Controller('health')
class HealthController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    try {
      await this.db.pool.query('SELECT name FROM rooms LIMIT 1');
      return { status: 'ok' };
    } catch (error) {
      console.error(JSON.stringify({ event: 'database_unavailable', requestId: res.getHeader('X-Request-Id'), code: databaseCode(error) }));
      throw new ServiceUnavailableException('Database check failed.');
    }
  }
}

@Module({ controllers: [HealthController, SessionController, RoomsController, BookingsController], providers: [Database, Auth] })
class AppModule {}

@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    const requestId = res.getHeader('X-Request-Id');
    let message = 'The request could not be completed.';
    if (error instanceof HttpException && status < 500) message = error.message;
    if (status >= 500) {
      console.error(JSON.stringify({ event: 'request_failed', requestId, status, code: databaseCode(error) }));
    }
    res.status(status).json({ statusCode: status, message, requestId });
  }
}

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ApiErrors());
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = performance.now();
    const requestId = randomUUID();
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      res.on('finish', () => {
        console.log(JSON.stringify({ event: 'http_request', requestId, method: req.method,
          route: req.route?.path, status: res.statusCode, durationMs: Math.round(performance.now() - startedAt) }));
      });
    }
    next();
  });
  app.useStaticAssets(resolve('dist/web'));
  return app;
}
