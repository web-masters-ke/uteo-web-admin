'use client';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { skillService, SkillData } from '@/lib/services/skillService';
import { categoryService, CategoryData } from '@/lib/services/categoryService';
import { Skill, Category, SkillLevel, SkillDemand, TrainerType } from '@/lib/types';
import { useToast } from '@/lib/toast';

/* ─── constants ─── */
const LEVELS: { value: SkillLevel; label: string; color: string }[] = [
  { value: 'BEGINNER', label: 'Beginner', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'INTERMEDIATE', label: 'Intermediate', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'ADVANCED', label: 'Advanced', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'EXPERT', label: 'Expert', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
];

const DEMANDS: { value: SkillDemand; label: string; color: string; pulse?: boolean }[] = [
  { value: 'LOW', label: 'Low', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'HIGH', label: 'High', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'CRITICAL', label: 'Critical', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', pulse: true },
];

const TRAINER_TYPES: { value: TrainerType; label: string }[] = [
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'VOCATIONAL', label: 'Vocational' },
  { value: 'BOTH', label: 'Both' },
];

function trainerTypeLabel(t?: TrainerType | string) {
  if (!t) return null;
  const map: Record<string, { label: string; cls: string }> = {
    PROFESSIONAL: { label: 'Professional', cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
    VOCATIONAL: { label: 'Vocational', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
    BOTH: { label: 'Both', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
  };
  const m = map[t];
  if (!m) return null;
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function demandBadge(d?: SkillDemand) {
  if (!d) return null;
  const cfg = DEMANDS.find((x) => x.value === d) || DEMANDS[0];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.color}`}>
      {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
      {cfg.label}
    </span>
  );
}

function levelBadge(l?: SkillLevel) {
  if (!l) return null;
  const cfg = LEVELS.find((x) => x.value === l) || LEVELS[0];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.color}`}>{cfg.label}</span>;
}

/* ─── stat card ─── */
function StatCard({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-4 flex items-center gap-3`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-card-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

/* ─── tag input ─── */
function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !tags.includes(v)) { onChange([...tags, v]); setInput(''); }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-red-500">&times;</button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        placeholder="Type a tag and press Enter"
        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
      />
    </div>
  );
}

/* ─── main page ─── */
export default function SkillsPage() {
  const { addToast } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  const [loadingCats, setLoadingCats] = useState(true);
  const [tab, setTab] = useState<'skills' | 'cats'>('skills');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'skill' | 'cat'>('skill');
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [delDialog, setDelDialog] = useState<{ open: boolean; type: 'skill' | 'cat'; id: string; name: string }>({ open: false, type: 'skill', id: '', name: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // Skill form
  const [sForm, setSForm] = useState<SkillData & { categoryId: string }>({
    name: '', description: '', icon: '', category: '', categoryId: '',
    trainerType: undefined, level: undefined, demand: undefined, tags: [], isActive: true,
  });

  // Category form
  const [cForm, setCForm] = useState<CategoryData>({ name: '', description: '', icon: '', isActive: true, sortOrder: 0, trainerType: undefined });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTrainerType, setFilterTrainerType] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterDemand, setFilterDemand] = useState('');
  const [filterActive, setFilterActive] = useState('');

  const fetchSkills = useCallback(async () => {
    setLoadingSkills(true);
    try { setSkills(await skillService.getAll()); }
    catch { addToast('error', 'Failed to load skills'); }
    finally { setLoadingSkills(false); }
  }, [addToast]);

  const fetchCats = useCallback(async () => {
    setLoadingCats(true);
    try { setCats(await categoryService.getAll()); }
    catch { addToast('error', 'Failed to load categories'); }
    finally { setLoadingCats(false); }
  }, [addToast]);

  useEffect(() => { fetchSkills(); fetchCats(); }, [fetchSkills, fetchCats]);

  /* ─── filtered skills ─── */
  const filtered = useMemo(() => {
    return skills.filter((s) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const catName = typeof s.category === 'string' ? s.category : (s.category as Category)?.name || '';
        const matchName = s.name.toLowerCase().includes(q);
        const matchDesc = s.description?.toLowerCase().includes(q);
        const matchCat = catName.toLowerCase().includes(q);
        const matchTags = s.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchCat && !matchTags) return false;
      }
      if (filterCategory) {
        const catId = s.categoryId || (typeof s.category === 'object' && s.category ? (s.category as Category).id : '');
        if (catId !== filterCategory) return false;
      }
      if (filterTrainerType && s.trainerType !== filterTrainerType) return false;
      if (filterLevel && s.level !== filterLevel) return false;
      if (filterDemand && s.demand !== filterDemand) return false;
      if (filterActive === 'active' && s.isActive === false) return false;
      if (filterActive === 'inactive' && s.isActive !== false) return false;
      return true;
    });
  }, [skills, searchQuery, filterCategory, filterTrainerType, filterLevel, filterDemand, filterActive]);

  /* ─── stats ─── */
  const stats = useMemo(() => {
    const total = skills.length;
    const active = skills.filter((s) => s.isActive !== false).length;
    const professional = skills.filter((s) => s.trainerType === 'PROFESSIONAL' || s.trainerType === 'BOTH').length;
    const vocational = skills.filter((s) => s.trainerType === 'VOCATIONAL' || s.trainerType === 'BOTH').length;
    const highDemand = skills.filter((s) => s.demand === 'HIGH' || s.demand === 'CRITICAL').length;
    return { total, active, professional, vocational, highDemand };
  }, [skills]);

  /* ─── handlers ─── */
  const handleSaveSkill = async () => {
    if (!sForm.name.trim()) { addToast('error', 'Name is required'); return; }
    setActionLoading(true);
    try {
      const payload: SkillData = {
        name: sForm.name,
        description: sForm.description || undefined,
        icon: sForm.icon || undefined,
        trainerType: sForm.trainerType || undefined,
        level: sForm.level || undefined,
        demand: sForm.demand || undefined,
        tags: sForm.tags?.length ? sForm.tags : undefined,
        isActive: sForm.isActive,
      };
      if (sForm.categoryId) payload.categoryId = sForm.categoryId;
      if (sForm.category) payload.category = sForm.category as string;
      if (editingSkill) {
        await skillService.update(editingSkill.id, payload);
        addToast('success', 'Skill updated');
      } else {
        await skillService.create(payload);
        addToast('success', 'Skill created');
      }
      setModalOpen(false);
      // Clear filters so new skill is visible
      setSearchQuery(''); setFilterCategory(''); setFilterTrainerType(''); setFilterLevel(''); setFilterDemand(''); setFilterActive('');
      fetchSkills();
    } catch { addToast('error', 'Failed to save skill'); }
    finally { setActionLoading(false); }
  };

  const handleSaveCat = async () => {
    if (!cForm.name.trim()) { addToast('error', 'Name is required'); return; }
    setActionLoading(true);
    try {
      if (editingCat) {
        await categoryService.update(editingCat.id, cForm);
        addToast('success', 'Category updated');
      } else {
        await categoryService.create(cForm);
        addToast('success', 'Category created');
      }
      setModalOpen(false);
      fetchCats();
    } catch { addToast('error', 'Failed to save category'); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    setActionLoading(true);
    try {
      if (delDialog.type === 'skill') await skillService.delete(delDialog.id);
      else await categoryService.delete(delDialog.id);
      addToast('success', 'Deleted successfully');
      setDelDialog({ ...delDialog, open: false });
      if (delDialog.type === 'skill') fetchSkills(); else fetchCats();
    } catch { addToast('error', 'Failed to delete'); }
    finally { setActionLoading(false); }
  };

  const handleToggleSkillActive = async (skill: Skill) => {
    try {
      await skillService.toggleActive(skill.id, !skill.isActive);
      addToast('success', `Skill ${skill.isActive ? 'deactivated' : 'activated'}`);
      fetchSkills();
    } catch { addToast('error', 'Failed to toggle status'); }
  };

  const handleToggleCatActive = async (cat: Category) => {
    try {
      await categoryService.toggleActive(cat.id, !cat.isActive);
      addToast('success', `Category ${cat.isActive ? 'deactivated' : 'activated'}`);
      fetchCats();
    } catch { addToast('error', 'Failed to toggle status'); }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';
  const selectCls = `${inputCls} appearance-none`;

  const editIcon = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
  const delIconSvg = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;

  /* ─── open modal helpers ─── */
  const openCreateSkill = () => {
    setEditingSkill(null);
    setSForm({ name: '', description: '', icon: '', category: '', categoryId: '', trainerType: undefined, level: undefined, demand: undefined, tags: [], isActive: true });
    setModalType('skill');
    setModalOpen(true);
  };
  const openEditSkill = (s: Skill) => {
    setEditingSkill(s);
    const catVal = typeof s.category === 'string' ? s.category : (s.category as Category)?.name || '';
    const catId = s.categoryId || (typeof s.category === 'object' && s.category ? (s.category as Category).id : '');
    setSForm({
      name: s.name, description: s.description || '', icon: s.icon || '',
      category: catVal, categoryId: catId || '',
      trainerType: s.trainerType, level: s.level, demand: s.demand,
      tags: s.tags || [], isActive: s.isActive !== false,
    });
    setModalType('skill');
    setModalOpen(true);
  };
  const openCreateCat = () => {
    setEditingCat(null);
    setCForm({ name: '', description: '', icon: '', isActive: true, sortOrder: 0, trainerType: undefined });
    setModalType('cat');
    setModalOpen(true);
  };
  const openEditCat = (c: Category) => {
    setEditingCat(c);
    setCForm({ name: c.name, description: c.description || '', icon: c.icon || '', isActive: c.isActive, sortOrder: c.sortOrder, trainerType: c.trainerType });
    setModalType('cat');
    setModalOpen(true);
  };

  /* ─── category table columns ─── */
  const catCols: Column<Category>[] = [
    { key: 'icon', label: 'Icon', render: (c) => <span className="text-xl">{c.icon || '📂'}</span> },
    { key: 'name', label: 'Name', render: (c) => <span className="font-medium">{c.name}</span> },
    { key: 'description', label: 'Description', render: (c) => <span className="text-xs text-muted-foreground line-clamp-1">{c.description || '-'}</span> },
    { key: 'trainerType', label: 'Trainer Type', render: (c) => trainerTypeLabel(c.trainerType) || <span className="text-xs text-muted-foreground">-</span> },
    { key: 'isActive', label: 'Status', render: (c) => (
      <button onClick={(e) => { e.stopPropagation(); handleToggleCatActive(c); }}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${c.isActive ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${c.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    )},
    { key: 'sortOrder', label: 'Order' },
    {
      key: 'actions', label: '', render: (c) => (
        <div className="flex gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEditCat(c); }} className="p-1 rounded hover:bg-muted text-muted-foreground">{editIcon}</button>
          <button onClick={(e) => { e.stopPropagation(); setDelDialog({ open: true, type: 'cat', id: c.id, name: c.name }); }} className="p-1 rounded hover:bg-muted text-red-500">{delIconSvg}</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Skills & Categories"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Skills & Categories' }]}
        actions={
          <button onClick={tab === 'skills' ? openCreateSkill : openCreateCat} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors">
            + Add {tab === 'skills' ? 'Skill' : 'Category'}
          </button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(['skills', 'cats'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-primary-500 text-primary-500' : 'border-transparent text-muted-foreground hover:text-card-foreground'}`}>
            {t === 'skills' ? `Skills (${skills.length})` : `Categories (${cats.length})`}
          </button>
        ))}
      </div>

      {/* ═══════ SKILLS TAB ═══════ */}
      {tab === 'skills' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <StatCard label="Total Skills" value={stats.total} accent="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>} />
            <StatCard label="Active" value={stats.active} accent="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>} />
            <StatCard label="Professional" value={stats.professional} accent="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>} />
            <StatCard label="Vocational" value={stats.vocational} accent="bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>} />
            <StatCard label="High Demand" value={stats.highDemand} accent="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>} />
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills..."
                className={inputCls}
              />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={selectCls}>
                <option value="">All Categories</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={filterTrainerType} onChange={(e) => setFilterTrainerType(e.target.value)} className={selectCls}>
                <option value="">All Types</option>
                <option value="PROFESSIONAL">Professional</option>
                <option value="VOCATIONAL">Vocational</option>
                <option value="BOTH">Both</option>
              </select>
              <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className={selectCls}>
                <option value="">All Levels</option>
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <select value={filterDemand} onChange={(e) => setFilterDemand(e.target.value)} className={selectCls}>
                <option value="">All Demand</option>
                {DEMANDS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
              <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)} className={selectCls}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {(searchQuery || filterCategory || filterTrainerType || filterLevel || filterDemand || filterActive) && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{filtered.length} of {skills.length} skills</span>
                <button onClick={() => { setSearchQuery(''); setFilterCategory(''); setFilterTrainerType(''); setFilterLevel(''); setFilterDemand(''); setFilterActive(''); }}
                  className="text-xs text-primary-500 hover:underline">Clear filters</button>
              </div>
            )}
          </div>

          {/* Skill Cards Grid */}
          {loadingSkills ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-muted" />
                    <div className="flex-1"><div className="h-4 w-3/4 bg-muted rounded mb-2" /><div className="h-3 w-full bg-muted rounded" /></div>
                  </div>
                  <div className="flex gap-2 mb-3"><div className="h-5 w-16 bg-muted rounded-full" /><div className="h-5 w-16 bg-muted rounded-full" /></div>
                  <div className="h-3 w-1/3 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground text-sm">No skills match your filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((s) => {
                const catName = typeof s.category === 'string' ? s.category : (s.category as Category)?.name || '';
                const trainerCount = s._count?.trainers ?? 0;
                return (
                  <div key={s.id} className={`bg-card border rounded-xl p-5 transition-shadow hover:shadow-md ${s.isActive === false ? 'border-border opacity-60' : 'border-border'}`}>
                    {/* Header: icon + name + actions */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <span className="text-2xl shrink-0">{s.icon || '🔧'}</span>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-card-foreground text-sm truncate">{s.name}</h3>
                          {s.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button onClick={() => openEditSkill(s)} className="p-1 rounded hover:bg-muted text-muted-foreground" title="Edit">{editIcon}</button>
                        <button onClick={() => setDelDialog({ open: true, type: 'skill', id: s.id, name: s.name })} className="p-1 rounded hover:bg-muted text-red-500" title="Delete">{delIconSvg}</button>
                      </div>
                    </div>

                    {/* Badges row */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {catName && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">{catName}</span>}
                      {levelBadge(s.level)}
                      {trainerTypeLabel(s.trainerType)}
                      {demandBadge(s.demand)}
                    </div>

                    {/* Tags */}
                    {s.tags && s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {s.tags.map((t) => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 font-medium">{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Footer: trainers count + active toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {trainerCount > 0 ? `${trainerCount} trainer${trainerCount !== 1 ? 's' : ''} have this skill` : 'No trainers yet'}
                      </span>
                      <button onClick={() => handleToggleSkillActive(s)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${s.isActive !== false ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                        title={s.isActive !== false ? 'Active - click to deactivate' : 'Inactive - click to activate'}>
                        <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${s.isActive !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══════ CATEGORIES TAB ═══════ */}
      {tab === 'cats' && (
        <DataTable columns={catCols} data={cats} loading={loadingCats} keyExtractor={(c) => c.id} emptyMessage="No categories yet" />
      )}

      {/* ═══════ SKILL MODAL ═══════ */}
      <Modal
        isOpen={modalOpen && modalType === 'skill'}
        onClose={() => setModalOpen(false)}
        title={editingSkill ? 'Edit Skill' : 'Create Skill'}
        size="lg"
      >
        <div className="space-y-4">
          {/* Row 1: Name + Icon */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">Name *</label>
              <input value={sForm.name} onChange={(e) => setSForm({ ...sForm, name: e.target.value })} className={inputCls} placeholder="e.g. Weight Training" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Icon</label>
              <input value={sForm.icon || ''} onChange={(e) => setSForm({ ...sForm, icon: e.target.value })} className={inputCls} placeholder="e.g. 💪" />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={sForm.description || ''} onChange={(e) => setSForm({ ...sForm, description: e.target.value })} rows={2} className={inputCls} placeholder="Brief description of this skill..." />
          </div>

          {/* Row 2: Category + Trainer Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select
                value={sForm.categoryId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const selectedCat = cats.find((c) => c.id === val);
                  setSForm({ ...sForm, category: selectedCat?.name || '', categoryId: val });
                }}
                className={selectCls}
              >
                <option value="">-- Select category --</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trainer Type</label>
              <select
                value={sForm.trainerType || ''}
                onChange={(e) => setSForm({ ...sForm, trainerType: (e.target.value || undefined) as TrainerType | undefined })}
                className={selectCls}
              >
                <option value="">-- Select type --</option>
                {TRAINER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Level + Demand */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Level</label>
              <select
                value={sForm.level || ''}
                onChange={(e) => setSForm({ ...sForm, level: (e.target.value || undefined) as SkillLevel | undefined })}
                className={selectCls}
              >
                <option value="">-- Select level --</option>
                {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Demand</label>
              <select
                value={sForm.demand || ''}
                onChange={(e) => setSForm({ ...sForm, demand: (e.target.value || undefined) as SkillDemand | undefined })}
                className={selectCls}
              >
                <option value="">-- Select demand --</option>
                {DEMANDS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium mb-1">Tags</label>
            <TagInput tags={sForm.tags || []} onChange={(tags) => setSForm({ ...sForm, tags })} />
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={sForm.isActive !== false} onChange={(e) => setSForm({ ...sForm, isActive: e.target.checked })} className="rounded" />
            <span className="text-sm">Active</span>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
            <button onClick={handleSaveSkill} disabled={actionLoading} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm disabled:opacity-50">
              {actionLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ═══════ CATEGORY MODAL ═══════ */}
      <Modal
        isOpen={modalOpen && modalType === 'cat'}
        onClose={() => setModalOpen(false)}
        title={editingCat ? 'Edit Category' : 'Create Category'}
        size="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} className={inputCls} placeholder="e.g. Fitness" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={cForm.description || ''} onChange={(e) => setCForm({ ...cForm, description: e.target.value })} rows={2} className={inputCls} placeholder="Category description..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Icon</label>
              <input value={cForm.icon || ''} onChange={(e) => setCForm({ ...cForm, icon: e.target.value })} className={inputCls} placeholder="Emoji or icon name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trainer Type</label>
              <select
                value={cForm.trainerType || ''}
                onChange={(e) => setCForm({ ...cForm, trainerType: (e.target.value || undefined) as TrainerType | undefined })}
                className={selectCls}
              >
                <option value="">-- Select type --</option>
                {TRAINER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sort Order</label>
              <input type="number" min={0} value={cForm.sortOrder} onChange={(e) => setCForm({ ...cForm, sortOrder: Number(e.target.value) })} className={inputCls} />
            </div>
            <label className="flex items-center gap-2 pt-6">
              <input type="checkbox" checked={cForm.isActive} onChange={(e) => setCForm({ ...cForm, isActive: e.target.checked })} className="rounded" />
              <span className="text-sm">Active</span>
            </label>
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 rounded-lg border border-border text-sm">Cancel</button>
            <button onClick={handleSaveCat} disabled={actionLoading} className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm disabled:opacity-50">
              {actionLoading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={delDialog.open}
        onClose={() => setDelDialog({ ...delDialog, open: false })}
        onConfirm={handleDelete}
        title={`Delete ${delDialog.type === 'skill' ? 'Skill' : 'Category'}`}
        message={`Are you sure you want to delete "${delDialog.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
