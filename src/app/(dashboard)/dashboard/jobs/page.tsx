'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { jobService, AdminJob, HiringStage, CreateJobPayload } from '@/lib/services/jobService';
import { companyService, AdminCompany } from '@/lib/services/companyService';
import { skillService } from '@/lib/services/skillService';
import { userService } from '@/lib/services/userService';
import { useToast } from '@/lib/toast';
import { formatDate } from '@/lib/utils';
import { Skill } from '@/lib/types';

// All inputs use orange focus — matching the recruiter client exactly
const inp = 'w-full px-4 py-2.5 rounded-xl border border-border bg-card text-card-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] transition-colors';
const lbl = 'block text-sm font-medium text-muted-foreground mb-1.5';
const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

const DEFAULT_STAGES: HiringStage[] = [
  { order: 1, name: 'Application Review', description: 'Initial screening of applications' },
  { order: 2, name: 'Phone / Video Screen', description: 'Short 15–30 min introductory call' },
  { order: 3, name: 'Technical Assessment', description: 'Skills test or take-home task' },
  { order: 4, name: 'Final Interview', description: 'In-depth interview with the team' },
  { order: 5, name: 'Offer', description: 'Extend offer to successful candidate' },
];

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-card-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ── Post Job Drawer ──────────────────────────────────────────────────────────

interface PostJobDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function PostJobDrawer({ open, onClose, onCreated }: PostJobDrawerProps) {
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(0);

  // Form
  const [form, setForm] = useState({ title: '', companyId: '', description: '', requirements: '', jobType: 'FULL_TIME', location: '', experienceLevel: '', salaryMin: '', salaryMax: '', currency: 'KES', expiresAt: '', recruiterId: '', status: 'ACTIVE' });
  const setF = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  // Company mode
  const [companyMode, setCompanyMode] = useState<'select' | 'new'>('select');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [companies, setCompanies] = useState<AdminCompany[]>([]);
  const [companySearch, setCompanySearch] = useState('');
  const [companyDropOpen, setCompanyDropOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<AdminCompany | null>(null);

  // Skills
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<Skill[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [addingSkill, setAddingSkill] = useState(false);

  // Hiring stages
  const [stages, setStages] = useState<HiringStage[]>(DEFAULT_STAGES.map(s => ({ ...s })));
  const [editingStage, setEditingStage] = useState<number | null>(null);

  // Users (for recruiter assignment)
  const [users, setUsers] = useState<{ id: string; email: string; firstName?: string; lastName?: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    setActiveSection(0);
    setError(null);
    setForm({ title: '', companyId: '', description: '', requirements: '', jobType: 'FULL_TIME', location: '', experienceLevel: '', salaryMin: '', salaryMax: '', currency: 'KES', expiresAt: '', recruiterId: '', status: 'ACTIVE' });
    setCompanyMode('select');
    setNewCompanyName('');
    setCompanySearch('');
    setCompanyDropOpen(false);
    setSelectedCompany(null);
    setSelectedSkills([]);
    setSkillSearch('');
    setStages(DEFAULT_STAGES.map(s => ({ ...s })));
    setEditingStage(null);

    Promise.all([
      skillService.getAll(),
      companyService.list({ limit: 100 }),
      userService.getAll({ limit: 100 }),
    ]).then(([skills, co, us]) => {
      setAllSkills(skills);
      setCompanies(co.items ?? []);
      setUsers((us.items ?? []) as any[]);
      if ((co.items ?? []).length === 0) setCompanyMode('new');
    }).catch(() => {});
  }, [open]);

  const filteredSkills = allSkills.filter(s =>
    s.name.toLowerCase().includes(skillSearch.toLowerCase()) &&
    !selectedSkills.find(x => x.id === s.id)
  );

  const toggleSkill = (s: Skill) => {
    setSelectedSkills(p => p.find(x => x.id === s.id) ? p.filter(x => x.id !== s.id) : [...p, s]);
    setSkillSearch('');
  };

  const addNewSkill = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (selectedSkills.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) { setSkillSearch(''); return; }
    setAddingSkill(true);
    try {
      const created = await skillService.create({ name: trimmed });
      const skill: Skill = { ...(created as any), id: (created as any).id, name: (created as any).name ?? trimmed };
      setSelectedSkills(p => [...p, skill]);
      setAllSkills(p => p.some(s => s.id === skill.id) ? p : [...p, skill]);
      setSkillSearch('');
    } catch { /* silent */ } finally { setAddingSkill(false); }
  };

