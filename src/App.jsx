import { useCallback, useEffect, useMemo, useState } from 'react';
import { validateLead } from '../server/validation.js';
import {
  ArrowDown, ArrowLeft, ArrowRight, Building2, Check, ChevronDown,
  CircleAlert, ContactRound, Inbox, LayoutDashboard,
  LoaderCircle, Mail, Pencil, Plus, Search, SlidersHorizontal, Trash2, Users, X
} from 'lucide-react';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Lost'];
const SOURCES = ['Website', 'Referral', 'LinkedIn', 'Cold Outreach', 'Other'];
const EMPTY = { name: '', email: '', phone: '', company: '', source: 'Website', status: 'New' };
const statusInfo = {
  New: { className: 'new', description: 'Awaiting first contact' },
  Contacted: { className: 'contacted', description: 'Conversation started' },
  Qualified: { className: 'qualified', description: 'Ready to progress' },
  Lost: { className: 'lost', description: 'Not moving forward' }
};

async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  } catch {
    throw new Error('Could not connect to the server. Check that the API is running and try again.');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.message || `Request failed (${response.status}).`);
    error.fields = data?.errors || {};
    throw error;
  }
  return data;
}

function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function StatusBadge({ status }) {
  return <span className={`status-pill ${statusInfo[status]?.className || 'new'}`}><span className="status-dot" />{status}</span>;
}

function initials(name) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
}

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function Modal({ title, description, children, onClose }) {
  useEffect(() => {
    const onKey = event => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = original; };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby="dialog-description">
        <div className="modal-heading"><div><h2 id="dialog-title">{title}</h2><p id="dialog-description">{description}</p></div><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={18} /></button></div>
        {children}
      </section>
    </div>
  );
}

