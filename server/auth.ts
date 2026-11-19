import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { parse, serialize } from 'cookie';
import type { Request, Response } from 'express';
import { Database } from './db.js';

export type User = { id: number; email: string; role: 'member' | 'admin' };
const deriveKey = promisify(scrypt);
const sessionName = 'roombook_session';
const sessionLengthSeconds = 8 * 60 * 60;
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');

function sessionToken(req: Request) {
  const token = parse(req.headers.cookie ?? '')[sessionName];
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

function setSession(res: Response, token: string, maxAge: number) {
  res.setHeader('Set-Cookie', serialize(sessionName, token, {
    httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/', maxAge,
  }));
}

@Injectable()
export class Auth {
  constructor(@Inject(Database) private readonly db: Database) {}

  async current(req: Request): Promise<User | null> {
    const token = sessionToken(req);
    if (!token) return null;
    const { rows } = await this.db.pool.query<User>(`SELECT u.id, u.email, u.role
      FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`, [tokenHash(token)]);
    return rows[0] ?? null;
  }

  async require(req: Request, role?: User['role']) {
    const user = await this.current(req);
    if (!user) throw new UnauthorizedException('Sign in to continue.');
    if (role && user.role !== role) throw new ForbiddenException('This action requires an administrator.');
    return user;
  }

  async signIn(req: Request, res: Response, email: string, password: string): Promise<User> {
    const { rows } = await this.db.pool.query<User & { password_hash: string }>(
      'SELECT id, email, role, password_hash FROM users WHERE email = $1', [email],
    );
    const account = rows[0];
    const [salt, hash] = account?.password_hash.split(':') ?? ['0'.repeat(32), '0'.repeat(128)];
    const actual = await deriveKey(password, salt, 64) as Buffer;
    const valid = timingSafeEqual(actual, Buffer.from(hash, 'hex'));
    if (!account || !valid) throw new UnauthorizedException('Email or password is incorrect.');

    const token = randomBytes(32).toString('hex');
    const previous = sessionToken(req);
    await this.db.pool.query(`WITH cleanup AS (
      DELETE FROM sessions WHERE expires_at <= now() OR token_hash = $4
    ) INSERT INTO sessions (token_hash, user_id, expires_at)
      VALUES ($1, $2, now() + $3 * interval '1 second')`,
    [tokenHash(token), account.id, sessionLengthSeconds, previous ? tokenHash(previous) : null]);
    setSession(res, token, sessionLengthSeconds);
    return { id: account.id, email: account.email, role: account.role };
  }

  async signOut(req: Request, res: Response) {
    const token = sessionToken(req);
    if (token) await this.db.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash(token)]);
    setSession(res, '', 0);
  }
}
