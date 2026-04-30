'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { PageHeader } from '@/components/PageHeader';
import api from '@/lib/api';
import {
  aiControlService,
  RankingWeights,
  AiModuleConfig,
  DEFAULT_WEIGHTS,
  DEFAULT_AI_CONFIG,
} from '@/lib/services/aiControlService';
import { useToast } from '@/lib/toast';

const WEIGHT_LABELS: Record<keyof RankingWeights, string> = {
  skill_match: 'Skill Match',
  rating: 'Candidate Rating',
  experience: 'Experience',
  completion_rate: 'Profile Completion',
  availability: 'Availability',
  price: 'Salary Expectation',
};

const MODULE_LABELS: Record<keyof AiModuleConfig, string> = {
  rankingEngine: 'Candidate Ranking Engine',
  fraudDetection: 'Fraud Detection',
  reviewModeration: 'Job Post Moderation',
  chatModeration: 'Chat Moderation',
  sessionTranscription: 'Interview Transcription',
};

const TABS = ['Interview Questions', 'Candidate Insight', 'Job Enhancer', 'Career Chat'] as const;
type Tab = typeof TABS[number];

interface ChatMessage { role: 'user' | 'assistant'; content: string; }

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-[#F77B0F]' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4 text-[#F77B0F]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function InputField({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F]"
      />
    </div>
  );
}

function TextareaField({ label, value, onChange, placeholder, rows = 3, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] resize-none"
      />
    </div>
  );
}

