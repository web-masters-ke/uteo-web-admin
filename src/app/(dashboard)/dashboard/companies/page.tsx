'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { companyService, AdminCompany, CreateCompanyPayload } from '@/lib/services/companyService';
import { userService } from '@/lib/services/userService';
import { useToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';

// Orange-focused input — no blue anywhere
const inp = 'w-full px-4 py-2.5 rounded-xl border border-border bg-card text-card-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] transition-colors';
const lbl = 'block text-sm font-medium text-muted-foreground mb-1.5';
const ic  = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] transition-colors';

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Education', 'Retail',
  'Manufacturing', 'Media', 'Consulting', 'Real Estate', 'Other',
];
const COMPANY_SIZES = ['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE'];

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Add Company Modal ────────────────────────────────────────────────────────

interface AddCompanyModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function AddCompanyModal({ open, onClose, onCreated }: AddCompanyModalProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  // Recruiter account
  const [rec, setRec] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const setR = (k: string, v: string) => setRec(p => ({ ...p, [k]: v }));

  // Company profile
  const [co, setCo] = useState({ name: '', description: '', industry: '', website: '', size: '', location: '' });
  const setC = (k: string, v: string) => setCo(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      setError(null);
      setShowPass(false);
      setRec({ firstName: '', lastName: '', email: '', password: genPassword() });
      setCo({ name: '', description: '', industry: '', website: '', size: '', location: '' });
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    if (!rec.firstName.trim()) { setError('First name is required'); return; }
    if (!rec.email.trim()) { setError('Email is required'); return; }
    if (!rec.password || rec.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!co.name.trim()) { setError('Company name is required'); return; }
    setSubmitting(true);
    try {
      // 1. Create recruiter account
      const user = await companyService.registerRecruiter({
        firstName: rec.firstName.trim(),
        lastName: rec.lastName.trim(),
        email: rec.email.trim(),
        password: rec.password,
      });
      // 2. Create company with this recruiter as owner
      const payload: CreateCompanyPayload = {
        name: co.name.trim(),
        description: co.description.trim() || undefined,
        industry: co.industry || undefined,
        website: co.website.trim() || undefined,
        size: co.size || undefined,
        location: co.location.trim() || undefined,
        ownerId: user.id,
      };
      await companyService.create(payload);
      addToast('success', `${co.name} created — ${rec.email} can now log in`);
      onCreated();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : msg || e?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-background border border-border rounded-2xl shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Add Company</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Creates a recruiter account + company profile in one step</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          {/* Recruiter account */}
          <SectionCard title="1. Recruiter Account" subtitle="These credentials will be used to log in — share them with the recruiter">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>First Name <span className="text-red-500">*</span></label>
                <input value={rec.firstName} onChange={e => setR('firstName', e.target.value)} placeholder="Jane" className={inp} />
              </div>
              <div>
                <label className={lbl}>Last Name</label>
                <input value={rec.lastName} onChange={e => setR('lastName', e.target.value)} placeholder="Doe" className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Email Address <span className="text-red-500">*</span></label>
              <input type="email" value={rec.email} onChange={e => setR('email', e.target.value)} placeholder="recruiter@company.com" className={inp} />
            </div>
            <div>
              <label className={lbl}>Password <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={rec.password}
                    onChange={e => setR('password', e.target.value)}
                    className={inp}
                  />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-[#F77B0F] transition-colors">
                    {showPass ? 'Hide' : 'Show'}
                  </button>
                </div>
                <button type="button" onClick={() => setR('password', genPassword())}
                  className="px-3 py-2 rounded-xl border border-border text-xs text-muted-foreground hover:text-[#F77B0F] hover:border-[#F77B0F] transition-colors whitespace-nowrap">
                  Regenerate
                </button>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">Share this temporary password — the recruiter can change it after logging in.</p>
            </div>
          </SectionCard>

          {/* Company profile */}
          <SectionCard title="2. Company Profile" subtitle="The recruiter will be able to edit these details after logging in">
            <div>
              <label className={lbl}>Company Name <span className="text-red-500">*</span></label>
              <input value={co.name} onChange={e => setC('name', e.target.value)} placeholder="e.g. Safaricom, Andela, YourStartup…" className={inp} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Industry</label>
                <select value={co.industry} onChange={e => setC('industry', e.target.value)} className={inp}>
                  <option value="">Select industry…</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Company Size</label>
                <select value={co.size} onChange={e => setC('size', e.target.value)} className={inp}>
                  <option value="">Select size…</option>
                  {COMPANY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Location</label>
                <input value={co.location} onChange={e => setC('location', e.target.value)} placeholder="e.g. Nairobi, Kenya" className={inp} />
              </div>
              <div>
                <label className={lbl}>Website</label>
                <input value={co.website} onChange={e => setC('website', e.target.value)} placeholder="https://…" className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Description</label>
              <textarea value={co.description} onChange={e => setC('description', e.target.value)} rows={3}
                placeholder="Brief description of what the company does…" className={`${inp} resize-none`} />
            </div>
          </SectionCard>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-card-foreground transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F77B0F] border-t-transparent" />Creating…</>
              : 'Create Company →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Recruiter Modal ──────────────────────────────────────────────────────

interface AddRecruiterModalProps {
  open: boolean;
  company: AdminCompany | null;
  onClose: () => void;
  onAdded: () => void;
}

function AddRecruiterModal({ open, company, onClose, onAdded }: AddRecruiterModalProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userDropOpen, setUserDropOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string; firstName?: string; lastName?: string } | null>(null);
  const [users, setUsers] = useState<{ id: string; email: string; firstName?: string; lastName?: string }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setUserId('');
    setTitle('');
    setUserSearch('');
    setSelectedUser(null);
    setLoadingUsers(true);
    userService.getAll({ limit: 100 })
      .then(res => setUsers((res.items ?? []) as any[]))
      .catch(() => {})
      .finally(() => setLoadingUsers(false));
  }, [open]);

  const filteredUsers = users.filter(u => {
    const q = userSearch.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u as any).firstName?.toLowerCase().includes(q) ||
      (u as any).lastName?.toLowerCase().includes(q)
    );
  });

  const handleSubmit = async () => {
    setError(null);
    if (!userId) { setError('Please select a user'); return; }
    if (!company) return;
    setSubmitting(true);
    try {
      await companyService.addRecruiter(company.id, userId, title.trim() || undefined);
      addToast('success', `${selectedUser?.email} added as recruiter to ${company.name}`);
      onAdded();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : msg || e?.message || 'Failed to add recruiter');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open || !company) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Add Recruiter</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Add a platform user as recruiter for <span className="font-medium text-card-foreground">{company.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

          <div>
            <label className={lbl}>Search User <span className="text-red-500">*</span></label>
            {loadingUsers ? (
              <div className="h-11 bg-muted rounded-xl animate-pulse" />
            ) : (
              <div className="relative">
                {selectedUser ? (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#F77B0F] bg-card">
                    <div className="w-6 h-6 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-[10px] font-bold text-[#F77B0F] shrink-0">
                      {(selectedUser as any).firstName?.[0]?.toUpperCase() || selectedUser.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate">{(selectedUser as any).firstName} {(selectedUser as any).lastName}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                    </div>
                    <button type="button" onClick={() => { setSelectedUser(null); setUserId(''); setUserSearch(''); }}
                      className="text-muted-foreground hover:text-red-500 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <input value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserDropOpen(true); }}
                    onFocus={() => setUserDropOpen(true)} onBlur={() => setTimeout(() => setUserDropOpen(false), 150)}
                    placeholder="Search by name or email…" className={inp} />
                )}
                {userDropOpen && !selectedUser && (
                  <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filteredUsers.slice(0, 15).map(u => (
                      <button key={u.id} type="button"
                        onMouseDown={() => { setSelectedUser(u); setUserId(u.id); setUserDropOpen(false); }}
                        className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm hover:bg-muted border-b border-border last:border-0 transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-[10px] font-bold text-[#F77B0F] shrink-0">
                          {(u as any).firstName?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-card-foreground font-medium truncate">{(u as any).firstName} {(u as any).lastName}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && (
                      <div className="px-4 py-3 text-sm text-muted-foreground">No users found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className={lbl}>Job Title <span className="text-muted-foreground font-normal">(optional)</span></label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Senior Recruiter, HR Manager" className={inp} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-card-foreground transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting || !userId}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-50 disabled:cursor-not-allowed">
            {submitting
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F77B0F] border-t-transparent" />Adding…</>
              : 'Add Recruiter →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CompaniesPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 10;

  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [addCompanyOpen, setAddCompanyOpen] = useState(false);
  const [recruiterTarget, setRecruiterTarget] = useState<AdminCompany | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await companyService.list({ page, limit: LIMIT, search, industry: industryFilter });
      setCompanies(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / LIMIT)));
    } catch {
      addToast('error', 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [page, search, industryFilter, addToast]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const handleVerifyToggle = async (company: AdminCompany) => {
    const newVal = !company.isVerified;
    setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, isVerified: newVal } : c));
    setActionLoading(company.id);
    try {
      await companyService.verify(company.id, newVal);
      addToast('success', newVal ? `${company.name} verified` : `${company.name} unverified`);
      fetchCompanies();
    } catch {
      setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, isVerified: company.isVerified } : c));
      addToast('error', 'Failed to update verification');
    } finally {
      setActionLoading(null);
    }
  };

  const cols: Column<AdminCompany>[] = [
    {
      key: 'name', label: 'Company', sortable: true,
      render: c => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#F77B0F]/10 flex items-center justify-center text-xs font-bold text-[#F77B0F] shrink-0">
            {c.name[0]?.toUpperCase() || '?'}
          </div>
          <span className="font-medium text-card-foreground">{c.name}</span>
        </div>
      ),
    },
    { key: 'industry', label: 'Industry', render: c => <span className="text-sm text-muted-foreground">{c.industry || '-'}</span> },
    { key: 'size', label: 'Size', render: c => <span className="text-sm">{c.size || '-'}</span> },
    { key: 'location', label: 'Location', render: c => <span className="text-sm text-muted-foreground">{c.location || '-'}</span> },
    {
      key: 'isVerified', label: 'Verified',
      render: c => c.isVerified
        ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            Verified
          </span>
        : <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Unverified</span>,
    },
    { key: 'jobs', label: 'Jobs', render: c => <span className="font-medium text-sm">{c._count?.jobs ?? 0}</span> },
    { key: 'recruiters', label: 'Recruiters', render: c => <span className="font-medium text-sm">{c._count?.recruiters ?? 0}</span> },
    { key: 'createdAt', label: 'Joined', sortable: true, render: c => <span className="text-muted-foreground text-sm">{formatDate(c.createdAt)}</span> },
    {
      key: 'actions', label: '',
      render: c => (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <button onClick={() => setRecruiterTarget(c)}
            className="text-xs font-medium text-[#F77B0F] hover:underline transition-colors">
            + Recruiter
          </button>
          <span className="text-border">|</span>
          <button onClick={() => handleVerifyToggle(c)} disabled={actionLoading === c.id}
            className={`text-xs font-medium transition-colors disabled:opacity-50 ${
              c.isVerified ? 'text-red-500 hover:underline' : 'text-[#F77B0F] hover:underline'
            }`}>
            {actionLoading === c.id ? '…' : c.isVerified ? 'Unverify' : 'Verify'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Companies"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Companies' }]}
        actions={
          <button onClick={() => setAddCompanyOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Company
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search companies…" className={`${ic} w-64 pl-9`} />
        </div>
        <select value={industryFilter} onChange={e => { setIndustryFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
          <option value="">All Industries</option>
          {INDUSTRIES.map(ind => <option key={ind} value={ind}>{ind}</option>)}
        </select>
        {(search || industryFilter) && (
          <button onClick={() => { setSearch(''); setIndustryFilter(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors">
            Clear filters
          </button>
        )}
      </div>

      <DataTable columns={cols} data={companies} loading={loading} page={page} totalPages={totalPages} total={total}
        onPageChange={setPage} keyExtractor={c => c.id} onRowClick={c => router.push(`/dashboard/companies/${c.id}`)}
        emptyMessage="No companies found" />

      <AddCompanyModal open={addCompanyOpen} onClose={() => setAddCompanyOpen(false)} onCreated={fetchCompanies} />
      <AddRecruiterModal open={!!recruiterTarget} company={recruiterTarget} onClose={() => setRecruiterTarget(null)} onAdded={fetchCompanies} />
    </div>
  );
}