function LeadForm({ lead, onClose, onSaved }) {
  const [fields, setFields] = useState(lead ? Object.fromEntries(Object.keys(EMPTY).map(key => [key, lead[key]])) : EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const update = (key, value) => { setFields(current => ({ ...current, [key]: value })); setErrors(current => ({ ...current, [key]: '' })); };
  const submit = async event => {
    event.preventDefault();
    setMessage('');
    const validation = validateLead(fields);
    if (Object.keys(validation.errors).length > 0) {
      setErrors(validation.errors);
      setMessage('Please correct the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      await api(lead ? `/api/leads/${lead.id}` : '/api/leads', { method: lead ? 'PUT' : 'POST', body: JSON.stringify(fields) });
      onSaved(lead ? 'Lead updated successfully.' : 'New lead added successfully.');
    } catch (error) {
      setErrors(error.fields || {});
      setMessage(error.message);
    } finally { setSaving(false); }
  };
  return (
    <Modal title={lead ? 'Edit lead' : 'Add a new lead'} description={lead ? 'Update the details and keep your pipeline current.' : 'Capture the essentials to start a new conversation.'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          {[
            ['name', 'Full name', 'text', 'e.g. Alex Morgan'],
            ['email', 'Email address', 'email', 'alex@company.com'],
            ['phone', 'Phone number', 'tel', '+1 (555) 000-0000'],
            ['company', 'Company', 'text', 'e.g. Acme Inc.']
          ].map(([key, label, type, placeholder]) => (
            <label className="field" key={key}><span>{label} <em>*</em></span><input autoComplete={key === 'name' ? 'name' : key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'organization'} type={type} maxLength={key === 'email' ? 254 : key === 'phone' ? 25 : key === 'name' ? 100 : 120} value={fields[key]} onChange={event => update(key, event.target.value)} placeholder={placeholder} aria-invalid={Boolean(errors[key])} required />{errors[key] && <small className="field-error">{errors[key]}</small>}</label>
          ))}
          <label className="field"><span>Lead source <em>*</em></span><select value={fields.source} onChange={event => update('source', event.target.value)} aria-invalid={Boolean(errors.source)}>{SOURCES.map(item => <option key={item}>{item}</option>)}</select>{errors.source && <small className="field-error">{errors.source}</small>}</label>
          <label className="field"><span>Status <em>*</em></span><select value={fields.status} onChange={event => update('status', event.target.value)} aria-invalid={Boolean(errors.status)}>{STATUSES.map(item => <option key={item}>{item}</option>)}</select>{errors.status && <small className="field-error">{errors.status}</small>}</label>
        </div>
        {message && <div className="form-alert" role="alert"><CircleAlert size={16} />{message}</div>}
        <div className="form-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{saving ? 'Saving…' : lead ? 'Save changes' : 'Create lead'}</button></div>
      </form>
    </Modal>
  );
}

function DeleteDialog({ lead, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const remove = async () => {
    setDeleting(true);
    try { await api(`/api/leads/${lead.id}`, { method: 'DELETE' }); onDeleted(); }
    catch (err) { setError(err.message); setDeleting(false); }
  };
  return <Modal title="Delete lead?" description="This action cannot be undone." onClose={onClose}>
    <p className="delete-copy">You're about to permanently delete <strong>{lead.name}</strong> from your leads. Their contact details and status will be removed.</p>
    {error && <div className="form-alert" role="alert">{error}</div>}
    <div className="form-actions"><button className="btn btn-secondary" onClick={onClose}>Keep lead</button><button className="btn btn-danger" onClick={remove} disabled={deleting}>{deleting ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />}Delete lead</button></div>
  </Modal>;
}

export default function App() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState({ items: [], total: 0, pages: 1 });
  const [stats, setStats] = useState({ total: 0, byStatus: { New: 0, Contacted: 0, Qualified: 0, Lost: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [toast, setToast] = useState('');
  const debouncedSearch = useDebounce(search, 250);
  const query = useMemo(() => new URLSearchParams({ search: debouncedSearch, status: filter, sort, page: String(page), pageSize: '10' }), [debouncedSearch, filter, sort, page]);
  const closeDialog = useCallback(() => setDialog(null), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api(`/api/leads?${query}`).then(data => { if (active) setResult(data); }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query, refresh]);
  useEffect(() => {
    let active = true;
    api('/api/leads/stats').then(data => { if (active) setStats(data); }).catch(() => {});
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const saved = message => { closeDialog(); setToast(message); setRefresh(x => x + 1); };
  const deleted = () => { closeDialog(); setToast('Lead deleted.'); if (result.items.length === 1 && page > 1) setPage(x => x - 1); setRefresh(x => x + 1); };
  const changeFilter = value => { setFilter(value); setPage(1); };
  const changeSort = value => { setSort(value); setPage(1); };
  const changeSearch = value => { setSearch(value); setPage(1); };

  const metricCards = [
    { key: 'total', label: 'Total leads', count: stats.total, icon: Users, tone: 'all', note: 'Across your pipeline' },
    { key: 'New', label: 'New leads', count: stats.byStatus.New, icon: Inbox, tone: 'new', note: 'Ready to reach out' },
    { key: 'Contacted', label: 'Contacted', count: stats.byStatus.Contacted, icon: Mail, tone: 'contacted', note: 'In conversation' },
    { key: 'Qualified', label: 'Qualified', count: stats.byStatus.Qualified, icon: Check, tone: 'qualified', note: 'Promising opportunities' }
  ];

  return <div className="app-shell">
    <header className="site-header"><div className="container header-inner"><div className="brand"><div className="brand-mark"><LayoutDashboard size={19} strokeWidth={2.4} /></div><span>leads<span className="brand-muted">pace</span><span className="brand-dot">.</span></span></div><div className="header-right"><span className="header-divider"/><span className="workspace-avatar">LM</span><div className="workspace-meta"><strong>Lead workspace</strong><small>Personal dashboard</small></div><ChevronDown size={15} color="#94a3b8" /></div></div></header>
    <main className="container main-content">
      <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Overview</strong></div>
      <section className="page-intro"><div><span className="eyebrow"><span className="eyebrow-dot" /> YOUR SALES PIPELINE</span><h1>Every opportunity, <span>in one place.</span></h1><p>Stay organized, follow up on time, and turn conversations into connections.</p></div><button className="btn btn-primary create-main" onClick={() => setDialog({ kind: 'create' })}><Plus size={18} /> Add new lead</button></section>
      <section className="metric-grid" aria-label="Pipeline overview">{metricCards.map(card => <article className={`metric-card metric-${card.tone}`} key={card.key}><div className="metric-upper"><span>{card.label}</span><span className="metric-icon"><card.icon size={18} strokeWidth={2} /></span></div><div className="metric-value">{card.count.toLocaleString()}</div><div className="metric-note">{card.note}</div></article>)}</section>
      <section className="panel"><div className="panel-heading"><div><div className="section-kicker">YOUR CONTACTS</div><h2>Lead directory <span className="count-chip">{result.total}</span></h2><p>All your prospects, neatly organized and easy to manage.</p></div><button className="btn btn-outline small-add" onClick={() => setDialog({ kind: 'create' })}><Plus size={17} /> Add lead</button></div>
      <div className="toolbar"><label className="search-box"><Search size={18} color="#94a3b8"/><input aria-label="Search leads" placeholder="Search by name, company, or email…" value={search} onChange={event => changeSearch(event.target.value)} />{search && <button className="clear-search" onClick={() => changeSearch('')} aria-label="Clear search"><X size={15} /></button>}</label><div className="filter-controls"><div className="select-wrap"><SlidersHorizontal size={16}/><select aria-label="Filter by status" value={filter} onChange={event => changeFilter(event.target.value)}><option value="All">All statuses</option>{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select><ChevronDown size={14}/></div><div className="select-wrap sort-wrap"><ArrowDown size={16}/><select aria-label="Sort leads" value={sort} onChange={event => changeSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option><option value="company">Company A–Z</option></select><ChevronDown size={14}/></div></div></div>
      {error ? <div className="state-box" role="alert"><CircleAlert size={32} /><h3>Unable to load leads</h3><p>{error}</p><button className="btn btn-secondary" onClick={() => setRefresh(x => x + 1)}>Try again</button></div> : loading ? <div className="state-box"><LoaderCircle size={32} className="spin"/><p>Loading your leads…</p></div> : result.items.length === 0 ? <div className="state-box empty-state"><div className="empty-icon"><ContactRound size={25}/></div><h3>{search || filter !== 'All' ? 'No matching leads' : 'Your pipeline starts here'}</h3><p>{search || filter !== 'All' ? 'Try a different search or reset your filters.' : 'Add your first lead to build your contact directory.'}</p>{search || filter !== 'All' ? <button className="btn btn-secondary" onClick={() => { changeSearch(''); changeFilter('All'); }}>Clear filters</button> : <button className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}><Plus size={17}/> Add your first lead</button>}</div> : <div className="table-wrap"><table><thead><tr><th>LEAD</th><th>COMPANY</th><th>PHONE</th><th>SOURCE</th><th>STATUS</th><th>ADDED</th><th className="actions-head">ACTIONS</th></tr></thead><tbody>{result.items.map(lead => <tr key={lead.id}><td data-label="Lead"><div className="lead-identity"><div className="lead-avatar">{initials(lead.name)}</div><div><strong>{lead.name}</strong><a href={`mailto:${lead.email}`}>{lead.email}</a></div></div></td><td data-label="Company"><div className="company-cell"><Building2 size={15}/>{lead.company}</div></td><td data-label="Phone"><a className="cell-phone" href={`tel:${lead.phone}`}>{lead.phone}</a></td><td data-label="Source"><span className="source-text">{lead.source}</span></td><td data-label="Status"><StatusBadge status={lead.status}/></td><td data-label="Added"><span className="muted-cell">{formatDate(lead.createdAt)}</span></td><td data-label="Actions"><div className="row-actions"><button className="row-action" aria-label={`Edit ${lead.name}`} title="Edit lead" onClick={() => setDialog({ kind: 'edit', lead })}><Pencil size={16}/></button><button className="row-action danger-action" aria-label={`Delete ${lead.name}`} title="Delete lead" onClick={() => setDialog({ kind: 'delete', lead })}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>}
      <div className="table-footer"><div>Showing <strong>{result.total === 0 ? 0 : (page - 1) * 10 + 1}–{Math.min(page * 10, result.total)}</strong> of <strong>{result.total}</strong> leads</div><div className="pagination"><button aria-label="Previous page" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ArrowLeft size={16}/></button><span>Page {page} of {result.pages}</span><button aria-label="Next page" disabled={page >= result.pages || loading} onClick={() => setPage(p => p + 1)}><ArrowRight size={16}/></button></div></div>
      </section>
      <footer className="page-footer"><span>Leadspace · Built to keep your pipeline moving.</span><span>Simple tools. Better follow-ups.</span></footer>
    </main>
    {dialog?.kind === 'create' && <LeadForm onClose={closeDialog} onSaved={saved}/ >}
    {dialog?.kind === 'edit' && <LeadForm lead={dialog.lead} onClose={closeDialog} onSaved={saved}/ >}
    {dialog?.kind === 'delete' && <DeleteDialog lead={dialog.lead} onClose={closeDialog} onDeleted={deleted}/ >}
    {toast && <div className="toast" role="status"><span className="toast-check"><Check size={14}/></span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={16}/></button></div>}
  </div>;
}
