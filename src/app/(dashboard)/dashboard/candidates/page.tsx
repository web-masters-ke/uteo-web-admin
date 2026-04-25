'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/lib/toast';
import api, { unwrap } from '@/lib/api';

interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  email: string;
  headline: string | null;
  location: string | null;
  resumeUrl: string | null;
  skills: { id: string; name: string }[];
  matchedSkills: string[];
  matchScore: number;
  applied?: boolean;
}

interface Job { id: string; title: string; company: { name: string } }

const STATUS_OPTS = [
  { value: 'SUBMITTED', label: 'Applied' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'SHORTLISTED', label: 'Shortlisted' },
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'HIRED', label: 'Hired' },
  { value: 'REJECTED', label: 'Rejected' },
];

const ic = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/50 focus:border-[#F77B0F]';

function ScoreBar({ score }: { score: number }) {
  const max = 100;
  const pct = Math.min(score / max, 1);
  const color = pct >= 0.7 ? 'bg-green-500' : pct >= 0.4 ? 'bg-[#F77B0F]' : 'bg-gray-300';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.round(pct * 100)}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-500 w-7 text-right">{score}</span>
    </div>
  );
}

export default function CandidatesAdminPage() {
  const { addToast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [aiInsights, setAiInsights] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Add candidate form
  const [addEmail, setAddEmail] = useState('');
  const [addFirst, setAddFirst] = useState('');
  const [addLast, setAddLast] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addJobId, setAddJobId] = useState('');
  const [addStatus, setAddStatus] = useState('SUBMITTED');
  const [addNotes, setAddNotes] = useState('');
  const [addExisting, setAddExisting] = useState(false);
  const [addSaving, setAddSaving] = useState(false);

  useEffect(() => {
    setLoadingJobs(true);
    unwrap<{ items: Job[] }>(api.get('/jobs?limit=100')).then(d => {
      setJobs(d.items ?? []);
      if ((d.items ?? []).length > 0) setSelectedJobId(d.items[0].id);
    }).catch(() => {}).finally(() => setLoadingJobs(false));
  }, []);

  const loadCandidates = useCallback(async (jobId: string) => {
    if (!jobId) return;
    setLoading(true);
    try {
      const d = await unwrap<{ items: Candidate[] }>(api.get(`/jobs/${jobId}/candidates`));
      const list = d.items ?? [];
      setCandidates(list);
      // AI insights for first 5
      list.slice(0, 5).forEach(async (c) => {
        if (aiInsights[c.id]) return;
        const job = jobs.find(j => j.id === jobId);
        try {
          const insight = await unwrap<string>(api.post('/ai/candidate-insight', {
            candidateName: `${c.firstName} ${c.lastName}`.trim(),
            headline: c.headline,
            skills: c.skills.map(s => s.name),
            matchedSkills: c.matchedSkills,
            jobTitle: job?.title ?? '',
          }));
          if (insight) setAiInsights(prev => ({ ...prev, [c.id]: insight }));
        } catch { /* silent */ }
      });
    } catch { addToast('error', 'Failed to load candidates'); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, addToast]);

  useEffect(() => {
    if (selectedJobId) loadCandidates(selectedJobId);
  }, [selectedJobId, refreshKey, loadCandidates]);

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim() || !addFirst.trim()) { addToast('error', 'Email and first name required'); return; }
    setAddSaving(true);
    try {
      await api.post('/applications/manual', {
        candidateEmail: addEmail.trim().toLowerCase(),
        candidateFirstName: addFirst.trim(),
        candidateLastName: addLast.trim() || undefined,
        candidatePhone: addPhone.trim() || undefined,
        candidatePassword: addPassword || undefined,
        jobId: addJobId || undefined,
        status: addJobId ? addStatus : undefined,
        notes: addNotes.trim() || undefined,
      });
      addToast('success', addJobId ? 'Candidate added and linked to job' : 'Candidate created');
      setShowAddModal(false);
      setAddEmail(''); setAddFirst(''); setAddLast(''); setAddPhone(''); setAddPassword(''); setAddJobId(''); setAddNotes(''); setAddExisting(false);
      if (addJobId) { setSelectedJobId(addJobId); } else { setRefreshKey(k => k + 1); }
    } catch (err: any) {
      addToast('error', err?.response?.data?.error?.message ?? 'Failed to add candidate');
    } finally { setAddSaving(false); }
  };

  const statusColor: Record<string, string> = {
    SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    REVIEWED: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    SHORTLISTED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    INTERVIEW: 'bg-[#F77B0F]/10 text-[#F77B0F]',
    HIRED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    REJECTED: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        subtitle="AI-ranked talent matched against your job requirements"
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#F77B0F] text-white text-sm font-semibold rounded-xl hover:bg-[#e06a0d] transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add Candidate
          </button>
        }
      />

      {/* Job selector */}
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1.5">Match Against Job</label>
            {loadingJobs ? (
              <div className="h-9 rounded-lg bg-gray-100 dark:bg-gray-700 animate-pulse" />
            ) : (
              <select value={selectedJobId} onChange={e => setSelectedJobId(e.target.value)} className={ic}>
                <option value="">Select a job…</option>
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company?.name}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 pt-5">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500" />Strong (70+)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#F77B0F]" />Good (40–69)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" />Partial (&lt;40)</span>
          </div>
        </div>
      </div>

      {/* Candidates table */}
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-3 border-[#F77B0F] border-t-transparent rounded-full animate-spin" /></div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <p className="text-sm font-medium">{selectedJobId ? 'No candidates found for this job' : 'Select a job to view candidates'}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Skills</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest w-36">Match</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">AI Insight</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {candidates.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0 overflow-hidden flex items-center justify-center text-gray-500 font-bold text-xs">
                        {c.avatar ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white">{c.firstName} {c.lastName}</p>
                          {c.applied && <span className="px-1.5 py-0.5 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] text-[10px] font-bold">Applied</span>}
                        </div>
                        <p className="text-xs text-gray-400">{c.email}</p>
                        {c.headline && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.headline}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {c.matchedSkills.slice(0, 3).map(s => (
                        <span key={s} className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-[10px] font-medium">✓ {s}</span>
                      ))}
                      {c.skills.filter(s => !c.matchedSkills.includes(s.name)).slice(0, 2).map(s => (
                        <span key={s.id} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 text-[10px]">{s.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 w-36"><ScoreBar score={c.matchScore} /></td>
                  <td className="px-4 py-3.5 max-w-[200px]">
                    {aiInsights[c.id] ? (
                      <p className="text-xs italic text-gray-400 dark:text-gray-500 leading-relaxed">{aiInsights[c.id]}</p>
                    ) : (
                      <button
                        onClick={async () => {
                          const job = jobs.find(j => j.id === selectedJobId);
                          try {
                            const insight = await unwrap<string>(api.post('/ai/candidate-insight', {
                              candidateName: `${c.firstName} ${c.lastName}`.trim(),
                              headline: c.headline,
                              skills: c.skills.map(s => s.name),
                              matchedSkills: c.matchedSkills,
                              jobTitle: job?.title ?? '',
                            }));
                            if (insight) setAiInsights(prev => ({ ...prev, [c.id]: insight }));
                          } catch { /* silent */ }
                        }}
                        className="text-xs text-[#F77B0F] hover:underline flex items-center gap-1"
                      >
                        <span>✨</span> Get insight
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {c.applied ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Applied</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">Open to Work</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Candidate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Add Candidate</h2>
                <p className="text-xs text-gray-500 mt-0.5">Create an account and optionally link to a job</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={submitAdd} className="px-6 py-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Toggle */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <button type="button" onClick={() => { setAddExisting(!addExisting); setAddPassword(''); }}
                  className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${addExisting ? 'bg-[#F77B0F]' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${addExisting ? 'left-4' : 'left-0.5'}`} />
                </button>
                <span className="text-sm text-gray-700 dark:text-gray-300">{addExisting ? 'Existing user (no password needed)' : 'New user account'}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">First Name <span className="text-red-500">*</span></label><input value={addFirst} onChange={e => setAddFirst(e.target.value)} className={ic} placeholder="Jane" required /></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Last Name</label><input value={addLast} onChange={e => setAddLast(e.target.value)} className={ic} placeholder="Doe" /></div>
              </div>
              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Email <span className="text-red-500">*</span></label><input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} className={ic} placeholder="jane@example.com" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label><input value={addPhone} onChange={e => setAddPhone(e.target.value)} className={ic} placeholder="+254 700 000 000" /></div>
                {!addExisting && <div><label className="block text-xs font-semibold text-gray-500 mb-1">Temp Password</label><input type="password" value={addPassword} onChange={e => setAddPassword(e.target.value)} className={ic} placeholder="Min 6 chars" /></div>}
              </div>

              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Link to Job (optional)</label>
                <select value={addJobId} onChange={e => setAddJobId(e.target.value)} className={ic}>
                  <option value="">No job link</option>
                  {jobs.map(j => <option key={j.id} value={j.id}>{j.title} — {j.company?.name}</option>)}
                </select>
              </div>

              {addJobId && (
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-2">Application Status</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTS.map(s => (
                      <button key={s.value} type="button" onClick={() => setAddStatus(s.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${addStatus === s.value ? 'bg-[#F77B0F] text-white border-[#F77B0F]' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#F77B0F]'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label><textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} className={ic} rows={2} placeholder="Internal notes about this candidate…" /></div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
                <button type="submit" disabled={addSaving} className="flex-1 py-2.5 rounded-xl bg-[#F77B0F] text-white text-sm font-bold hover:bg-[#e06a0d] disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
                  {addSaving ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Adding…</> : (addJobId ? 'Add Candidate + Create Application' : 'Add Candidate')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
