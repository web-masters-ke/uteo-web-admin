'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { Modal } from '@/components/Modal';
import { useToast } from '@/lib/toast';
import {
  slaService,
  SlaPolicy,
  SlaAssignment,
  SlaDashboard,
  SlaReport,
} from '@/lib/services/slaService';
import { formatDateTime, formatDate } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  MEDIUM: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  HIGH: 'bg-[#F77B0F]/10 text-[#F77B0F]',
  CRITICAL: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  WARNING: 'bg-[#F77B0F]/10 text-[#F77B0F]',
  BREACHED: 'bg-red-500/10 text-red-700 dark:text-red-400',
  MET: 'bg-green-500/10 text-green-700 dark:text-green-400',
  PAUSED: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
};

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${PRIORITY_COLORS[priority] || 'bg-gray-100 text-gray-600'}`}>
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function ProgressBar({ percent, breached }: { percent: number; breached?: boolean }) {
  const color = breached ? 'bg-red-500' : percent >= 80 ? 'bg-[#F77B0F]' : percent >= 60 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 relative overflow-hidden">
      <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${color || 'bg-[#192C67]'}`} />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-[#192C67] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SlaPage() {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'policies' | 'assignments' | 'reports'>('policies');

  // Dashboard stats
  const [dashboard, setDashboard] = useState<SlaDashboard | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const d = await slaService.getDashboard();
      setDashboard(d);
    } catch {
      // non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  return (
    <div className="space-y-6">
      <PageHeader title="SLA Management" />

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse h-24" />
          ))
        ) : dashboard ? (
          <>
            <MetricCard label="Active" value={dashboard.active} color="bg-blue-500" />
            <MetricCard label="Warning" value={dashboard.warning} color="bg-[#F77B0F]" />
            <MetricCard label="Breached" value={dashboard.breached} color="bg-red-500" />
            <MetricCard label="Met" value={dashboard.met} color="bg-green-500" />
            <MetricCard label="Paused" value={dashboard.paused} color="bg-gray-400" />
            <MetricCard
              label="Compliance"
              value={dashboard.complianceRate !== null ? `${dashboard.complianceRate}%` : '—'}
              sub={`${dashboard.total} total`}
              color="bg-[#192C67]"
            />
          </>
        ) : null}
      </div>

      {/* Tab Bar */}
      <div className="bg-muted rounded-xl p-1 inline-flex gap-1">
        {(['policies', 'assignments', 'reports'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all capitalize ${
              tab === t
                ? 'bg-[#192C67] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'assignments' ? 'Active Assignments' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'policies' && <PoliciesTab onRefreshStats={loadStats} />}
      {tab === 'assignments' && <AssignmentsTab onRefreshStats={loadStats} />}
      {tab === 'reports' && <ReportsTab />}
    </div>
  );
}

// ─── Policies Tab ─────────────────────────────────────────────────────────────

function PoliciesTab({ onRefreshStats }: { onRefreshStats: () => void }) {
  const { addToast } = useToast();
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SlaPolicy | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SlaPolicy | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    priority: 'MEDIUM' as SlaPolicy['priority'],
    firstResponseHours: 4,
    resolutionHours: 48,
    warningPercent: 80,
    autoEscalate: true,
    warningNotifyRole: 'SUPPORT' as SlaPolicy['warningNotifyRole'],
    firstResponseEscalateTo: 'SUPPORT' as SlaPolicy['firstResponseEscalateTo'],
    resolutionEscalateTo: 'FINANCE_ADMIN' as SlaPolicy['resolutionEscalateTo'],
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPolicies(await slaService.getPolicies());
    } catch {
      addToast('error', 'Failed to load SLA policies');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setForm({ name: '', description: '', priority: 'MEDIUM', firstResponseHours: 4, resolutionHours: 48, warningPercent: 80, autoEscalate: true, warningNotifyRole: 'SUPPORT', firstResponseEscalateTo: 'SUPPORT', resolutionEscalateTo: 'FINANCE_ADMIN' });
    setEditTarget(null);
    setCreateOpen(true);
  };

  const openEdit = (p: SlaPolicy) => {
    setForm({
      name: p.name,
      description: p.description || '',
      priority: p.priority,
      firstResponseHours: p.firstResponseHours,
      resolutionHours: p.resolutionHours,
      warningPercent: p.warningPercent,
      autoEscalate: p.autoEscalate,
      warningNotifyRole: p.warningNotifyRole || 'SUPPORT',
      firstResponseEscalateTo: p.firstResponseEscalateTo || 'SUPPORT',
      resolutionEscalateTo: p.resolutionEscalateTo || 'FINANCE_ADMIN',
    });
    setEditTarget(p);
    setCreateOpen(true);
  };

  const submitForm = async () => {
    if (!form.name.trim()) { addToast('error', 'Policy name is required'); return; }
    if (form.firstResponseHours < 1) { addToast('error', 'First response hours must be ≥ 1'); return; }
    if (form.resolutionHours < form.firstResponseHours) { addToast('error', 'Resolution hours must be ≥ first response hours'); return; }

    setBusy(true);
    try {
      if (editTarget) {
        await slaService.updatePolicy(editTarget.id, form);
        addToast('success', 'Policy updated');
      } else {
        await slaService.createPolicy(form);
        addToast('success', 'Policy created');
      }
      setCreateOpen(false);
      await load();
      onRefreshStats();
    } catch (e: any) {
      addToast('error', e?.response?.data?.message || 'Failed to save policy');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (p: SlaPolicy) => {
    try {
      await slaService.updatePolicy(p.id, { isActive: !p.isActive });
      addToast('success', p.isActive ? 'Policy deactivated' : 'Policy activated');
      load();
    } catch {
      addToast('error', 'Failed to update policy');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await slaService.deletePolicy(deleteTarget.id);
      addToast('success', deleteTarget._count && deleteTarget._count.assignments > 0 ? 'Policy deactivated (has assignments)' : 'Policy deleted');
      setDeleteTarget(null);
      load();
      onRefreshStats();
    } catch (e: any) {
      addToast('error', e?.response?.data?.message || 'Failed to delete policy');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          SLA Policies · {policies.length} policies
        </h2>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#192C67] text-white text-sm font-semibold rounded-lg hover:bg-[#14234f] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Policy
        </button>
      </div>

      {loading ? <Spinner /> : policies.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-muted-foreground text-sm">No SLA policies yet. Create your first policy to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map(p => (
            <div
              key={p.id}
              className={`bg-card border rounded-xl p-5 space-y-3 transition-all ${p.isActive ? 'border-border' : 'border-border opacity-60'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{p.name}</p>
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
                  )}
                </div>
                <PriorityBadge priority={p.priority} />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted rounded-lg p-2.5">
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">First Response</p>
                  <p className="font-bold text-foreground">{p.firstResponseHours}h</p>
                </div>
                <div className="bg-muted rounded-lg p-2.5">
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">Resolution</p>
                  <p className="font-bold text-foreground">{p.resolutionHours}h</p>
                </div>
                <div className="bg-muted rounded-lg p-2.5">
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">Warning At</p>
                  <p className="font-bold text-foreground">{p.warningPercent}%</p>
                </div>
                <div className="bg-muted rounded-lg p-2.5">
                  <p className="text-muted-foreground uppercase tracking-wider text-[10px] mb-0.5">Assignments</p>
                  <p className="font-bold text-foreground">{p._count?.assignments ?? 0}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-[#192C67]/10 text-[#192C67] hover:bg-[#192C67]/20 dark:text-blue-400 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    p.isActive
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                      : 'bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20'
                  }`}
                >
                  {p.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => setDeleteTarget(p)}
                  className="py-1.5 px-3 text-xs font-semibold rounded-lg bg-red-500/10 text-red-700 dark:text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Escalation routing summary */}
              <div className="rounded-lg bg-muted p-2.5 space-y-1 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">⚠ Warning ({p.warningPercent}%)</span>
                  <span className="font-semibold text-foreground">→ {(p.warningNotifyRole || 'SUPPORT').replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">⏱ 1st response breach</span>
                  <span className="font-semibold text-foreground">→ {(p.firstResponseEscalateTo || 'SUPPORT').replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">🔴 Resolution breach</span>
                  <span className="font-semibold text-foreground">→ {(p.resolutionEscalateTo || 'FINANCE_ADMIN').replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-border">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-500/10 text-green-700 dark:text-green-400' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}`}>
                  {p.isActive ? 'ACTIVE' : 'INACTIVE'}
                </span>
                {p.autoEscalate && (
                  <span className="text-[10px] font-medium text-muted-foreground">Auto-escalate ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => { if (!busy) setCreateOpen(false); }}
        title={editTarget ? 'Edit SLA Policy' : 'Create SLA Policy'}
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">Policy Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Standard Resolution · Premium SLA"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-[#192C67] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description of when this policy applies"
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-[#192C67] outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">Priority *</label>
            <div className="grid grid-cols-4 gap-2">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, priority: p }))}
                  className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                    form.priority === p
                      ? 'border-[#192C67] bg-[#192C67] text-white'
                      : 'border-border text-muted-foreground hover:border-[#192C67]/50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">First Response (hours) *</label>
              <input
                type="number"
                min={1}
                value={form.firstResponseHours}
                onChange={e => setForm(f => ({ ...f, firstResponseHours: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-[#192C67] outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">Resolution (hours) *</label>
              <input
                type="number"
                min={1}
                value={form.resolutionHours}
                onChange={e => setForm(f => ({ ...f, resolutionHours: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-[#192C67] outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5 uppercase tracking-wider">Warning Threshold (%)</label>
              <input
                type="number"
                min={50}
                max={99}
                value={form.warningPercent}
                onChange={e => setForm(f => ({ ...f, warningPercent: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-[#192C67] outline-none"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Send warning when this % of time elapsed</p>
            </div>
            <div className="flex flex-col justify-center">
              <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">Auto-escalate</label>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, autoEscalate: !f.autoEscalate }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.autoEscalate ? 'bg-[#192C67]' : 'bg-gray-300 dark:bg-gray-600'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.autoEscalate ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <p className="text-[10px] text-muted-foreground mt-1">Auto-escalate on breach</p>
            </div>
          </div>

          {/* Escalation routing */}
          <div className="rounded-xl border border-border bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Escalation &amp; Notification Routing</p>
            <p className="text-[11px] text-muted-foreground -mt-1">Define which role gets notified or escalated to at each threshold.</p>

            {(['warningNotifyRole', 'firstResponseEscalateTo', 'resolutionEscalateTo'] as const).map((field) => {
              const labels: Record<string, { title: string; sub: string }> = {
                warningNotifyRole: { title: 'Warning — Notify role', sub: `Triggered when ${form.warningPercent}% of time is elapsed` },
                firstResponseEscalateTo: { title: 'First response breach — Escalate to', sub: `Triggered when ${form.firstResponseHours}h first-response SLA is missed` },
                resolutionEscalateTo: { title: 'Resolution breach — Escalate to', sub: `Triggered when ${form.resolutionHours}h resolution SLA is missed` },
              };
              return (
                <div key={field}>
                  <label className="block text-[11px] font-semibold text-foreground mb-0.5">{labels[field].title}</label>
                  <p className="text-[10px] text-muted-foreground mb-1.5">{labels[field].sub}</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(['SUPPORT', 'ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'] as const).map(role => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, [field]: role }))}
                        className={`py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                          form[field] === role
                            ? 'border-[#192C67] bg-[#192C67] text-white'
                            : 'border-border text-muted-foreground hover:border-[#192C67]/50 bg-background'
                        }`}
                      >
                        {role === 'FINANCE_ADMIN' ? 'Finance' : role === 'SUPER_ADMIN' ? 'Super Admin' : role === 'ADMIN' ? 'Admin' : 'Support'}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              onClick={() => { if (!busy) setCreateOpen(false); }}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={submitForm}
              disabled={busy}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-[#192C67] text-white hover:bg-[#14234f] disabled:opacity-50 flex items-center gap-2"
            >
              {busy && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {editTarget ? 'Save Changes' : 'Create Policy'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => { if (!busy) setDeleteTarget(null); }}
        title="Delete SLA Policy"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {deleteTarget?._count && deleteTarget._count.assignments > 0
              ? `This policy has ${deleteTarget._count.assignments} assignment(s). It will be deactivated instead of deleted.`
              : `Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              onClick={() => { if (!busy) setDeleteTarget(null); }}
              disabled={busy}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={busy}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
            >
              {busy && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {deleteTarget?._count && deleteTarget._count.assignments > 0 ? 'Deactivate' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────

function AssignmentsTab({ onRefreshStats }: { onRefreshStats: () => void }) {
  const { addToast } = useToast();
  const [assignments, setAssignments] = useState<SlaAssignment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await slaService.getAssignments(page, 20, statusFilter || undefined);
      setAssignments(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch {
      addToast('error', 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, addToast]);

  useEffect(() => { load(); }, [load]);

  const pause = async (id: string) => {
    setActionBusy(id + '_pause');
    try {
      await slaService.pauseAssignment(id);
      addToast('success', 'SLA paused');
      load();
      onRefreshStats();
    } catch (e: any) {
      addToast('error', e?.response?.data?.message || 'Failed to pause SLA');
    } finally {
      setActionBusy(null);
    }
  };

  const resume = async (id: string) => {
    setActionBusy(id + '_resume');
    try {
      await slaService.resumeAssignment(id);
      addToast('success', 'SLA resumed');
      load();
      onRefreshStats();
    } catch (e: any) {
      addToast('error', e?.response?.data?.message || 'Failed to resume SLA');
    } finally {
      setActionBusy(null);
    }
  };

  const STATUSES = ['', 'ACTIVE', 'WARNING', 'BREACHED', 'MET', 'PAUSED'];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s || 'all'}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                statusFilter === s
                  ? 'bg-[#192C67] text-white'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-muted-foreground">{total} assignments</div>
      </div>

      <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
        Assignment Queue · {total} entries
      </div>

      {loading ? <Spinner /> : assignments.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <svg className="w-12 h-12 text-muted-foreground mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-muted-foreground text-sm">No SLA assignments found{statusFilter ? ` with status ${statusFilter}` : ''}.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map(a => {
            const snap = a.statusSnapshot;
            const isPausable = a.status === 'ACTIVE' || a.status === 'WARNING';
            const isResumable = a.status === 'PAUSED';
            const isFinal = a.status === 'MET' || a.status === 'BREACHED';

            return (
              <div
                key={a.id}
                className={`bg-card border rounded-xl p-5 ${
                  a.status === 'BREACHED' ? 'border-red-300 dark:border-red-800' :
                  a.status === 'WARNING' ? 'border-[#F77B0F]/40' :
                  'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge status={a.status} />
                      {a.policy && <PriorityBadge priority={a.policy.priority} />}
                      {a.policy && (
                        <span className="text-xs text-muted-foreground">{a.policy.name}</span>
                      )}
                    </div>
                    {a.dispute && (
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="font-mono">#{a.disputeId.slice(0, 8)}</span>
                        {' · '}
                        <span className="truncate">{a.dispute.reason}</span>
                        {' · '}
                        <span className={`font-medium ${
                          a.dispute.status === 'OPEN' ? 'text-blue-600' :
                          a.dispute.status === 'UNDER_REVIEW' ? 'text-amber-600' :
                          'text-green-600'
                        }`}>{a.dispute.status}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isFinal && (
                    <div className="flex gap-2">
                      {isPausable && (
                        <button
                          onClick={() => pause(a.id)}
                          disabled={!!actionBusy}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {actionBusy === a.id + '_pause' ? (
                            <div className="w-3 h-3 border border-amber-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                            </svg>
                          )}
                          Pause
                        </button>
                      )}
                      {isResumable && (
                        <button
                          onClick={() => resume(a.id)}
                          disabled={!!actionBusy}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {actionBusy === a.id + '_resume' ? (
                            <div className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                          Resume
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress bars */}
                {snap && !isFinal && (
                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>FIRST RESPONSE</span>
                        <span>{a.firstResponseAt ? '✓ Done' : snap.firstResponseBreached ? 'BREACHED' : `${snap.firstResponsePercent}%`}</span>
                      </div>
                      <ProgressBar percent={snap.firstResponsePercent} breached={snap.firstResponseBreached} />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Due: {formatDateTime(a.firstResponseDue)}</p>
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                        <span>RESOLUTION</span>
                        <span>{snap.resolutionBreached ? 'BREACHED' : snap.minutesRemaining !== null && snap.minutesRemaining !== undefined ? `${snap.minutesRemaining}m left` : `${snap.resolutionPercent}%`}</span>
                      </div>
                      <ProgressBar percent={snap.resolutionPercent} breached={snap.resolutionBreached} />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Due: {formatDateTime(a.resolutionDue)}</p>
                    </div>
                  </div>
                )}

                {isFinal && (
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Resolved: {a.resolvedAt ? formatDateTime(a.resolvedAt) : '—'}</span>
                    {a.status === 'MET' && (
                      <span className="text-green-600 font-medium">✓ SLA met within deadline</span>
                    )}
                    {a.status === 'BREACHED' && (
                      <span className="text-red-600 font-medium">⚠ SLA breached</span>
                    )}
                  </div>
                )}

                {/* Escalations */}
                {a.escalations && a.escalations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Escalations ({a.escalations.length})
                    </p>
                    <div className="space-y-1">
                      {a.escalations.slice(0, 2).map(esc => (
                        <div key={esc.id} className="flex items-center gap-2 text-[11px]">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            esc.reason === 'RESOLUTION_BREACH' ? 'bg-red-500/10 text-red-600' : 'bg-[#F77B0F]/10 text-[#F77B0F]'
                          }`}>{esc.reason.replace(/_/g, ' ')}</span>
                          <span className="text-muted-foreground">→ {esc.escalatedTo}</span>
                          <span className="text-muted-foreground ml-auto">{formatDateTime(esc.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-muted disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const { addToast } = useToast();
  const [report, setReport] = useState<SlaReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await slaService.getReport(from || undefined, to || undefined);
      setReport(r);
    } catch {
      addToast('error', 'Failed to load SLA report');
    } finally {
      setLoading(false);
    }
  }, [from, to, addToast]);

  useEffect(() => { load(); }, [load]);

  const s = report?.summary;

  return (
    <div className="space-y-6">
      {/* Date filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">From</label>
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-[#192C67] outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">To</label>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-input bg-background text-sm text-foreground focus:ring-2 focus:ring-[#192C67] outline-none"
          />
        </div>
        <button
          onClick={() => { setFrom(''); setTo(''); }}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-muted-foreground hover:bg-muted"
        >
          Clear
        </button>
        {loading && (
          <div className="w-5 h-5 border-2 border-[#192C67] border-t-transparent rounded-full animate-spin ml-2" />
        )}
      </div>

      {!loading && s && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <MetricCard label="Total" value={s.total} color="bg-[#192C67]" />
            <MetricCard label="Met" value={s.met} color="bg-green-500" />
            <MetricCard label="Breached" value={s.breached} color="bg-red-500" />
            <MetricCard label="Active" value={s.active} color="bg-blue-500" />
            <MetricCard
              label="Compliance Rate"
              value={s.complianceRate !== null ? `${s.complianceRate}%` : '—'}
              sub={s.total > 0 ? `${s.met} of ${s.met + s.breached} resolved` : 'No resolved cases'}
              color={s.complianceRate !== null && s.complianceRate >= 80 ? 'bg-green-500' : 'bg-red-500'}
            />
          </div>

          {/* Compliance bar */}
          {s.complianceRate !== null && (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Compliance Rate</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${s.complianceRate >= 90 ? 'bg-green-500' : s.complianceRate >= 70 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${s.complianceRate}%` }}
                  />
                </div>
                <span className="text-2xl font-bold tabular-nums text-foreground w-16 text-right">{s.complianceRate}%</span>
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0%</span>
                <span className="text-amber-500">70% target</span>
                <span className="text-green-500">90% excellent</span>
                <span>100%</span>
              </div>
            </div>
          )}

          {/* By policy breakdown */}
          {report.byPolicy.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">By Policy</p>
              <div className="space-y-2">
                {report.byPolicy.map(bp => (
                  <div key={bp.id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-foreground truncate">{bp.name}</span>
                        <PriorityBadge priority={bp.priority} />
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div
                          className="bg-[#192C67] h-1.5 rounded-full"
                          style={{ width: s.total > 0 ? `${Math.round((bp.count / s.total) * 100)}%` : '0%' }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums text-foreground">{bp.count}</p>
                      <p className="text-[10px] text-muted-foreground">{s.total > 0 ? Math.round((bp.count / s.total) * 100) : 0}%</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
