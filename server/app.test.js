import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const directory = mkdtempSync(join(tmpdir(), 'leads-test-'));
process.env.DB_PATH = join(directory, 'test.sqlite');
const { app } = await import('./app.js');
const { db } = await import('./db.js');
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
after(() => { server.close(); db.close(); rmSync(directory, { recursive: true, force: true }); });

const sample = { name: 'Aisha Khan', email: 'aisha@example.com', phone: '+91 98765 43210', company: 'Aurora Labs', source: 'Referral', status: 'New' };
async function request(path, method = 'GET', body) {
  const res = await fetch(`${base}${path}`, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
}

test('health check and empty initial results', async () => {
  assert.equal((await request('/api/health')).status, 200);
  const list = await request('/api/leads');
  assert.equal(list.body.total, 0);
});

test('lead CRUD, search, filters, pagination and stats', async () => {
  const created = await request('/api/leads', 'POST', sample);
  assert.equal(created.status, 201);
  const id = created.body.id;
  assert.ok(id > 0);
  assert.equal((await request(`/api/leads/${id}`)).body.name, sample.name);
  assert.equal((await request('/api/leads?search=Aisha')).body.total, 1);
  assert.equal((await request('/api/leads?status=Qualified')).body.total, 0);
  assert.equal((await request('/api/leads?page=1&pageSize=1&sort=name')).body.items.length, 1);
  const updated = await request(`/api/leads/${id}`, 'PUT', { ...sample, status: 'Qualified' });
  assert.equal(updated.body.status, 'Qualified');
  assert.equal((await request('/api/leads/stats')).body.byStatus.Qualified, 1);
  assert.equal((await request(`/api/leads/${id}`, 'DELETE')).status, 204);
  assert.equal((await request(`/api/leads/${id}`)).status, 404);
});

test('backend rejects invalid data, IDs and query parameters', async () => {
  const invalid = await request('/api/leads', 'POST', { ...sample, email: 'not-an-email', status: 'Unknown' });
  assert.equal(invalid.status, 422);
  assert.ok(invalid.body.errors.email);
  assert.ok(invalid.body.errors.status);
  assert.equal((await request('/api/leads?page=0')).status, 400);
  assert.equal((await request('/api/leads?sort=leads%3Bdrop')).status, 400);
  assert.equal((await request('/api/leads/abc')).status, 400);
  assert.equal((await request('/api/leads/99999', 'DELETE')).status, 404);
});
