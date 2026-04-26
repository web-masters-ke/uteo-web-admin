'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { trainerService } from '@/lib/services/trainerService';
import { userService } from '@/lib/services/userService';
import api, { unwrap } from '@/lib/api';
import { Trainer } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { getInitials } from '@/lib/utils';

// ── Styling helpers ───────────────────────────────────────────────────────────
const inp = 'w-full px-4 py-2.5 rounded-xl border border-border bg-card text-card-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] transition-colors';
const lbl = 'block text-sm font-medium text-muted-foreground mb-1.5';
const ic  = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] transition-colors';

const KENYAN_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit',
  'Meru','Migori','Mombasa','Murang\'a','Nairobi','Nakuru','Nandi','Narok','Nyamira',
  'Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi',
  'Trans-Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
];

const INDUSTRIES = [
  'Technology', 'Finance', 'Healthcare', 'Education', 'Retail',
  'Manufacturing', 'Media & Communications', 'Consulting', 'Real Estate',
  'Government & NGO', 'Logistics & Supply Chain', 'Hospitality', 'Other',
];

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

// ── Add Recruiter Modal ───────────────────────────────────────────────────────
interface AddRecruiterModalProps { open: boolean; onClose: () => void; onCreated: () => void; }

function AddRecruiterModal({ open, onClose, onCreated }: AddRecruiterModalProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPass, setShowPass] = useState(false);

  const [rec, setRec] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const setR = (k: string, v: string) => setRec(p => ({ ...p, [k]: v }));

  const [prof, setProf] = useState({ industry: '', location: '', county: '' });
  const setP = (k: string, v: string) => setProf(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (open) {
      setError(null);
      setShowPass(false);
      setRec({ firstName: '', lastName: '', email: '', password: genPassword() });
      setProf({ industry: '', location: '', county: '' });
    }
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    if (!rec.firstName.trim()) { setError('First name is required'); return; }
    if (!rec.email.trim()) { setError('Email is required'); return; }
    if (!rec.password || rec.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setSubmitting(true);
    try {
      const res = await api.post('/auth/register', {
        firstName: rec.firstName.trim(),
        lastName: rec.lastName.trim() || undefined,
        email: rec.email.trim().toLowerCase(),
        password: rec.password,
        role: 'TRAINER',
        specialization: prof.industry || undefined,
        location: prof.location.trim() || undefined,
        county: prof.county || undefined,
      });
      unwrap(res);
      addToast('success', `${rec.firstName} created — ${rec.email} can now log in`);
      onCreated();
      onClose();
    } catch (e: any) {
      const data = e?.response?.data;
      const msg = data?.error?.message || data?.message || e?.message || 'Something went wrong';
      setError(Array.isArray(msg) ? msg.join(' · ') : msg);
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
            <h2 className="text-base font-semibold text-card-foreground">Add Recruiter</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Creates a recruiter account — share the credentials with them to log in</p>
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

          {/* Account details */}
          <SectionCard title="1. Account Details" subtitle="These credentials will be used to log in — share them with the recruiter">
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

          {/* Professional profile */}
          <SectionCard title="2. Professional Profile" subtitle="Optional — the recruiter can fill these in after logging in">
            <div>
              <label className={lbl}>Industry Focus</label>
              <select value={prof.industry} onChange={e => setP('industry', e.target.value)} className={inp}>
                <option value="">Select industry…</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Location</label>
                <input value={prof.location} onChange={e => setP('location', e.target.value)} placeholder="e.g. Nairobi CBD" className={inp} />
              </div>
              <div>
                <label className={lbl}>County</label>
                <select value={prof.county} onChange={e => setP('county', e.target.value)} className={inp}>
                  <option value="">Select county…</option>
                  {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
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
              : 'Create Recruiter →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
interface EditRecruiterForm { bio: string; specialization: string; location: string; county: string; }
interface VerifyForm { action: 'approve' | 'reject'; notes: string; }

export default function RecruitersPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0 });

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTrainer, setEditTrainer] = useState<Trainer | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyTrainer, setVerifyTrainer] = useState<Trainer | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; trainer: Trainer | null }>({ open: false, trainer: null });
  const [actionLoading, setActionLoading] = useState(false);

  const [editForm, setEditForm] = useState<EditRecruiterForm>({ bio: '', specialization: '', location: '', county: '' });
  const [verifyForm, setVerifyForm] = useState<VerifyForm>({ action: 'approve', notes: '' });

  const fetchTrainers = useCallback(async () => {
    setLoading(true);
    try {
      const d = await trainerService.getAll({ page, limit: 10, search, verificationStatus: statusFilter });
      setTrainers(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch {
      addToast('error', 'Failed to load recruiters');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, addToast]);

  const fetchStats = useCallback(async () => {
    const s = await trainerService.getStats();
    setStats({ total: s.total, verified: s.verified, pending: s.pending });
  }, []);

  useEffect(() => { fetchTrainers(); }, [fetchTrainers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleEdit = async () => {
    if (!editTrainer) return;
    setActionLoading(true);
    try {
      await trainerService.update(editTrainer.id, {
        bio: editForm.bio || undefined,
        specialization: editForm.specialization || undefined,
        location: editForm.location || undefined,
        county: editForm.county || undefined,
      });
      addToast('success', 'Recruiter updated');
      setEditOpen(false);
      setEditTrainer(null);
      fetchTrainers();
    } catch {
      addToast('error', 'Failed to update recruiter');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyTrainer) return;
    setActionLoading(true);
    try {
      if (verifyForm.action === 'approve') {
        await trainerService.approve(verifyTrainer.id, verifyForm.notes);
        addToast('success', 'Recruiter approved');
      } else {
        if (!verifyForm.notes) { addToast('error', 'Notes required for rejection'); setActionLoading(false); return; }
        await trainerService.reject(verifyTrainer.id, verifyForm.notes);
        addToast('success', 'Recruiter rejected');
      }
      // Optimistic update — badge flips immediately
      const newStatus = verifyForm.action === 'approve' ? 'VERIFIED' : 'REJECTED';
      setTrainers(prev => prev.map(t => t.id === verifyTrainer.id ? { ...t, verificationStatus: newStatus } : t));
      setVerifyOpen(false);
      setVerifyTrainer(null);
      setVerifyForm({ action: 'approve', notes: '' });
      fetchTrainers();
      fetchStats();
    } catch {
      addToast('error', 'Failed to update verification');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendActivate = async () => {
    const t = suspendDialog.trainer;
    if (!t) return;
    setActionLoading(true);
    try {
      if (t.user?.status === 'SUSPENDED') {
        await userService.activate(t.userId);
        addToast('success', `${t.user?.firstName} activated`);
      } else {
        await userService.suspend(t.userId);
        addToast('success', `${t.user?.firstName} suspended`);
      }
      setSuspendDialog({ open: false, trainer: null });
      fetchTrainers();
    } catch {
      addToast('error', 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (t: Trainer) => {
    setEditTrainer(t);
    setEditForm({ bio: t.bio || '', specialization: t.specialization || '', location: t.location || '', county: t.county || '' });
    setEditOpen(true);
  };

  const cols: Column<Trainer>[] = [
    {
      key: 'avatar', label: '', className: 'w-12',
      render: t => (
        <div className="w-9 h-9 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] flex items-center justify-center text-xs font-bold">
          {getInitials(t.user?.firstName, t.user?.lastName)}
        </div>
      ),
    },
    {
      key: 'name', label: 'Name', sortable: true,
      render: t => (
        <div>
          <span className="font-medium text-card-foreground">{t.user?.firstName} {t.user?.lastName}</span>
          <p className="text-xs text-muted-foreground">{t.user?.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: t => <span className="text-muted-foreground">{t.user?.phone || '-'}</span> },
    { key: 'specialization', label: 'Focus Area', render: t => <span className="text-sm">{t.specialization || '-'}</span> },
    { key: 'location', label: 'Location', render: t => <span className="text-sm text-muted-foreground">{t.location || t.county || '-'}</span> },
    { key: 'verification', label: 'Verification', render: t => <StatusBadge status={t.verificationStatus} /> },
    { key: 'status', label: 'Account', render: t => <StatusBadge status={t.user?.status || 'ACTIVE'} /> },
    {
      key: 'actions', label: '',
      render: t => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <button onClick={() => router.push(`/dashboard/trainers/${t.id}`)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="View">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
          <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          {(t.verificationStatus === 'PENDING' || t.verificationStatus === 'UNDER_REVIEW') && (
            <button onClick={() => { setVerifyTrainer(t); setVerifyForm({ action: 'approve', notes: '' }); setVerifyOpen(true); }} className="p-1.5 rounded-lg hover:bg-muted text-blue-500 hover:text-blue-600 transition-colors" title="Verify">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </button>
          )}
          <button onClick={() => setSuspendDialog({ open: true, trainer: t })} className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${t.user?.status === 'SUSPENDED' ? 'text-green-500 hover:text-green-600' : 'text-amber-500 hover:text-amber-600'}`} title={t.user?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}>
            {t.user?.status === 'SUSPENDED'
              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            }
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Recruiters"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Recruiters' }]}
        actions={
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Recruiter
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatsCard label="Total Recruiters" value={stats.total}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
        <StatsCard label="Verified" value={stats.verified}
          subtitle={stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}% of total` : undefined}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>} />
        <StatsCard label="Pending Verification" value={stats.pending}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search recruiters…" className={`${ic} w-64 pl-9`} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-48`}>
          <option value="">All Statuses</option>
          {['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'].map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }} className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors">
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable columns={cols} data={trainers} loading={loading} page={page} totalPages={totalPages} total={total}
        onPageChange={setPage} keyExtractor={t => t.id}
        onRowClick={t => router.push(`/dashboard/trainers/${t.id}`)}
        emptyMessage="No recruiters found" />

      {/* Add Recruiter — company-style modal */}
      <AddRecruiterModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { fetchTrainers(); fetchStats(); }}
      />

      {/* EDIT MODAL */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditTrainer(null); }} title="Edit Recruiter" size="lg">
        <div className="space-y-4">
          {editTrainer && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] flex items-center justify-center text-sm font-bold">
                {getInitials(editTrainer.user?.firstName, editTrainer.user?.lastName)}
              </div>
              <div>
                <p className="text-sm font-medium">{editTrainer.user?.firstName} {editTrainer.user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{editTrainer.user?.email}</p>
              </div>
            </div>
          )}
          <div>
            <label className={lbl}>Bio</label>
            <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} rows={3} placeholder="Recruiter bio…" className={ic} />
          </div>
          <div>
            <label className={lbl}>Industry Focus</label>
            <select value={editForm.specialization} onChange={e => setEditForm({ ...editForm, specialization: e.target.value })} className={ic}>
              <option value="">Select industry…</option>
              {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Location</label>
              <input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} placeholder="e.g. Nairobi CBD" className={ic} />
            </div>
            <div>
              <label className={lbl}>County</label>
              <select value={editForm.county} onChange={e => setEditForm({ ...editForm, county: e.target.value })} className={ic}>
                <option value="">Select county…</option>
                {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => { setEditOpen(false); setEditTrainer(null); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={actionLoading}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-50">
              {actionLoading ? 'Saving…' : 'Save Changes →'}
            </button>
          </div>
        </div>
      </Modal>

      {/* VERIFY MODAL */}
      <Modal isOpen={verifyOpen} onClose={() => { setVerifyOpen(false); setVerifyTrainer(null); }} title="Verify Recruiter" size="sm">
        <div className="space-y-4">
          {verifyTrainer && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] flex items-center justify-center text-sm font-bold">
                {getInitials(verifyTrainer.user?.firstName, verifyTrainer.user?.lastName)}
              </div>
              <div>
                <p className="text-sm font-medium">{verifyTrainer.user?.firstName} {verifyTrainer.user?.lastName}</p>
                <p className="text-xs text-muted-foreground">Current: <StatusBadge status={verifyTrainer.verificationStatus} /></p>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">Action</label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setVerifyForm({ ...verifyForm, action: 'approve' })} className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${verifyForm.action === 'approve' ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>Approve</button>
              <button type="button" onClick={() => setVerifyForm({ ...verifyForm, action: 'reject' })} className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${verifyForm.action === 'reject' ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'border-border text-muted-foreground hover:bg-muted/50'}`}>Reject</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Notes {verifyForm.action === 'reject' && <span className="text-red-500">*</span>}</label>
            <textarea value={verifyForm.notes} onChange={e => setVerifyForm({ ...verifyForm, notes: e.target.value })} rows={3}
              placeholder={verifyForm.action === 'approve' ? 'Optional notes…' : 'Reason for rejection (required)'}
              className={ic} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => { setVerifyOpen(false); setVerifyTrainer(null); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleVerify} disabled={actionLoading || (verifyForm.action === 'reject' && !verifyForm.notes)}
              className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors ${verifyForm.action === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}>
              {actionLoading ? 'Processing…' : verifyForm.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>

      {/* SUSPEND/ACTIVATE */}
      <ConfirmDialog
        isOpen={suspendDialog.open}
        onClose={() => setSuspendDialog({ open: false, trainer: null })}
        onConfirm={handleSuspendActivate}
        title={suspendDialog.trainer?.user?.status === 'SUSPENDED' ? 'Activate Recruiter' : 'Suspend Recruiter'}
        message={
          suspendDialog.trainer?.user?.status === 'SUSPENDED'
            ? `Are you sure you want to activate ${suspendDialog.trainer?.user?.firstName} ${suspendDialog.trainer?.user?.lastName}?`
            : `Are you sure you want to suspend ${suspendDialog.trainer?.user?.firstName} ${suspendDialog.trainer?.user?.lastName}? They will not be able to post new jobs while suspended.`
        }
        confirmLabel={suspendDialog.trainer?.user?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
        confirmVariant={suspendDialog.trainer?.user?.status === 'SUSPENDED' ? 'primary' : 'danger'}
        loading={actionLoading}
      />
    </div>
  );
}