function RunButton({ onClick, loading, disabled, label = 'Run' }: { onClick: () => void; loading: boolean; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-40 transition-opacity"
    >
      {loading ? <Spinner /> : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {loading ? 'Running…' : label}
    </button>
  );
}

// ── Interview Questions Tab ───────────────────────────────────────────────────
function InterviewQuestionsTab() {
  const { addToast } = useToast();
  const [jobTitle, setJobTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);

  const run = async () => {
    if (!jobTitle.trim()) { addToast('error', 'Job title is required'); return; }
    setLoading(true);
    setQuestions([]);
    try {
      const payload: any = { jobTitle: jobTitle.trim() };
      if (skills.trim()) payload.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (notes.trim()) payload.notes = notes.trim();
      const res = await api.post('/ai/interview-questions', payload);
      const raw = res.data?.data ?? res.data;
      const list: string[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.questions)
        ? raw.questions
        : typeof raw === 'string'
        ? raw.split('\n').filter(Boolean)
        : [];
      setQuestions(list.length ? list : ['No questions returned.']);
    } catch {
      addToast('error', 'Failed to generate interview questions');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Job Title" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Senior Software Engineer" required />
        <InputField label="Skills (comma-separated)" value={skills} onChange={setSkills} placeholder="e.g. React, TypeScript, Node.js" />
      </div>
      <TextareaField label="Notes / Context" value={notes} onChange={setNotes} placeholder="Any specific context for the interview..." rows={2} />
      <div className="flex justify-end">
        <RunButton onClick={run} loading={loading} disabled={!jobTitle.trim()} label="Generate Questions" />
      </div>
      {questions.length > 0 && (
        <div className="mt-2 space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="flex gap-3 p-3 bg-muted/40 rounded-lg">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <p className="text-sm text-card-foreground">{q}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Candidate Insight Tab ─────────────────────────────────────────────────────
function CandidateInsightTab() {
  const { addToast } = useToast();
  const [candidateName, setCandidateName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [matchedSkills, setMatchedSkills] = useState('');
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState('');
  const [ran, setRan] = useState(false);

  const run = async () => {
    if (!candidateName.trim() || !jobTitle.trim()) { addToast('error', 'Candidate name and job title are required'); return; }
    setLoading(true);
    setInsight('');
    setRan(false);
    try {
      const payload: any = { candidateName: candidateName.trim(), jobTitle: jobTitle.trim() };
      if (skills.trim()) payload.skills = skills.split(',').map((s) => s.trim()).filter(Boolean);
      if (matchedSkills.trim()) payload.matchedSkills = matchedSkills.split(',').map((s) => s.trim()).filter(Boolean);
      const res = await api.post('/ai/candidate-insight', payload);
      const raw = res.data?.data ?? res.data;
      const text = typeof raw === 'string' ? raw : (raw?.insight ?? raw?.text ?? raw?.message ?? (raw ? JSON.stringify(raw) : ''));
      setInsight(text || 'No insight generated. Please try again.');
    } catch {
      setInsight('Could not generate insight — check backend connectivity.');
    } finally {
      setLoading(false);
      setRan(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InputField label="Candidate Name" value={candidateName} onChange={setCandidateName} placeholder="e.g. Jane Doe" required />
        <InputField label="Job Title" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Product Manager" required />
        <InputField label="Candidate Skills (comma-separated)" value={skills} onChange={setSkills} placeholder="e.g. SQL, Python, Strategy" />
        <InputField label="Matched Skills (comma-separated)" value={matchedSkills} onChange={setMatchedSkills} placeholder="Skills that match the role" />
      </div>
      <div className="flex justify-end">
        <RunButton onClick={run} loading={loading} disabled={!candidateName.trim() || !jobTitle.trim()} label="Generate Insight" />
      </div>
      {ran && (
        <div className="mt-2 p-4 bg-[#F77B0F]/5 border border-[#F77B0F]/20 rounded-xl">
          <div className="flex gap-2 mb-2">
            <svg className="w-4 h-4 text-[#F77B0F] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m1.636 6.364l.707-.707M6.343 6.343l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-xs font-semibold text-[#F77B0F]">AI Insight</span>
          </div>
          <p className="text-sm text-card-foreground leading-relaxed">{insight}</p>
        </div>
      )}
    </div>
  );
}

// ── Job Enhancer Tab ──────────────────────────────────────────────────────────
function JobEnhancerTab() {
  const { addToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ title?: string; description?: string; tags?: string[]; unchanged?: boolean } | null>(null);

  const run = async () => {
    if (!title.trim() || !description.trim()) { addToast('error', 'Title and description are required'); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post('/ai/enhance-job', { title: title.trim(), description: description.trim() });
      const raw = res.data?.data ?? res.data;
      if (typeof raw === 'string') {
        const unchanged = raw.trim() === description.trim();
        setResult({ description: raw, unchanged });
      } else {
        const enhanced = raw?.description ?? raw?.enhancedDescription ?? raw?.content ?? '';
        const unchanged = enhanced.trim() === description.trim();
        setResult({
          title: raw?.title ?? raw?.enhancedTitle,
          description: enhanced,
          tags: Array.isArray(raw?.tags) ? raw.tags : [],
          unchanged,
        });
      }
    } catch {
      setResult({ unchanged: true, description: '' });
      addToast('error', 'Failed to enhance job description — check backend connectivity');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <InputField label="Job Title" value={title} onChange={setTitle} placeholder="e.g. Backend Engineer (Node.js)" required />
      <TextareaField label="Job Description" value={description} onChange={setDescription} placeholder="Paste your draft job description here..." rows={5} required />
      <div className="flex justify-end">
        <RunButton onClick={run} loading={loading} disabled={!title.trim() || !description.trim()} label="Enhance Job Post" />
      </div>
      {result && (
        <div className="mt-2 space-y-3">
          {result.unchanged ? (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
              AI enhancement unavailable right now — the description was returned unchanged. Check that the AI service API key is configured.
            </div>
          ) : (
            <>
              {result.title && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Enhanced Title</p>
                  <p className="text-sm font-semibold text-card-foreground">{result.title}</p>
                </div>
              )}
              {result.description && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Enhanced Description</p>
                  <div className="p-4 bg-muted/40 rounded-lg text-sm text-card-foreground whitespace-pre-wrap leading-relaxed">{result.description}</div>
                </div>
              )}
              {result.tags && result.tags.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Suggested Tags</p>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map((tag, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] text-xs font-medium">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Career Chat Tab ───────────────────────────────────────────────────────────
function CareerChatTab() {
  const { addToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await api.post('/ai/career-advice', { messages: next });
      const raw = res.data?.data ?? res.data;
      const reply = typeof raw === 'string' ? raw : (raw?.message ?? raw?.content ?? raw?.advice ?? JSON.stringify(raw));
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch {
      addToast('error', 'Failed to get career advice');
      setMessages(next);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col" style={{ minHeight: 380 }}>
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1" style={{ maxHeight: 380 }}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="w-10 h-10 rounded-full bg-[#F77B0F]/10 flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-[#F77B0F]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">Ask our AI for career advice, resume tips, or interview prep.</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const isError = m.role === 'assistant' && (m.content.toLowerCase().includes('hit a snag') || m.content.toLowerCase().includes('sorry'));
            return (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-[#F77B0F] text-white rounded-br-sm'
                    : isError
                    ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400 rounded-bl-sm'
                    : 'bg-muted text-card-foreground rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 mt-auto">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask our AI for career advice…"
          disabled={loading}
          className="flex-1 px-3 py-2 text-sm rounded-lg border border-border bg-background text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#F77B0F] focus:ring-1 focus:ring-[#F77B0F] disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2 rounded-lg bg-[#F77B0F] text-white text-sm font-semibold hover:bg-[#F77B0F]/90 disabled:opacity-40 transition-opacity"
        >
          Send
        </button>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-border text-xs text-muted-foreground hover:text-card-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AiControlPage() {
  const { addToast } = useToast();

  const [weights, setWeights] = useState<RankingWeights>({ ...DEFAULT_WEIGHTS });
  const [weightsLoading, setWeightsLoading] = useState(true);
  const [weightsSaving, setWeightsSaving] = useState(false);

  const [aiConfig, setAiConfig] = useState<AiModuleConfig>({ ...DEFAULT_AI_CONFIG });
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>('Interview Questions');

  const fetchAll = useCallback(async () => {
    setWeightsLoading(true);
    setConfigLoading(true);
    const [w, cfg] = await Promise.all([
      aiControlService.getRankingWeights().catch(() => ({ ...DEFAULT_WEIGHTS })),
      aiControlService.getAiConfig().catch(() => ({ ...DEFAULT_AI_CONFIG })),
    ]);
    setWeights(w);
    setWeightsLoading(false);
    setAiConfig(cfg);
    setConfigLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const weightSum = Object.values(weights).reduce((s, v) => s + v, 0);
  const weightSumOk = Math.abs(weightSum - 1.0) < 0.005;

  const handleWeightChange = (key: keyof RankingWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: Math.round(value * 100) / 100 }));
  };

  const handleSaveWeights = async () => {
    if (!weightSumOk) { addToast('error', `Weights must sum to 1.0 (currently ${weightSum.toFixed(2)})`); return; }
    setWeightsSaving(true);
    try {
      await aiControlService.saveRankingWeights(weights);
      addToast('success', 'Ranking weights saved');
    } catch {
      addToast('error', 'Failed to save ranking weights');
    } finally {
      setWeightsSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await aiControlService.saveAiConfig(aiConfig);
      addToast('success', 'AI module configuration saved');
    } catch {
      addToast('error', 'Failed to save AI configuration');
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Engine"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'AI Engine' },
        ]}
      />

      {/* Config cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Ranking Weights */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-card-foreground">Ranking Weights</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Values must sum to 1.0</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              weightSumOk ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              Sum: {weightSum.toFixed(2)}
            </span>
          </div>
          {weightsLoading ? (
            <div className="space-y-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(weights) as (keyof RankingWeights)[]).map((key) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-card-foreground">{WEIGHT_LABELS[key]}</span>
                    <span className="font-semibold text-[#F77B0F]">{(weights[key] * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={weights[key]}
                    onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
                    className="w-full h-2 accent-[#F77B0F] cursor-pointer"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-border">
            <button
              onClick={handleSaveWeights}
              disabled={weightsSaving || weightsLoading || !weightSumOk}
              className="w-full py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              {weightsSaving ? 'Saving…' : 'Save Weights'}
            </button>
          </div>
        </div>

        {/* AI Module Toggles */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-card-foreground">AI Module Toggles</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enable or disable individual AI services</p>
          </div>
          {configLoading ? (
            <div className="space-y-4">{Array.from({ length: 5 }, (_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(aiConfig) as (keyof AiModuleConfig)[]).map((key) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{MODULE_LABELS[key]}</p>
                    <p className="text-xs text-muted-foreground">{aiConfig[key] ? 'Active' : 'Inactive'}</p>
                  </div>
                  <Toggle checked={aiConfig[key]} onChange={(v) => setAiConfig((prev) => ({ ...prev, [key]: v }))} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 pt-4 border-t border-border">
            <button
              onClick={handleSaveConfig}
              disabled={configSaving || configLoading}
              className="w-full py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              {configSaving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      {/* Live AI Test Console */}
      <div className="bg-card rounded-xl border border-border p-6">
        <div className="flex items-center gap-3 mb-5">
          <div>
            <h2 className="font-semibold text-card-foreground">Live AI Test Console</h2>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#F77B0F] text-[#F77B0F]'
                  : 'border-transparent text-muted-foreground hover:text-card-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'Interview Questions' && <InterviewQuestionsTab />}
        {activeTab === 'Candidate Insight' && <CandidateInsightTab />}
        {activeTab === 'Job Enhancer' && <JobEnhancerTab />}
        {activeTab === 'Career Chat' && <CareerChatTab />}
      </div>
    </div>
  );
}
