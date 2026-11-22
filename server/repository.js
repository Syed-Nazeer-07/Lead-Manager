import { db } from './db.js';
import pg from 'pg';

const pool = process.env.DATABASE_URL ? new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
}) : null;

export const ready = pool ? pool.query([
  'CREATE TABLE IF NOT EXISTS leads (',
  'id SERIAL PRIMARY KEY,',
  'name VARCHAR(100) NOT NULL, email VARCHAR(254) NOT NULL,',
  'phone VARCHAR(25) NOT NULL, company VARCHAR(120) NOT NULL,',
  "source VARCHAR(30) NOT NULL CHECK(source IN ('Website','Referral','LinkedIn','Cold Outreach','Other')),",
  "status VARCHAR(20) NOT NULL DEFAULT 'New' CHECK(status IN ('New','Contacted','Qualified','Lost')),",
  'created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),',
  'updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());',
  'CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);',
  'CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at DESC);'
].join(' ')).then(() => undefined) : Promise.resolve();

const pgCols = 'id, name, email, phone, company, source, status, created_at AS "createdAt", updated_at AS "updatedAt"';
const sqCols = 'id, name, email, phone, company, source, status, created_at AS createdAt, updated_at AS updatedAt';
const pgSort = { newest:'created_at DESC, id DESC', oldest:'created_at ASC, id ASC', name:'LOWER(name) ASC, id DESC', company:'LOWER(company) ASC, id DESC' };
const sqSort = { newest:'created_at DESC, id DESC', oldest:'created_at ASC, id ASC', name:'name COLLATE NOCASE ASC, id DESC', company:'company COLLATE NOCASE ASC, id DESC' };
function escapeLike(value) { return value.replace(/[\\%_]/g, char => '\\' + char); }

export async function getStats() {
  await ready;
  const counts = { New:0, Contacted:0, Qualified:0, Lost:0 };
  const rows = pool
    ? (await pool.query('SELECT status, COUNT(*)::int AS count FROM leads GROUP BY status')).rows
    : db.prepare('SELECT status, COUNT(*) AS count FROM leads GROUP BY status').all();
  for (const row of rows) counts[row.status] = row.count;
  return { total:Object.values(counts).reduce((a,b) => a+b,0), byStatus:counts };
}

export async function listLeads({ page, pageSize, search, status, sort }) {
  await ready;
  if (pool) {
    const clauses = [];
    const values = [];
    if (search) {
      values.push(search);
      const i = '$'+values.length;
      clauses.push('(POSITION(LOWER('+i+') IN LOWER(name)) > 0 OR POSITION(LOWER('+i+') IN LOWER(email)) > 0 OR POSITION(LOWER('+i+') IN LOWER(company)) > 0)');
    }
    if (status !== 'All') { values.push(status); clauses.push('status = $'+values.length); }
    const where = clauses.length ? ' WHERE '+clauses.join(' AND ') : '';
    const total = (await pool.query('SELECT COUNT(*)::int AS count FROM leads'+where,values)).rows[0].count;
    const paged = [...values,pageSize,(page-1)*pageSize];
    const sql = 'SELECT '+pgCols+' FROM leads'+where+' ORDER BY '+pgSort[sort]+' LIMIT $'+(paged.length-1)+' OFFSET $'+paged.length;
    const items = (await pool.query(sql,paged)).rows;
    return { items,total,page,pageSize,pages:Math.max(1,Math.ceil(total/pageSize)) };
  }
  const where = [];
  const values = {};
  if (search) {
    where.push("(name LIKE @search ESCAPE '\\' COLLATE NOCASE OR email LIKE @search ESCAPE '\\' COLLATE NOCASE OR company LIKE @search ESCAPE '\\' COLLATE NOCASE)");
    values.search = '%'+escapeLike(search)+'%';
  }
  if (status !== 'All') { where.push('status=@status'); values.status=status; }
  const condition = where.length ? ' WHERE '+where.join(' AND ') : '';
  const total = db.prepare('SELECT COUNT(*) AS count FROM leads'+condition).get(values).count;
  const sql = 'SELECT '+sqCols+' FROM leads'+condition+' ORDER BY '+sqSort[sort]+' LIMIT @limit OFFSET @offset';
  const items = db.prepare(sql).all({ ...values,limit:pageSize,offset:(page-1)*pageSize });
  return { items,total,page,pageSize,pages:Math.max(1,Math.ceil(total/pageSize)) };
}

export async function getLead(id) {
  await ready;
  return pool
    ? (await pool.query('SELECT '+pgCols+' FROM leads WHERE id=$1',[id])).rows[0] ?? null
    : db.prepare('SELECT '+sqCols+' FROM leads WHERE id=?').get(id) ?? null;
}
export async function createLead(value) {
  await ready;
  if (pool) {
    const args=[value.name,value.email,value.phone,value.company,value.source,value.status];
    return (await pool.query('INSERT INTO leads (name,email,phone,company,source,status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING '+pgCols,args)).rows[0];
  }
  const info=db.prepare('INSERT INTO leads (name,email,phone,company,source,status) VALUES (@name,@email,@phone,@company,@source,@status)').run(value);
  return getLead(Number(info.lastInsertRowid));
}
export async function updateLead(id,value) {
  await ready;
  if (pool) {
    const args=[value.name,value.email,value.phone,value.company,value.source,value.status,id];
    return (await pool.query('UPDATE leads SET name=$1,email=$2,phone=$3,company=$4,source=$5,status=$6,updated_at=NOW() WHERE id=$7 RETURNING '+pgCols,args)).rows[0] ?? null;
  }
  const changes=db.prepare("UPDATE leads SET name=@name,email=@email,phone=@phone,company=@company,source=@source,status=@status,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=@id").run({...value,id}).changes;
  return changes ? getLead(id) : null;
}
export async function deleteLead(id) {
  await ready;
  return pool
    ? (await pool.query('DELETE FROM leads WHERE id=$1',[id])).rowCount>0
    : db.prepare('DELETE FROM leads WHERE id=?').run(id).changes>0;
}
export async function closeStore() {
  if (pool) await pool.end();
  if (db) db.close();
}
