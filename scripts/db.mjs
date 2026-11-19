import { createHash, randomBytes, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import pg from 'pg';

if (existsSync('.env')) process.loadEnvFile();

export function connect(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('Set DATABASE_URL before running this command.');
  return new pg.Pool({ connectionString, connectionTimeoutMillis: 3000 });
}

export async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock across deploys so two app instances cannot apply migrations simultaneously.
    await client.query('SELECT pg_advisory_xact_lock(81347631)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL
    )`);
    const { rows } = await client.query('SELECT name, checksum FROM schema_migrations');
    const applied = new Map(rows.map(({ name, checksum }) => [name, checksum]));
    const directory = new URL('../db/migrations/', import.meta.url);
    const files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    for (const name of files) {
      const sql = await readFile(new URL(name, directory), 'utf8');
      // Normalize line endings across Windows Git checkouts and Linux deployments.
      const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
      if (applied.has(name)) {
        if (applied.get(name) !== checksum) throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations VALUES ($1, $2)', [name, checksum]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function seed(pool, memberPassword, adminPassword) {
  const accounts = [
    { role: 'member', password: memberPassword, variable: 'DEMO_PASSWORD' },
    { role: 'admin', password: adminPassword, variable: 'DEMO_ADMIN_PASSWORD' },
  ];
  for (const { password, variable } of accounts) {
    if (!password || password.length < 12 || password.length > 256) {
      throw new Error(`Set ${variable} to between 12 and 256 characters.`);
    }
  }
  if (memberPassword === adminPassword) throw new Error('Use distinct member and admin passwords.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const { role, password } of accounts) {
      const salt = randomBytes(16).toString('hex');
      const hash = scryptSync(password, salt, 64).toString('hex');
      await client.query(`WITH account AS (
        INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id
      ) DELETE FROM sessions WHERE user_id IN (SELECT id FROM account)`,
      [`${role}@example.test`, `${salt}:${hash}`, role]);
    }
    await client.query(`INSERT INTO rooms (name, capacity, location) VALUES
      ('Atlas', 8, 'Level 2 · East wing'), ('Banyan', 12, 'Level 3 · Central wing'),
      ('Cove', 4, 'Level 2 · West wing') ON CONFLICT (name) DO NOTHING`);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
