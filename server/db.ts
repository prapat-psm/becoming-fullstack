import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import pg from 'pg';

@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool: pg.Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Set DATABASE_URL before starting Roombook.');
    this.pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 2000, statement_timeout: 5000 });
    this.pool.on('error', (error: Error) => {
      console.error(JSON.stringify({ event: 'idle_database_error', code: (error as NodeJS.ErrnoException).code }));
    });
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
