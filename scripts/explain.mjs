import { connect } from './db.mjs';

const pool = connect();
try {
  const { rows } = await pool.query(`EXPLAIN (ANALYZE, BUFFERS)
    SELECT r.id, r.name, r.capacity, r.location,
      NOT EXISTS (
        SELECT 1 FROM bookings b WHERE b.room_id = r.id AND b.cancelled_at IS NULL
        AND tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange($1, $2, '[)')
      ) AS available FROM rooms r ORDER BY name`,
  [new Date(Date.now() + 3_600_000), new Date(Date.now() + 7_200_000)]);
  console.log(rows.map((row) => row['QUERY PLAN']).join('\n'));
} finally {
  await pool.end();
}
