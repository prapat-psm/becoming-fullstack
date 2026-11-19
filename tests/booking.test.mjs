import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { createApp } from '../dist/server/app.js';
import { connect, migrate, seed } from '../scripts/db.mjs';

test('Roombook HTTP integration on PostgreSQL', async (t) => {
  const testUrl = process.env.TEST_DATABASE_URL;
  assert.ok(testUrl, 'Set TEST_DATABASE_URL to a PostgreSQL instance before running tests.');
  const adminPool = connect(testUrl);
  const schema = `roombook_test_${randomBytes(6).toString('hex')}`;
  const isolatedUrl = new URL(testUrl);
  isolatedUrl.searchParams.set('options', `-c search_path=${schema},public`);
  const fixturePool = connect(isolatedUrl.href);
  const previousUrl = process.env.DATABASE_URL;
  let app;
  await adminPool.query(`CREATE SCHEMA ${schema}`);
  t.after(async () => {
    await app?.close();
    await fixturePool.end();
    await adminPool.query(`DROP SCHEMA ${schema} CASCADE`);
    await adminPool.end();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
  });
  await migrate(fixturePool);
  await migrate(fixturePool);
  const passwords = { member: 'fixture-member', admin: 'fixture-admin' };
  await seed(fixturePool, passwords.member, passwords.admin);
  process.env.DATABASE_URL = isolatedUrl.href;
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl();

  async function request(path, { token, body, method = 'GET' } = {}) {
    const headers = {};
    if (token) headers.Cookie = token;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(`${base}/api${path}`, { method, headers, body: JSON.stringify(body) });
    assert.ok(response.headers.get('x-request-id'));
    return {
      status: response.status,
      json: response.status === 204 ? null : await response.json(),
      cookie: response.headers.get('set-cookie'),
    };
  }

  async function login(role) {
    const result = await request('/session', { method: 'POST', body: { email: `${role}@example.test`, password: passwords[role] } });
    assert.equal(result.status, 200);
    assert.equal(result.json.user.role, role);
    assert.equal('password_hash' in result.json.user, false);
    assert.match(result.cookie, /HttpOnly/);
    assert.match(result.cookie, /SameSite=Lax/);
    return result.cookie.split(';', 1)[0];
  }

  const member = await login('member');
  const admin = await login('admin');
  const start = Date.now() + 3_600_000;
  const iso = (minutes) => new Date(start + minutes * 60_000).toISOString();
  const created = await request('/rooms', { method: 'POST', token: admin, body: { name: 'Integration room', location: 'Level 2', capacity: 5 } });
  assert.equal(created.status, 201);
  const roomId = created.json.id;
  const booking = (from, to) => ({ roomId, startsAt: iso(from), endsAt: iso(to) });
  const reserve = (body, token = member) => request('/bookings', { method: 'POST', token, body });
  const available = async () => {
    const params = new URLSearchParams({ startsAt: iso(0), endsAt: iso(60) });
    const result = await request(`/rooms?${params}`);
    assert.equal(result.status, 200);
    return result.json.find((room) => room.id === roomId).available;
  };

  await t.test('authenticates, enforces room roles, and updates room details', async () => {
    assert.equal((await request('/session')).json.user, null);
    assert.equal((await request('/session', { method: 'POST', body: { email: 'member@example.test', password: 'wrong' } })).status, 401);
    assert.equal((await request('/session', { method: 'POST', body: { email: 'admin@example.test', password: passwords.member } })).status, 401);
    assert.equal((await request('/bookings')).status, 401);
    const edit = { method: 'PATCH', body: { name: 'Integration room', capacity: 10, location: 'Level 3' } };
    assert.equal((await request(`/rooms/${roomId}`, { ...edit, token: member })).status, 403);
    const updated = await request(`/rooms/${roomId}`, { ...edit, token: admin });
    assert.equal(updated.status, 200);
    assert.equal(updated.json.capacity, 10);
  });

  await t.test('rejects invalid times and an unknown room', async () => {
    assert.equal((await reserve(booking(60, 0))).status, 400);
    assert.equal((await reserve(booking(0, 481))).status, 400);
    assert.equal((await reserve({ ...booking(0, 60), startsAt: '2028-02-31T00:00:00Z' })).status, 400);
    assert.equal((await reserve({ ...booking(0, 60), roomId: 2147483647 })).status, 404);
    assert.equal((await request('/rooms?startsAt=invalid')).status, 400);
  });

  await t.test('serializes overlapping bookings, supports adjacent bookings and owner-only cancellation', async () => {
    assert.equal(await available(), true);
    const results = await Promise.all([reserve(booking(0, 60)), reserve(booking(0, 60))]);
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409]);
    const id = results.find((result) => result.status === 201).json.id;
    assert.equal(await available(), false);
    assert.equal((await reserve(booking(30, 90))).status, 409);
    assert.equal((await reserve(booking(60, 90))).status, 201);
    assert.equal((await request('/bookings', { token: admin })).json.length, 0);
    assert.equal((await request(`/bookings/${id}`, { method: 'DELETE', token: admin })).status, 404);
    assert.equal((await request(`/bookings/${id}`, { method: 'DELETE', token: member })).status, 200);
    assert.equal((await request(`/bookings/${id}`, { method: 'DELETE', token: member })).status, 200);
    assert.equal(await available(), true);
    assert.equal((await reserve(booking(0, 60), admin)).status, 201);
    const mine = await request('/bookings', { token: member });
    assert.equal(mine.json.length, 2);
    assert.ok(mine.json.find((item) => item.id === id).cancelledAt);
  });

  await t.test('revokes a session and clears the cookie on sign-out', async () => {
    const response = await request('/session', { method: 'DELETE', token: member });
    assert.equal(response.status, 204);
    assert.match(response.cookie, /Max-Age=0/);
    assert.equal((await request('/bookings', { token: member })).status, 401);
  });

  await t.test('reports a readiness failure and recovers after a simulated schema mismatch', async () => {
    assert.equal((await request('/health')).status, 200);
    await fixturePool.query('ALTER TABLE rooms RENAME COLUMN name TO name_in_rehearsal');
    try {
      const readiness = await request('/health');
      assert.equal(readiness.status, 503);
      assert.match(readiness.json.requestId, /^[\da-f-]{36}$/);
      assert.equal((await request('/rooms')).status, 500);
    } finally {
      await fixturePool.query('ALTER TABLE rooms RENAME COLUMN name_in_rehearsal TO name');
    }
    assert.equal((await request('/health')).status, 200);
    assert.equal((await request('/rooms')).status, 200);
  });
});
