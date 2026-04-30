'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import api from '@/lib/api';
import { useToast } from '@/lib/toast';
import { formatDateTime } from '@/lib/utils';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  updatedAt: string;
}

const PRESET_FLAGS = [
  { key: 'ai_ranking', label: 'AI Candidate Ranking', desc: 'Use AI to rank candidates by job fit score' },
  { key: 'ai_interview_questions', label: 'AI Interview Questions', desc: 'Auto-generate interview questions using our AI' },
  { key: 'ai_career_advisor', label: 'AI Career Advisor Chat', desc: 'Floating AI chat advisor for job seekers' },
  { key: 'job_alerts_email', label: 'Job Match Email Alerts', desc: 'Email notifications for new job matches' },
  { key: 'job_alerts_push', label: 'Job Match Push Notifications', desc: 'Push notifications for new job matches' },
  { key: 'video_interviews', label: 'Video Interview Integration', desc: 'Allow in-platform video interviews' },
  { key: 'resume_parsing', label: 'Resume / CV Parsing', desc: 'Auto-extract skills from uploaded CVs' },
  { key: 'public_profiles', label: 'Public Candidate Profiles', desc: 'Allow candidates to make profiles publicly visible' },
  { key: 'skills_assessment', label: 'Skills Assessment Tests', desc: 'Recruiter-assigned skill quizzes for candidates' },
  { key: 'referral_program', label: 'Referral Program', desc: 'Candidate-to-candidate referral incentives' },
  { key: 'salary_insights', label: 'Salary Insights Widget', desc: 'Show market salary range on job listings' },
  { key: 'maintenance_mode', label: 'Maintenance Mode', desc: 'Block all logins and show maintenance page' },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-[#F77B0F]' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

export default function FeatureFlagsPage() {
  const { addToast } = useToast();
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [updatedAt, setUpdatedAt] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [showNewFlag, setShowNewFlag] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newEnabled, setNewEnabled] = useState(false);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/feature-flags');
      const data: FeatureFlag[] = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data) ? res.data : []);
      const map: Record<string, boolean> = {};
      const ts: Record<string, string> = {};
      data.forEach(f => {
        const shortKey = f.key.replace(/^flag\./, '');
        map[shortKey] = f.enabled;
        ts[shortKey] = f.updatedAt;
      });
      setFlags(map);
      setUpdatedAt(ts);
    } catch {
      addToast('error', 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const toggle = async (key: string, value: boolean) => {
    setSaving(key);
    try {
      await api.post(`/admin/feature-flags/${key}`, { enabled: value });
      setFlags(prev => ({ ...prev, [key]: value }));
      setUpdatedAt(prev => ({ ...prev, [key]: new Date().toISOString() }));
      addToast('success', `${key} ${value ? 'enabled' : 'disabled'}`);
    } catch {
      addToast('error', 'Failed to update flag');
    } finally {
      setSaving(null);
    }
  };

  const addCustomFlag = async () => {
    if (!newKey.trim()) return;
    const k = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    await toggle(k, newEnabled);
    setNewKey(''); setNewEnabled(false); setShowNewFlag(false);
  };

  const ic = 'w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/30';

  return (
    <div>
      <PageHeader
        title="Feature Flags"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Feature Flags' }]}
        actions={
          <button
            onClick={() => setShowNewFlag(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#F77B0F] text-white text-sm font-semibold rounded-lg hover:bg-[#e06a0d] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Flag
          </button>
        }
      />
      <p className="text-sm text-muted-foreground -mt-4 mb-6">Toggle platform features on or off without redeploying. Changes take effect immediately.</p>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {PRESET_FLAGS.map(f => {
            const isOn = flags[f.key] ?? false;
            return (
              <div key={f.key} className={`rounded-xl border p-4 transition-all ${isOn ? 'border-[#F77B0F]/40 bg-[#F77B0F]/5' : 'border-border bg-card'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-card-foreground truncate">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                    {updatedAt[f.key] && (
                      <p className="text-[10px] text-muted-foreground mt-2">Updated {formatDateTime(updatedAt[f.key])}</p>
                    )}
                  </div>
                  <div className={saving === f.key ? 'opacity-50 pointer-events-none' : ''}>
                    <Toggle checked={isOn} onChange={v => toggle(f.key, v)} />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Custom flags from DB not in preset */}
          {Object.entries(flags)
            .filter(([k]) => !PRESET_FLAGS.find(f => f.key === k))
            .map(([k, v]) => (
              <div key={k} className={`rounded-xl border p-4 transition-all ${v ? 'border-[#F77B0F]/40 bg-[#F77B0F]/5' : 'border-border bg-card'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-card-foreground font-mono">{k}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Custom flag</p>
                    {updatedAt[k] && <p className="text-[10px] text-muted-foreground mt-2">Updated {formatDateTime(updatedAt[k])}</p>}
                  </div>
                  <div className={saving === k ? 'opacity-50 pointer-events-none' : ''}>
                    <Toggle checked={v} onChange={val => toggle(k, val)} />
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* New custom flag dialog */}
      {showNewFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-bold text-card-foreground mb-4">Add Custom Flag</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Flag Key</label>
                <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="e.g. beta_feature" className={ic} />
                <p className="text-[10px] text-muted-foreground mt-1">Spaces become underscores, auto-lowercased</p>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Enable immediately</span>
                <Toggle checked={newEnabled} onChange={setNewEnabled} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowNewFlag(false)} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
              <button onClick={addCustomFlag} className="flex-1 py-2 rounded-lg bg-[#F77B0F] text-white text-sm font-semibold hover:bg-[#e06a0d] transition-colors">Add Flag</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
