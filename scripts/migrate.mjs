import { connect, migrate } from './db.mjs';

const pool = connect();
try {
  await migrate(pool);
  console.log('Migrations applied.');
} finally {
  await pool.end();
}
