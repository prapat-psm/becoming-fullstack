import { connect, seed } from './db.mjs';

const pool = connect();
try {
  await seed(pool, process.env.DEMO_PASSWORD, process.env.DEMO_ADMIN_PASSWORD);
  console.log('Demo accounts and rooms are ready.');
} finally {
  await pool.end();
}
