import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLead, deleteLead, getLead, getStats, listLeads, updateLead } from './repository.js';
import { SOURCES, STATUSES, validateLead } from './validation.js';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '16kb' }));
app.use('/api', (_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
app.use('/api', rateLimit({ windowMs:900000, limit:300, standardHeaders:'draft-7', legacyHeaders:false }));
app.get('/api/health', (_req,res) => res.json({status:'ok'}));
app.get('/api/meta', (_req,res) => res.json({sources:SOURCES,statuses:STATUSES}));
app.get('/api/leads/stats',async (_req,res) => res.json(await getStats()));
app.get('/api/leads',async (req,res) => {
  const page=Number(req.query.page ?? 1);
  const pageSize=Number(req.query.pageSize ?? 10);
  const search=String(req.query.search ?? '').trim();
  const status=String(req.query.status ?? 'All');
  const sort=String(req.query.sort ?? 'newest');
  if (!Number.isSafeInteger(page) || page<1 || !Number.isSafeInteger(pageSize) || pageSize<1 || pageSize>100) {
    return res.status(400).json({message:'Invalid pagination parameters.'});
  }
  if (search.length>100 || !['All',...STATUSES].includes(status) || !['newest','oldest','name','company'].includes(sort)) {
    return res.status(400).json({message:'Invalid search, status, or sort parameter.'});
  }
  return res.json(await listLeads({page,pageSize,search,status,sort}));
});
function validId(raw) {
  const id=Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(id) && id>0 ? id : null;
}
app.get('/api/leads/:id', async (req,res) => {
  const id=validId(req.params.id);
  if (id===null) return res.status(400).json({message:'Invalid lead ID.'});
  const lead=await getLead(id);
  return lead ? res.json(lead) : res.status(404).json({message:'Lead not found.'});
});
app.post('/api/leads',async (req,res) => {
  const {value,errors}=validateLead(req.body);
  if (Object.keys(errors).length) return res.status(422).json({message:'Please correct the highlighted fields.',errors});
  return res.status(201).json(await createLead(value));
});
app.put('/api/leads/:id',async (req,res) => {
  const id=validId(req.params.id);
  if (id===null) return res.status(400).json({message:'Invalid lead ID.'});
  const {value,errors}=validateLead(req.body);
  if (Object.keys(errors).length) return res.status(422).json({message:'Please correct the highlighted fields.',errors});
  const lead=await updateLead(id,value);
  return lead ? res.json(lead) : res.status(404).json({message:'Lead not found.'});
});
app.delete('/api/leads/:id',async (req,res) => {
  const id=validId(req.params.id);
  if (id===null) return res.status(400).json({message:'Invalid lead ID.'});
  return await deleteLead(id) ? res.status(204).end() : res.status(404).json({message:'Lead not found.'});
});

const dist=resolve('dist');
if (existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*path}',(req,res,next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(resolve(dist,'index.html'));
  });
}
app.use((_req,res) => res.status(404).json({message:'Resource not found.'}));
app.use((err,_req,res,_next) => {
  if (err instanceof SyntaxError && err.status===400 && 'body' in err) return res.status(400).json({message:'Malformed JSON body.'});
  if (err?.type==='entity.too.large') return res.status(413).json({message:'Request body is too large.'});
  console.error('Request failed:',err);
  res.status(500).json({message:'An unexpected server error occurred.'});
});
