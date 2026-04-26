'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  appliedForJob?: { title: string; company: string; status: string };
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

const LIMIT = 20;

const ic = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/50 focus:border-[#F77B0F]';

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(score / 100, 1);
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

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Refs to avoid stale closures in loadCandidates
  const jobsRef = useRef<Job[]>([]);
  const aiInsightsRef = useRef<Record<string, string>>({});
  // Cache per-job full list so page flips don't re-fetch
  const jobCacheRef = useRef<{ jobId: string; items: Candidate[] } | null>(null);

  // Add candidate form state
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
    api.get('/jobs?limit=100').then(res => unwrap<{ items: Job[] }>(res)).then(d => {
      const list = d.items ?? [];
      setJobs(list);
      jobsRef.current = list;
    }).catch(() => {}).finally(() => setLoadingJobs(false));
  }, []);

  const loadCandidates = useCallback(async (jobId: string, pg: number) => {
    setLoading(true);
    try {
      if (!jobId) {
        // All Jobs: server-side pagination through /applications
        const d = await unwrap<{ items: any[]; total: number }>(
          await api.get(`/applications?page=${pg}&limit=${LIMIT}`)
        );
        const list: Candidate[] = (d.items ?? []).map((app: any) => ({
          id: app.user?.id ?? app.id,
          firstName: app.user?.firstName ?? '',
          lastName: app.user?.lastName ?? '',
          avatar: app.user?.avatar ?? null,
          email: app.user?.email ?? '',
          headline: null,
          location: app.job?.location ?? null,
          resumeUrl: app.resumeUrl ?? null,
          skills: [],
          matchedSkills: [],
          matchScore: 0,
          applied: true,
          appliedForJob: {
            title: app.job?.title ?? '—',
            company: app.job?.company?.name ?? '—',
            status: app.status ?? '',
          },
        }));
        setCandidates(list);
        setTotal(d.total ?? 0);
        // No AI insights in All Jobs mode — no job context to match against
      } else {
        // Per-job: fetch once, paginate client-side
        let all: Candidate[];
        if (jobCacheRef.current?.jobId === jobId) {
          all = jobCacheRef.current.items;
        } else {
          const d = await unwrap<{ items: Candidate[] }>(await api.get(`/jobs/${jobId}/candidates`));
          all = d.items ?? [];
          jobCacheRef.current = { jobId, items: all };
        }
        setTotal(all.length);
        setCandidates(all.slice((pg - 1) * LIMIT, pg * LIMIT));

        // AI insights for first 5 candidates on page 1, only when a job is selected
        if (pg === 1) {
          const job = jobsRef.current.find(j => j.id === jobId);
          const jobTitle = job?.title || 'this position';
          all.slice(0, 5).forEach(async (c) => {
            if (aiInsightsRef.current[c.id]) return;
            const name = `${c.firstName} ${c.lastName}`.trim() || 'Candidate';
            try {
              const insight = await unwrap<string>(await api.post('/ai/candidate-insight', {
                candidateName: name,
                headline: c.headline,
                skills: c.skills.map(s => s.name),
                matchedSkills: c.matchedSkills,
                jobTitle,
              }));
              if (insight) {
                aiInsightsRef.current = { ...aiInsightsRef.current, [c.id]: insight };
                setAiInsights(prev => ({ ...prev, [c.id]: insight }));
              }
            } catch { /* silent — AI is best-effort */ }
          });
        }
      }
    } catch { addToast('error', 'Failed to load candidates'); }
    finally { setLoading(false); }
  }, [addToast]);

  // When job selection or refresh changes: reset to page 1 and clear cache
  useEffect(() => {
    setPage(1);
    jobCacheRef.current = null;
    loadCandidates(selectedJobId, 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, refreshKey]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    loadCandidates(selectedJobId, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
      setAddEmail(''); setAddFirst(''); setAddLast(''); setAddPhone('');
      setAddPassword(''); setAddJobId(''); setAddNotes(''); setAddExisting(false);
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
            className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline transition-opacity"
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
                <option value="">— All Jobs (all applicants) —</option>
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
            <p className="text-sm font-medium">{selectedJobId ? 'No candidates found for this job' : 'No applications yet'}</p>
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Candidate</th>
                  {!selectedJobId
                    ? <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Applied For</th>
                    : <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Skills</th>
                  }
                  {selectedJobId && <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest w-36">Match</th>}
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">AI Insight</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {candidates.map(c => (
                  <tr key={`${c.id}-${c.appliedForJob?.title ?? ''}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0 overflow-hidden flex items-center justify-center text-gray-500 font-bold text-xs">
                          {c.avatar ? <img src={c.avatar} alt="" className="w-full h-full object-cover" /> : `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-gray-400">{c.email}</p>
                          {c.headline && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.headline}</p>}
                        </div>
                      </div>
                    </td>
                    {!selectedJobId ? (
                      <td className="px-4 py-3.5">
                        <p className="font-medium text-gray-900 dark:text-white text-xs">{c.appliedForJob?.title}</p>
                        <p className="text-[10px] text-gray-400">{c.appliedForJob?.company}</p>
                      </td>
                    ) : (
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
                    )}
                    {selectedJobId && <td className="px-4 py-3.5 w-36"><ScoreBar score={c.matchScore} /></td>}
                    <td className="px-4 py-3.5 max-w-[200px]">
                      {!selectedJobId ? (
                        <span className="text-xs text-gray-300 dark:text-gray-600 italic">—</span>
                      ) : aiInsights[c.id] ? (
                        <p className="text-xs italic text-gray-400 dark:text-gray-500 leading-relaxed">{aiInsights[c.id]}</p>
                      ) : (
                        <button
                          onClick={async () => {
                            const job = jobsRef.current.find(j => j.id === selectedJobId);
                            const jobTitle = job?.title || 'this position';
                            const name = `${c.firstName} ${c.lastName}`.trim() || 'Candidate';
                            try {
                              const insight = await unwrap<string>(await api.post('/ai/candidate-insight', {
                                candidateName: name,
                                headline: c.headline,
                                skills: c.skills.map(s => s.name),
                                matchedSkills: c.matchedSkills,
                                jobTitle,
                              }));
                              if (insight) {
                                aiInsightsRef.current = { ...aiInsightsRef.current, [c.id]: insight };
                                setAiInsights(prev => ({ ...prev, [c.id]: insight }));
                              }
                            } catch { /* silent */ }
                          }}
                          className="text-xs text-[#F77B0F] hover:underline flex items-center gap-1"
                        >
                          <span>✨</span> Get insight
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {c.appliedForJob?.status ? (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[c.appliedForJob.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {c.appliedForJob.status.charAt(0) + c.appliedForJob.status.slice(1).toLowerCase()}
                        </span>
                      ) : c.applied ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Applied</span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">Open to Work</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination controls */}
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {total} total · showing {((page - 1) * LIMIT) + 1}–{Math.min(page * LIMIT, total)}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Prev
                </button>
                <span className="px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </>
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

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Link to Job (optional)</label>
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
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all ${addStatus === s.value ? 'border-[#F77B0F] bg-[#F77B0F]/5 text-[#F77B0F]' : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Notes</label><textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} className={ic} rows={2} placeholder="Internal notes about this candidate…" /></div>

              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Cancel</button>
                <button type="submit" disabled={addSaving} className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-40 transition-opacity">
                  {addSaving ? <><span className="w-3.5 h-3.5 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" />Adding…</> : (addJobId ? 'Add Candidate + Create Application →' : 'Add Candidate →')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