  // Stage helpers
  const addStage = () => {
    const next = stages.length;
    setStages(p => [...p, { order: p.length + 1, name: '', description: '' }]);
    setEditingStage(next);
  };
  const removeStage = (idx: number) => {
    setStages(p => p.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
    if (editingStage === idx) setEditingStage(null);
  };
  const updateStage = (idx: number, field: 'name' | 'description', val: string) => {
    setStages(p => p.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };
  const moveStage = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= stages.length) return;
    setStages(p => {
      const arr = [...p];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const sections = ['Basic Info', 'Details', 'Compensation', 'Skills', 'Hiring Pipeline', 'Publish'];

  const handleSubmit = async () => {
    setError(null);
    if (!form.title.trim()) { setError('Job title is required'); setActiveSection(0); return; }
    if (companyMode === 'select' && !form.companyId) { setError('Please select a company'); setActiveSection(0); return; }
    if (companyMode === 'new' && !newCompanyName.trim()) { setError('Please enter a company name'); setActiveSection(0); return; }
    if (!form.description.trim()) { setError('Job description is required'); setActiveSection(1); return; }
    const badStage = stages.find(s => !s.name.trim());
    if (badStage) { setError('All hiring stages must have a name'); setActiveSection(4); return; }

    setSubmitting(true);
    try {
      let companyId = form.companyId;
      if (companyMode === 'new') {
        const created = await companyService.create({ name: newCompanyName.trim() });
        companyId = (created as any)?.id;
        if (!companyId) throw new Error('Failed to create company');
      }

      const payload: CreateJobPayload = {
        companyId,
        title: form.title.trim(),
        description: form.description.trim(),
        requirements: form.requirements.trim() || undefined,
        jobType: form.jobType || undefined,
        location: form.location.trim() || undefined,
        experienceLevel: form.experienceLevel || undefined,
        salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
        currency: form.currency || undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
        skillIds: selectedSkills.map(s => s.id),
        hiringStages: stages,
        postedById: form.recruiterId || undefined,
        status: form.status || undefined,
      };
      await jobService.create(payload);
      addToast('success', 'Job posted successfully');
      onCreated();
      onClose();
    } catch (e: any) {
      const msg = e?.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(' · ') : msg || e?.message || 'Failed to post job');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-background border-l border-border flex flex-col h-full shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-card-foreground">Post New Job</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create a listing on behalf of a company</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Section tabs — orange underline, matching client */}
        <div className="flex items-center gap-1 px-6 py-2.5 border-b border-border overflow-x-auto shrink-0">
          {sections.map((s, i) => (
            <button key={s} onClick={() => setActiveSection(i)}
              className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 rounded-none ${
                activeSection === i
                  ? 'border-[#F77B0F] text-[#F77B0F] font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
            >
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-sm text-red-600 dark:text-red-400">{error}</div>
          )}

          {/* ── 1. Basic Info ── */}
          {activeSection === 0 && (
            <>
              <SectionCard title="1. Basic Information" subtitle="The essentials that appear at the top of your listing">
                <div>
                  <label className={lbl}>Job Title <span className="text-red-500">*</span></label>
                  <input value={form.title} onChange={e => setF('title', e.target.value)} placeholder="e.g. Senior Frontend Engineer, Product Manager…" className={inp} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Company <span className="text-red-500">*</span></label>
                    {companies.length > 0 && (
                      <button type="button" onClick={() => {
                        setCompanyMode(m => m === 'select' ? 'new' : 'select');
                        setNewCompanyName('');
                        setF('companyId', '');
                        setSelectedCompany(null);
                        setCompanySearch('');
                      }} className="text-xs font-medium text-[#F77B0F] hover:underline">
                        {companyMode === 'select' ? '+ Add company' : '← Select existing'}
                      </button>
                    )}
                  </div>
                  {companyMode === 'new' || companies.length === 0 ? (
                    <>
                      <input value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Company name e.g. Safaricom, Andela…" autoFocus={companyMode === 'new'} className={inp} />
                      <p className="mt-1.5 text-xs text-muted-foreground">A new company profile will be created and added to the platform.</p>
                    </>
                  ) : (
                    <div className="relative">
                      {/* Selected company pill */}
                      {selectedCompany ? (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#F77B0F] bg-card">
                          <div className="w-6 h-6 rounded bg-[#F77B0F]/10 flex items-center justify-center text-[10px] font-bold text-[#F77B0F] shrink-0">
                            {selectedCompany.name[0]?.toUpperCase()}
                          </div>
                          <span className="flex-1 text-sm font-medium text-card-foreground">{selectedCompany.name}</span>
                          {selectedCompany.isVerified && <span className="text-xs text-blue-500">✓ Verified</span>}
                          <button type="button" onClick={() => { setSelectedCompany(null); setF('companyId', ''); setCompanySearch(''); }}
                            className="text-muted-foreground hover:text-red-500 transition-colors ml-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <input
                          value={companySearch}
                          onChange={e => { setCompanySearch(e.target.value); setCompanyDropOpen(true); }}
                          onFocus={() => setCompanyDropOpen(true)}
                          onBlur={() => setTimeout(() => setCompanyDropOpen(false), 150)}
                          placeholder="Search companies…"
                          className={inp}
                        />
                      )}
                      {/* Dropdown */}
                      {companyDropOpen && !selectedCompany && (
                        <div className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg max-h-52 overflow-y-auto">
                          {companies
                            .filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase()))
                            .slice(0, 20)
                            .map(c => (
                              <button key={c.id} type="button"
                                onMouseDown={() => { setSelectedCompany(c); setF('companyId', c.id); setCompanySearch(''); setCompanyDropOpen(false); }}
                                className="flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-card-foreground hover:bg-muted border-b border-border last:border-0 transition-colors"
                              >
                                <div className="w-6 h-6 rounded bg-[#F77B0F]/10 flex items-center justify-center text-[10px] font-bold text-[#F77B0F] shrink-0">
                                  {c.name[0]?.toUpperCase()}
                                </div>
                                <span className="flex-1">{c.name}</span>
                                {c.isVerified && <span className="text-xs text-blue-500 shrink-0">✓</span>}
                                {c._count && <span className="text-xs text-muted-foreground shrink-0">{c._count.jobs} jobs</span>}
                              </button>
                            ))}
                          {companies.filter(c => c.name.toLowerCase().includes(companySearch.toLowerCase())).length === 0 && (
                            <div className="px-4 py-3 text-sm text-muted-foreground">No companies found matching &ldquo;{companySearch}&rdquo;</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={lbl}>Job Type</label>
                    <select value={form.jobType} onChange={e => setF('jobType', e.target.value)} className={inp}>
                      <option value="FULL_TIME">Full-time</option>
                      <option value="PART_TIME">Part-time</option>
                      <option value="CONTRACT">Contract</option>
                      <option value="INTERNSHIP">Internship</option>
                      <option value="REMOTE">Remote</option>
                      <option value="HYBRID">Hybrid</option>
                      <option value="FREELANCE">Freelance</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Experience Level</label>
                    <select value={form.experienceLevel} onChange={e => setF('experienceLevel', e.target.value)} className={inp}>
                      <option value="">Any level</option>
                      <option value="ENTRY">Entry (0–2 yrs)</option>
                      <option value="MID">Mid (2–5 yrs)</option>
                      <option value="SENIOR">Senior (5–10 yrs)</option>
                      <option value="LEAD">Lead / Principal</option>
                      <option value="EXECUTIVE">Executive</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Location</label>
                    <input value={form.location} onChange={e => setF('location', e.target.value)} placeholder="e.g. Nairobi, Kenya" className={inp} />
                  </div>
                </div>
              </SectionCard>
            </>
          )}

          {/* ── 2. Job Details ── */}
          {activeSection === 1 && (
            <SectionCard title="2. Job Details" subtitle="Describe the role clearly to attract the right people">
              <div>
                <label className={lbl}>Job Description <span className="text-red-500">*</span></label>
                <textarea rows={7} value={form.description} onChange={e => setF('description', e.target.value)}
                  placeholder="Describe the role, team, key responsibilities, and what success looks like…"
                  className={`${inp} resize-none`} />
                <p className="mt-1 text-xs text-muted-foreground">{form.description.length} characters · Aim for at least 200</p>
              </div>
              <div>
                <label className={lbl}>Requirements &amp; Qualifications</label>
                <textarea rows={5} value={form.requirements} onChange={e => setF('requirements', e.target.value)}
                  placeholder={`• Bachelor's degree in Computer Science or related field\n• 3+ years of experience with React\n• Strong communication skills`}
                  className={`${inp} resize-none`} />
              </div>
            </SectionCard>
          )}

          {/* ── 3. Compensation ── */}
          {activeSection === 2 && (
            <SectionCard title="3. Compensation" subtitle="Transparent salary ranges increase application rates by up to 30%">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>Currency</label>
                  <select value={form.currency} onChange={e => setF('currency', e.target.value)} className={inp}>
                    <option value="KES">KES</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="ZAR">ZAR</option>
                    <option value="NGN">NGN</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>Min Salary</label>
                  <input type="number" value={form.salaryMin} onChange={e => setF('salaryMin', e.target.value)} placeholder="e.g. 80000" min={0} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Max Salary</label>
                  <input type="number" value={form.salaryMax} onChange={e => setF('salaryMax', e.target.value)} placeholder="e.g. 120000" min={0} className={inp} />
                </div>
              </div>
            </SectionCard>
          )}

          {/* ── 4. Skills ── */}
          {activeSection === 3 && (
            <SectionCard title="4. Required Skills" subtitle="Skills are used to match your listing with qualified candidates">
              {selectedSkills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedSkills.map(skill => (
                    <span key={skill.id} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] text-sm font-medium">
                      {skill.name}
                      <button type="button" onClick={() => toggleSkill(skill)} className="hover:text-red-500 transition-colors">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="relative">
                <input
                  value={skillSearch}
                  onChange={e => setSkillSearch(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredSkills.length > 0) { toggleSkill(filteredSkills[0]); }
                      else if (skillSearch.trim()) { addNewSkill(skillSearch); }
                    }
                  }}
                  placeholder="Search skills — React, Python, Project Management, SQL…"
                  className={inp}
                />
                {addingSkill && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F77B0F] border-t-transparent block" />
                  </div>
                )}
              </div>

              {skillSearch && (
                <div className="rounded-xl border border-border overflow-hidden">
                  {filteredSkills.slice(0, 12).map(skill => (
                    <button key={skill.id} type="button"
                      onClick={() => { toggleSkill(skill); setSkillSearch(''); }}
                      className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm text-card-foreground hover:bg-muted border-b border-border last:border-0 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" /></svg>
                      {skill.name}
                    </button>
                  ))}
                  {skillSearch.trim() && !selectedSkills.some(s => s.name.toLowerCase() === skillSearch.trim().toLowerCase()) && (
                    <button type="button" onClick={() => addNewSkill(skillSearch)} disabled={addingSkill}
                      className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm font-medium text-[#F77B0F] hover:bg-[#F77B0F]/5 border-t border-border disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                      Add &ldquo;{skillSearch.trim()}&rdquo; as new skill
                    </button>
                  )}
                </div>
              )}

              {!skillSearch && selectedSkills.length === 0 && (
                <p className="text-xs text-muted-foreground">Type to search, or type a new skill and press Enter (or click + Add) to create it.</p>
              )}
            </SectionCard>
          )}

          {/* ── 5. Hiring Pipeline ── */}
          {activeSection === 4 && (
            <SectionCard title="5. Hiring Pipeline" subtitle="Define the stages candidates will go through">
              <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                {stages.map((stage, idx) => (
                  <div key={idx} className="bg-card">
                    {editingStage === idx ? (
                      <div className="p-4 space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0">{stage.order}</span>
                          <input value={stage.name} onChange={e => updateStage(idx, 'name', e.target.value)}
                            placeholder="Stage name" autoFocus
                            className="flex-1 text-sm font-medium bg-transparent outline-none text-card-foreground placeholder:text-muted-foreground border-b border-border pb-0.5 focus:border-[#F77B0F]"
                          />
                        </div>
                        <div className="pl-8">
                          <input value={stage.description || ''} onChange={e => updateStage(idx, 'description', e.target.value)}
                            placeholder="Brief description — what happens at this stage (optional)"
                            className="w-full text-xs text-muted-foreground bg-transparent outline-none placeholder:text-muted-foreground/50"
                          />
                        </div>
                        <div className="pl-8 flex items-center gap-4 pt-1">
                          <button type="button" onClick={() => setEditingStage(null)} className="text-xs font-medium text-[#F77B0F] hover:underline">Done</button>
                          <button type="button" onClick={() => removeStage(idx)} disabled={stages.length <= 1} className="text-xs text-red-500 hover:underline disabled:opacity-30">Remove</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-3">
                        <span className="w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{stage.order}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-card-foreground">
                            {stage.name || <span className="text-muted-foreground italic font-normal">Unnamed stage</span>}
                          </p>
                          {stage.description && <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                          <button type="button" onClick={() => moveStage(idx, -1)} disabled={idx === 0} className="hover:text-card-foreground disabled:opacity-25">↑</button>
                          <button type="button" onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1} className="hover:text-card-foreground disabled:opacity-25">↓</button>
                          <button type="button" onClick={() => setEditingStage(idx)} className="hover:text-[#F77B0F]">Edit</button>
                          <button type="button" onClick={() => removeStage(idx)} disabled={stages.length <= 1} className="hover:text-red-500 disabled:opacity-25">Remove</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={addStage} className="text-sm font-medium text-[#F77B0F] hover:underline">
                + Add Stage
              </button>
            </SectionCard>
          )}

          {/* ── 6. Publish ── */}
          {activeSection === 5 && (
            <SectionCard title="6. Publish Settings" subtitle="Control when your listing goes live and assign a recruiter">
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className={lbl}>Listing Expires On</label>
                  <input type="date" value={form.expiresAt} onChange={e => setF('expiresAt', e.target.value)}
                    min={new Date().toISOString().split('T')[0]} className={inp} />
                  <p className="mt-1.5 text-xs text-muted-foreground">Leave blank to keep active indefinitely.</p>
                </div>
                <div>
                  <label className={lbl}>Initial Status</label>
                  <select value={form.status} onChange={e => setF('status', e.target.value)} className={inp}>
                    <option value="ACTIVE">ACTIVE — Visible to job seekers</option>
                    <option value="PAUSED">PAUSED — Hidden from seekers</option>
                    <option value="CLOSED">CLOSED — No applications</option>
                  </select>
                </div>
              </div>
              <div>
                <label className={lbl}>Assign Recruiter</label>
                <select value={form.recruiterId} onChange={e => setF('recruiterId', e.target.value)} className={inp}>
                  <option value="">Post as admin (no recruiter assigned)</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{(u as any).firstName} {(u as any).lastName} — {u.email}</option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-muted-foreground">The selected user will appear as the job poster on the listing.</p>
              </div>

              {/* Preview card */}
              <div className="rounded-xl bg-[#192C67]/5 dark:bg-[#192C67]/15 p-4">
                <p className="text-xs font-semibold text-[#192C67] dark:text-blue-400 mb-2">Listing Preview</p>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {[
                    ['Title', form.title || '—'],
                    ['Company', companyMode === 'new' ? (newCompanyName || '—') : (companies.find(c => c.id === form.companyId)?.name || '—')],
                    ['Type', form.jobType.replace(/_/g, ' ')],
                    ['Location', form.location || 'Not set'],
                    ['Skills', `${selectedSkills.length} selected`],
                    ['Pipeline', `${stages.length} stages`],
                    ['Expires', form.expiresAt || 'Never'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span>{k}</span>
                      <span className="font-medium text-card-foreground truncate max-w-[150px]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </SectionCard>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0">
          <div>
            {activeSection > 0 && (
              <button onClick={() => setActiveSection(p => p - 1)} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
                ← Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
              Cancel
            </button>
            {activeSection < sections.length - 1 ? (
              <button onClick={() => setActiveSection(p => p + 1)}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline">
                Next →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F77B0F] border-t-transparent" />Posting…</>
                ) : 'Post Job →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function JobsPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const LIMIT = 10;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');

  const [delDialog, setDelDialog] = useState<{ open: boolean; job: AdminJob | null }>({ open: false, job: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jobService.list({ page, limit: LIMIT, search, status: statusFilter, jobType: jobTypeFilter });
      setJobs(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / LIMIT)));
    } catch {
      addToast('error', 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, jobTypeFilter, addToast]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleStatusChange = async (job: AdminJob, status: string) => {
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status } : j));
    try {
      await jobService.updateStatus(job.id, status);
      addToast('success', `Job marked as ${status.toLowerCase()}`);
      fetchJobs();
    } catch {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: job.status } : j));
      addToast('error', 'Failed to update job status');
    }
  };

  const handleDelete = async () => {
    if (!delDialog.job) return;
    const deletedId = delDialog.job.id;
    setDelDialog({ open: false, job: null });
    setJobs(prev => prev.filter(j => j.id !== deletedId));
    setTotal(prev => prev - 1);
    try {
      await jobService.delete(deletedId);
      addToast('success', 'Job deleted');
      fetchJobs();
    } catch {
      addToast('error', 'Failed to delete job');
      fetchJobs();
    }
  };

  const cols: Column<AdminJob>[] = [
    {
      key: 'title', label: 'Title', sortable: true,
      render: j => <p className="font-medium text-card-foreground truncate max-w-[200px]">{j.title}</p>,
    },
    {
      key: 'company', label: 'Company',
      render: j => (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{j.company?.name || '-'}</span>
          {j.company?.isVerified && (
            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )}
        </div>
      ),
    },
    {
      key: 'jobType', label: 'Type',
      render: j => <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary-500/10 text-primary-500">{(j.jobType || '-').replace(/_/g, ' ')}</span>,
    },
    { key: 'location', label: 'Location', render: j => <span className="text-muted-foreground text-sm">{j.location || '-'}</span> },
    {
      key: 'salary', label: 'Salary',
      render: j => (
        <span className="text-sm text-muted-foreground">
          {j.salaryMin || j.salaryMax ? `${j.salaryMin ? j.salaryMin.toLocaleString() : '?'} – ${j.salaryMax ? j.salaryMax.toLocaleString() : '?'}` : '-'}
        </span>
      ),
    },
    { key: 'applications', label: 'Applicants', render: j => <span className="font-medium text-sm">{j._count?.applications ?? 0}</span> },
    { key: 'status', label: 'Status', render: j => <StatusBadge status={j.status} /> },
    { key: 'createdAt', label: 'Posted', sortable: true, render: j => <span className="text-muted-foreground text-sm">{formatDate(j.createdAt)}</span> },
    {
      key: 'actions', label: '',
      render: j => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          <select value="" onChange={e => { if (e.target.value) handleStatusChange(j, e.target.value); }} disabled={actionLoading}
            className="text-xs px-2 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50" title="Change status">
            <option value="">Status</option>
            {['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'].filter(s => s !== j.status).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={() => setDelDialog({ open: true, job: j })}
            className="p-1.5 rounded-lg hover:bg-muted text-red-500 hover:text-red-600 transition-colors" title="Delete job">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Jobs"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Jobs' }]}
        actions={
          <button onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F77B0F] text-white text-sm font-semibold hover:bg-[#e06c0d] transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Post Job
          </button>
        }
      />
      <p className="text-sm text-muted-foreground -mt-4 mb-5">Review and moderate job postings</p>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search jobs…" className={`${ic} w-64 pl-9`} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-40`}>
          <option value="">All Statuses</option>
          {['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={jobTypeFilter} onChange={e => { setJobTypeFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
          <option value="">All Types</option>
          {['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP', 'FREELANCE', 'REMOTE'].map(t => (
            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
          ))}
        </select>
        {(search || statusFilter || jobTypeFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setJobTypeFilter(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors">
            Clear filters
          </button>
        )}
      </div>

      <DataTable columns={cols} data={jobs} loading={loading} page={page} totalPages={totalPages} total={total}
        onPageChange={setPage} keyExtractor={j => j.id} onRowClick={j => router.push(`/dashboard/jobs/${j.id}`)} emptyMessage="No jobs found" />

      <ConfirmDialog
        isOpen={delDialog.open} onClose={() => setDelDialog({ open: false, job: null })} onConfirm={handleDelete}
        title="Delete Job" message={`Are you sure you want to delete "${delDialog.job?.title}"? This cannot be undone and will remove all associated applications.`}
        confirmLabel="Delete Job" confirmVariant="danger" loading={actionLoading}
      />

      <PostJobDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} onCreated={fetchJobs} />
    </div>
  );
}
