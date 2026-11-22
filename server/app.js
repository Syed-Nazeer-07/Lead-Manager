import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from './db.js';
import { SOURCES, STATUSES, validateLead } from './validation.js';

export const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

const selectFields = 'id, name, email, phone, company, source, status, created_at AS createdAt, updated_at AS updatedAt';
const sorts = { newest: 'created_at DESC, id DESC', oldest: 'created_at ASC, id ASC', name: 'name COLLATE NOCASE ASC, id DESC', company: 'company COLLATE NOCASE ASC, id DESC' };

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/meta', (_req, res) => res.json({ sources: SOURCES, statuses: STATUSES }));

app.get('/api/leads/stats', (_req, res) => {
  const counts = Object.fromEntries(STATUSES.map(status => [status, 0]));
  for (const item of db.prepare('SELECT status, COUNT(*) AS count FROM leads GROUP BY status').all()) counts[item.status] = item.count;
  res.json({ total: Object.values(counts).reduce((sum, n) => sum + n, 0), byStatus: counts });
});

app.get('/api/leads', (req, res) => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 10);
  const search = String(req.query.search ?? '').trim();
  const status = String(req.query.status ?? 'All');
  const sort = String(req.query.sort ?? 'newest');
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ message: 'Invalid pagination parameters.' });
  }
  if (search.length > 100 || !['All', ...STATUSES].includes(status) || !Object.hasOwn(sorts, sort)) {
    return res.status(400).json({ message: 'Invalid search, status, or sort parameter.' });
  }
  const where = [];
  const params = {};
  if (search) {
    where.push('(name LIKE @search ESCAPE \'\\\' COLLATE NOCASE OR email LIKE @search ESCAPE \'\\\' COLLATE NOCASE OR company LIKE @search ESCAPE \'\\\' COLLATE NOCASE)');
    params.search = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  }
  if (status !== 'All') {
    where.push('status = @status');
    params.status = status;
  }
  const condition = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) AS count FROM leads${condition}`).get(params).count;
  const items = db.prepare(`SELECT ${selectFields} FROM leads${condition} ORDER BY ${sorts[sort]} LIMIT @limit OFFSET @offset`).all({ ...params, limit: pageSize, offset: (page - 1) * pageSize });
  return res.json({ items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) });
});

app.get('/api/leads/:id', (req, res) => {
  const id = idOrNull(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid lead ID.' });
  const lead = db.prepare(`SELECT ${selectFields} FROM leads WHERE id = ?`).get(id);
  return lead ? res.json(lead) : res.status(404).json({ message: 'Lead not found.' });
});

app.post('/api/leads', (req, res) => {
  const { value, errors } = validateLead(req.body);
  if (Object.keys(errors).length) return res.status(422).json({ message: 'Please correct the highlighted fields.', errors });
  const info = db.prepare('INSERT INTO leads (name, email, phone, company, source, status) VALUES (@name, @email, @phone, @company, @source, @status)').run(value);
  return res.status(201).json(db.prepare(`SELECT ${selectFields} FROM leads WHERE id = ?`).get(info.lastInsertRowid));
});

app.put('/api/leads/:id', (req, res) => {
  const id = idOrNull(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid lead ID.' });
  if (!db.prepare('SELECT 1 FROM leads WHERE id = ?').get(id)) return res.status(404).json({ message: 'Lead not found.' });
  const { value, errors } = validateLead(req.body);
  if (Object.keys(errors).length) return res.status(422).json({ message: 'Please correct the highlighted fields.', errors });
  db.prepare(`UPDATE leads SET name=@name, email=@email, phone=@phone, company=@company, source=@source, status=@status, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=@id`).run({ ...value, id });
  return res.json(db.prepare(`SELECT ${selectFields} FROM leads WHERE id = ?`).get(id));
});

app.delete('/api/leads/:id', (req, res) => {
  const id = idOrNull(req.params.id);
  if (id === null) return res.status(400).json({ message: 'Invalid lead ID.' });
  const result = db.prepare('DELETE FROM leads WHERE id = ?').run(id);
  return result.changes ? res.status(204).end() : res.status(404).json({ message: 'Lead not found.' });
});

function idOrNull(raw) {
  const id = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(id) && id > 0 ? id : null;
}

const dist = resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(resolve(dist, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ message: 'Resource not found.' }));
app.use((err, _req, res, _next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) return res.status(400).json({ message: 'Malformed JSON body.' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'Request body is too large.' });
  console.error('Request failed:', err);
  return res.status(500).json({ message: 'An unexpected server error occurred.' });
});
