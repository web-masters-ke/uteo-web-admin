'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { useToast } from '@/lib/toast';
import api, { unwrap } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

interface Application {
  id: string;
  status: string;
  notes: string | null;
  scheduledAt: string | null;
  meetingLink: string | null;
  appliedAt: string;
  user: { id: string; email: string; firstName?: string; lastName?: string; avatar?: string };
  job: { id: string; title: string; company: { name: string } };
}

type Filter = 'all' | 'today' | 'upcoming' | 'past';

const ic = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/50 focus:border-[#F77B0F]';

export default function InterviewsAdminPage() {
  const { addToast } = useToast();
  const [interviews, setInterviews] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // Schedule/edit modal
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedApp, setSchedApp] = useState<Application | null>(null);
  const [schedDate, setSchedDate] = useState('');
  const [schedLink, setSchedLink] = useState('');
  const [schedNotes, setSchedNotes] = useState('');
  const [schedSaving, setSchedSaving] = useState(false);
  // Recruiter fields
  const [schedInterviewerType, setSchedInterviewerType] = useState<'individual' | 'org'>('individual');
  const [schedInterviewerName, setSchedInterviewerName] = useState('');
  const [schedInterviewerEmail, setSchedInterviewerEmail] = useState('');
  const [schedOrgName, setSchedOrgName] = useState('');
  const [schedFormat, setSchedFormat] = useState<'video' | 'phone' | 'in_person'>('video');
  const [schedDuration, setSchedDuration] = useState('60');
  const [schedLocation, setSchedLocation] = useState('');
  const [schedRound, setSchedRound] = useState('1');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await unwrap<{ items: Application[] }>(api.get('/applications?status=INTERVIEW&limit=100'));
      setInterviews(d.items ?? []);
    } catch { addToast('error', 'Failed to load interviews'); }
    finally { setLoading(false); }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);

  const now = new Date();
  const todayStr = now.toDateString();

  const filtered = interviews.filter(a => {
    if (filter === 'all') return true;
    const dt = a.scheduledAt ? new Date(a.scheduledAt) : null;
    if (filter === 'today') return dt?.toDateString() === todayStr;
    if (filter === 'upcoming') return dt ? dt > now : false;
    if (filter === 'past') return dt ? dt < now : false;
    return true;
  });

  const openDetail = async (app: Application) => {
    setSelectedApp(app);
    setAiQuestions([]);
    setDetailOpen(true);
  };

  const generateQuestions = async (app: Application) => {
    setAiLoading(true);
    try {
      const name = `${app.user.firstName ?? ''} ${app.user.lastName ?? ''}`.trim();
      const qs = await unwrap<string[]>(api.post('/ai/interview-questions', {
        jobTitle: app.job?.title ?? '',
        skills: [],
        candidateName: name,
        notes: app.notes ?? undefined,
      }));
      setAiQuestions(Array.isArray(qs) ? qs : []);
    } catch { addToast('error', 'AI unavailable'); }
    finally { setAiLoading(false); }
  };

  const openSchedule = (app: Application) => {
    setSchedApp(app);
    setSchedDate(app.scheduledAt ? new Date(app.scheduledAt).toISOString().slice(0, 16) : '');
    setSchedLink(app.meetingLink ?? '');
    setSchedNotes(app.notes ?? '');
    setSchedInterviewerType('individual');
    setSchedInterviewerName('');
    setSchedInterviewerEmail('');
    setSchedOrgName('');
    setSchedFormat('video');
    setSchedDuration('60');
    setSchedLocation('');
    setSchedRound('1');
    setScheduleOpen(true);
  };

  const saveSchedule = async () => {
    if (!schedApp) return;
    setSchedSaving(true);
    try {
      await api.patch(`/applications/${schedApp.id}/status`, {
        status: 'INTERVIEW',
        scheduledAt: schedDate || undefined,
        meetingLink: schedLink || undefined,
        notes: schedNotes || undefined,
      });
      addToast('success', 'Interview updated');
      setScheduleOpen(false);
      await load();
    } catch { addToast('error', 'Failed to update'); }
    finally { setSchedSaving(false); }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
  ];

  const stats = {
    total: interviews.length,
    today: interviews.filter(a => a.scheduledAt && new Date(a.scheduledAt).toDateString() === todayStr).length,
    upcoming: interviews.filter(a => a.scheduledAt && new Date(a.scheduledAt) > now).length,
    withLink: interviews.filter(a => a.meetingLink).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Interviews" subtitle="All scheduled interview sessions across the platform" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900 dark:text-white' },
          { label: 'Today', value: stats.today, color: 'text-[#F77B0F]' },
          { label: 'Upcoming', value: stats.upcoming, color: 'text-green-600' },
          { label: 'With Video Link', value: stats.withLink, color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">{s.label}</p>
            <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${filter === f.key ? 'bg-[#F77B0F] text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <p className="text-sm font-medium">No interviews {filter !== 'all' ? `for "${filter}"` : ''}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Candidate</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Job</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Scheduled</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Meeting</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map(a => {
                const name = `${a.user.firstName ?? ''} ${a.user.lastName ?? ''}`.trim() || a.user.email;
                const isPast = a.scheduledAt ? new Date(a.scheduledAt) < now : false;
                return (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 shrink-0 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-500">
                          {a.user.avatar ? <img src={a.user.avatar} alt="" className="w-full h-full object-cover" /> : name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{name}</p>
                          <p className="text-xs text-gray-400">{a.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-900 dark:text-white">{a.job?.title}</p>
                      <p className="text-xs text-gray-400">{a.job?.company?.name}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      {a.scheduledAt ? (
                        <span className={`text-sm font-medium ${isPast ? 'text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                          {formatDateTime(a.scheduledAt)}
                        </span>
                      ) : <span className="text-xs text-gray-400 italic">Not set</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      {a.meetingLink ? (
                        <a href={a.meetingLink} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-xs font-semibold text-[#F77B0F] hover:underline">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.361a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" /></svg>
                          Join
                        </a>
                      ) : <span className="text-xs text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openDetail(a)} className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-[#F77B0F] transition-colors">View</button>
                        <button onClick={() => openSchedule(a)} className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-[#F77B0F] transition-colors">Edit</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail Modal */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title="Interview Detail" size="lg">
        {selectedApp && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Candidate</p><p className="font-semibold">{`${selectedApp.user.firstName ?? ''} ${selectedApp.user.lastName ?? ''}`.trim()}</p><p className="text-xs text-gray-400">{selectedApp.user.email}</p></div>
              <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Position</p><p className="font-semibold">{selectedApp.job?.title}</p><p className="text-xs text-gray-400">{selectedApp.job?.company?.name}</p></div>
              <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Scheduled</p><p className="font-semibold">{selectedApp.scheduledAt ? formatDateTime(selectedApp.scheduledAt) : 'Not set'}</p></div>
              <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Meeting Link</p>{selectedApp.meetingLink ? <a href={selectedApp.meetingLink} target="_blank" rel="noopener noreferrer" className="text-[#F77B0F] font-semibold hover:underline text-xs break-all">{selectedApp.meetingLink}</a> : <p className="text-gray-400 text-xs">None</p>}</div>
            </div>
            {selectedApp.notes && <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300"><p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Notes</p>{selectedApp.notes}</div>}

            {/* AI Questions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900 dark:text-white">✨ AI Interview Questions</p>
                <button onClick={() => generateQuestions(selectedApp)} disabled={aiLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F77B0F]/10 text-[#F77B0F] text-xs font-semibold hover:bg-[#F77B0F]/20 transition-colors disabled:opacity-50">
                  {aiLoading ? <><span className="w-3 h-3 border-2 border-[#F77B0F]/30 border-t-[#F77B0F] rounded-full animate-spin" />Generating…</> : 'Generate Questions'}
                </button>
              </div>
              {aiQuestions.length > 0 && (
                <ol className="space-y-2">
                  {aiQuestions.map((q, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="w-6 h-6 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{q}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Schedule/Edit Modal */}
      <Modal open={scheduleOpen} onClose={() => setScheduleOpen(false)} title="Schedule Interview" size="lg">
        <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
          {schedApp && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-xs font-bold text-[#F77B0F]">
                {(schedApp.user.firstName?.[0] ?? '') + (schedApp.user.lastName?.[0] ?? '')}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{`${schedApp.user.firstName ?? ''} ${schedApp.user.lastName ?? ''}`.trim()}</p>
                <p className="text-xs text-gray-400">{schedApp.job?.title} · {schedApp.job?.company?.name}</p>
              </div>
            </div>
          )}

          {/* Section: Interview Details */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Interview Details</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Round</label>
                  <select value={schedRound} onChange={e => setSchedRound(e.target.value)} className={ic}>
                    {['1','2','3','4'].map(r => <option key={r} value={r}>Round {r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Duration (minutes)</label>
                  <select value={schedDuration} onChange={e => setSchedDuration(e.target.value)} className={ic}>
                    {['30','45','60','90','120'].map(d => <option key={d} value={d}>{d} min</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Format</label>
                <div className="flex gap-2">
                  {[{v:'video',l:'Video Call'},{v:'phone',l:'Phone'},{v:'in_person',l:'In Person'}].map(f => (
                    <button key={f.v} type="button" onClick={() => setSchedFormat(f.v as any)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${schedFormat === f.v ? 'bg-[#F77B0F] text-white border-[#F77B0F]' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#F77B0F]'}`}>
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div><label className="block text-xs font-semibold text-gray-500 mb-1">Scheduled Date & Time <span className="text-red-500">*</span></label><input type="datetime-local" value={schedDate} onChange={e => setSchedDate(e.target.value)} className={ic} /></div>

              {schedFormat === 'video' && (
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Meeting Link</label><input value={schedLink} onChange={e => setSchedLink(e.target.value)} className={ic} placeholder="https://meet.jit.si/room-name" /></div>
              )}
              {schedFormat === 'in_person' && (
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Location / Address</label><input value={schedLocation} onChange={e => setSchedLocation(e.target.value)} className={ic} placeholder="Office address or venue" /></div>
              )}
            </div>
          </div>

          {/* Section: Interviewer */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Interviewer</p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-2">Interviewer Type</label>
                <div className="flex gap-2">
                  {[{v:'individual',l:'Individual Recruiter'},{v:'org',l:'Organisation / Company'}].map(t => (
                    <button key={t.v} type="button" onClick={() => setSchedInterviewerType(t.v as any)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${schedInterviewerType === t.v ? 'bg-[#F77B0F] text-white border-[#F77B0F]' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-[#F77B0F]'}`}>
                      {t.l}
                    </button>
                  ))}
                </div>
              </div>

              {schedInterviewerType === 'org' && (
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Organisation / Company Name</label><input value={schedOrgName} onChange={e => setSchedOrgName(e.target.value)} className={ic} placeholder="e.g. Kakai Ventures Ltd" /></div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Interviewer Name</label><input value={schedInterviewerName} onChange={e => setSchedInterviewerName(e.target.value)} className={ic} placeholder="John Doe" /></div>
                <div><label className="block text-xs font-semibold text-gray-500 mb-1">Interviewer Email</label><input type="email" value={schedInterviewerEmail} onChange={e => setSchedInterviewerEmail(e.target.value)} className={ic} placeholder="john@company.com" /></div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">Notes & Instructions</p>
            <textarea value={schedNotes} onChange={e => setSchedNotes(e.target.value)} className={ic} rows={3} placeholder="Preparation notes, topics to cover, dress code, parking info…" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={() => setScheduleOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            <button onClick={saveSchedule} disabled={schedSaving} className="flex-1 py-2.5 rounded-xl bg-[#F77B0F] text-white text-sm font-bold hover:bg-[#e06a0d] disabled:opacity-40 transition-colors">
              {schedSaving ? 'Saving…' : 'Save Interview'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
