'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { coursesService } from '@/lib/services/coursesService';
import { trainerService } from '@/lib/services/trainerService';
import { categoryService } from '@/lib/services/categoryService';
import { useToast } from '@/lib/toast';
import { Trainer, Category } from '@/lib/types';
import api from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

type ContentType = 'VIDEO' | 'TEXT' | 'QUIZ' | 'ASSIGNMENT' | 'LIVE';

interface QuizQuestion {
  _key: string;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'ESSAY' | 'FILE_UPLOAD';
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
}

interface Lesson {
  _key: string;
  id?: string;
  title: string;
  contentType: ContentType;
  description: string;
  videoUrl: string;
  textContent: string;
  duration: number;
  isFree: boolean;
  episodeNumber: number;
  questions: QuizQuestion[];
  assignmentInstructions: string;
  maxAttempts: number;
  timeLimitMin: number;
  milestoneId?: string;
}

interface Module {
  _key: string;
  id?: string;
  title: string;
  description: string;
  passingScore: number;
  weight: number;
  lessons: Lesson[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ic = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/40';
const STEPS = ['Course Info', 'Curriculum', 'Assessments', 'Certification', 'Publish'];

const emptyLesson = (): Lesson => ({
  _key: Math.random().toString(36).slice(2),
  title: '', contentType: 'VIDEO', description: '', videoUrl: '', textContent: '',
  duration: 0, isFree: false, episodeNumber: 0, questions: [],
  assignmentInstructions: '', maxAttempts: 3, timeLimitMin: 0,
});

const emptyModule = (): Module => ({
  _key: Math.random().toString(36).slice(2),
  title: '', description: '', passingScore: 70, weight: 1, lessons: [emptyLesson()],
});

const emptyQuestion = (): QuizQuestion => ({
  _key: Math.random().toString(36).slice(2),
  type: 'MULTIPLE_CHOICE', question: '', options: ['', '', '', ''],
  correctAnswer: '0', explanation: '', points: 10,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readingTime(text: string) {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
              i < step ? 'bg-[#F77B0F] text-white' : i === step ? 'bg-[#F77B0F] text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-[10px] mt-1 font-medium ${i === step ? 'text-[#F77B0F] dark:text-white' : 'text-gray-400'}`}>{label}</span>
          </div>
          {i < total - 1 && <div className={`w-12 h-0.5 mb-4 mx-1 ${i < step ? 'bg-[#F77B0F]' : 'bg-gray-200 dark:bg-white/10'}`} />}
        </div>
      ))}
    </div>
  );
}

// ─── Upload helpers ───────────────────────────────────────────────────────────

function pickFile(accept: string, handler: (file: File) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.onchange = () => { const f = input.files?.[0]; if (f) handler(f); };
  input.click();
}

async function uploadToS3(file: File, folder: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(`/media/upload?folder=${folder}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (res.data as any).data?.url ?? (res.data as any).url;
}

async function presignAndUpload(
  file: File,
  folder: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const presignRes = await api.post('/media/presign', { fileName: file.name, mimeType: file.type, folder });
  const { uploadUrl, publicUrl } = (presignRes.data as any).data ?? presignRes.data;
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    if (onProgress) xhr.upload.addEventListener('progress', e => e.lengthComputable && onProgress(Math.round(e.loaded * 100 / e.total)));
    xhr.onload = () => (xhr.status === 200 ? resolve() : reject(new Error(`Upload failed: ${xhr.status}`)));
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(file);
  });
  return publicUrl;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NewCoursePage() {
  const router = useRouter();
  const { addToast: showToast } = useToast();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [thumbUploading, setThumbUploading] = useState(false);

  // Step 1
  const [info, setInfo] = useState({
    title: '', subtitle: '', description: '', thumbnail: '',
    category: '', level: 'BEGINNER', language: 'English',
    price: 0, durationHours: 0, tags: '',
    whatYoullLearn: ['', '', '', ''],
    prerequisites: ['', ''],
    certEnabled: true,
    selectedTrainerId: '',
  });

  // Step 2
  const [modules, setModules] = useState<Module[]>([emptyModule()]);

  // Step 4
  const [cert, setCert] = useState({
    autoIssue: true, minPassingGrade: 70,
    gradeScale: true,
    templateStyle: 'PROFESSIONAL',
    customTemplateUrl: '',
    signatoryName: '',
    signatoryTitle: '',
    certNumberPrefix: 'CERT',
  });
  const [certTemplateUploading, setCertTemplateUploading] = useState(false);

  // Step 5
  const [settings, setSettings] = useState({
    aiDetection: true,
    readingMetrics: true,
    proctoring: false,
    accessType: 'LIFETIME',
    status: 'DRAFT' as 'DRAFT' | 'UNDER_REVIEW' | 'PUBLISHED',
  });

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    trainerService.getAll({ limit: 100 } as any).then(r => setTrainers((r as any).items ?? r ?? [])).catch(() => {});
    categoryService.getAll().then(r => setCategories(Array.isArray(r) ? r : (r as any).items ?? [])).catch(() => {});
  }, []);

  // ─── Module helpers ───────────────────────────────────────────────────────

  const updateModule = (mk: string, patch: Partial<Module>) =>
    setModules(ms => ms.map(m => m._key === mk ? { ...m, ...patch } : m));

  const addModule = () => setModules(ms => [...ms, emptyModule()]);
  const removeModule = (mk: string) => setModules(ms => ms.filter(m => m._key !== mk));

  const addLesson = (mk: string) =>
    setModules(ms => ms.map(m => m._key === mk ? { ...m, lessons: [...m.lessons, emptyLesson()] } : m));

  const removeLesson = (mk: string, lk: string) =>
    setModules(ms => ms.map(m => m._key === mk ? { ...m, lessons: m.lessons.filter(l => l._key !== lk) } : m));

  const updateLesson = (mk: string, lk: string, patch: Partial<Lesson>) =>
    setModules(ms => ms.map(m => m._key === mk ? { ...m, lessons: m.lessons.map(l => l._key === lk ? { ...l, ...patch } : l) } : m));

  const addQuestion = (mk: string, lk: string) =>
    setModules(ms => ms.map(m => m._key === mk ? {
      ...m, lessons: m.lessons.map(l => l._key === lk ? { ...l, questions: [...l.questions, emptyQuestion()] } : l)
    } : m));

  const removeQuestion = (mk: string, lk: string, qk: string) =>
    setModules(ms => ms.map(m => m._key === mk ? {
      ...m, lessons: m.lessons.map(l => l._key === lk ? { ...l, questions: l.questions.filter(q => q._key !== qk) } : l)
    } : m));

  const updateQuestion = (mk: string, lk: string, qk: string, patch: Partial<QuizQuestion>) =>
    setModules(ms => ms.map(m => m._key === mk ? {
      ...m, lessons: m.lessons.map(l => l._key === lk ? {
        ...l, questions: l.questions.map(q => q._key === qk ? { ...q, ...patch } : q)
      } : l)
    } : m));

  // ─── Thumbnail upload ─────────────────────────────────────────────────────

  const handleThumbUpload = useCallback(async (file: File) => {
    setThumbUploading(true);
    try {
      const url = await uploadToS3(file, 'thumbnails');
      setInfo(i => ({ ...i, thumbnail: url }));
      showToast('success', 'Thumbnail uploaded');
    } catch {
      showToast('error', 'Thumbnail upload failed');
    } finally {
      setThumbUploading(false);
    }
  }, [showToast]);

  // ─── Save / Publish ───────────────────────────────────────────────────────

  const handleSave = useCallback(async (publishStatus: 'DRAFT' | 'UNDER_REVIEW' | 'PUBLISHED') => {
    if (!info.title) { showToast('error', 'Title is required'); return; }
    if (!info.selectedTrainerId) { showToast('error', 'Select a trainer'); return; }
    setSaving(true);
    try {
      const tags = info.tags.split(',').map(t => t.trim()).filter(Boolean);
      const learn = info.whatYoullLearn.filter(Boolean);
      const prereqs = info.prerequisites.filter(Boolean);

      const settingsPayload = {
        aiDetection: settings.aiDetection,
        readingMetrics: settings.readingMetrics,
        proctoring: settings.proctoring,
        accessType: settings.accessType,
      };
      const certConfigPayload = {
        autoIssue: cert.autoIssue,
        minPassingGrade: cert.minPassingGrade,
        gradeScale: cert.gradeScale,
        templateStyle: cert.templateStyle,
        customTemplateUrl: cert.customTemplateUrl,
        signatoryName: cert.signatoryName,
        signatoryTitle: cert.signatoryTitle,
        certNumberPrefix: cert.certNumberPrefix,
      };

      let cid = courseId;
      if (!cid) {
        const course = await coursesService.create({
          title: info.title,
          description: [info.subtitle, info.description, learn.length ? `\n\nWhat you'll learn:\n${learn.map(l => `• ${l}`).join('\n')}` : '', prereqs.length ? `\nPrerequisites:\n${prereqs.map(p => `• ${p}`).join('\n')}` : ''].filter(Boolean).join('\n\n'),
          thumbnail: info.thumbnail || undefined,
          category: info.category || undefined,
          level: info.level,
          price: Number(info.price) || 0,
          duration: info.durationHours ? info.durationHours * 60 : undefined,
          tags,
          instructorId: info.selectedTrainerId,
          settings: settingsPayload,
          certConfig: certConfigPayload,
        });
        cid = course.id;
        setCourseId(cid);
      } else {
        await coursesService.update(cid, {
          title: info.title, category: info.category, level: info.level,
          price: Number(info.price), tags, status: publishStatus,
          settings: settingsPayload, certConfig: certConfigPayload,
        });
      }

      // Create modules + lessons
      for (let mi = 0; mi < modules.length; mi++) {
        const mod = modules[mi];
        let mid = mod.id;
        if (!mid) {
          const m = await coursesService.createMilestone(cid, { title: mod.title || `Module ${mi + 1}`, description: mod.description, orderIndex: mi, passingScore: mod.passingScore, weight: mod.weight });
          mid = m.id;
          setModules(ms => ms.map(mm => mm._key === mod._key ? { ...mm, id: mid } : mm));
        } else {
          await coursesService.updateMilestone(cid, mid, { title: mod.title, description: mod.description, passingScore: mod.passingScore, weight: mod.weight });
        }
        for (let li = 0; li < mod.lessons.length; li++) {
          const lesson = mod.lessons[li];
          let lid = lesson.id;
          if (!lid) {
            const l = await coursesService.addLesson(cid, {
              title: lesson.title || `Lesson ${li + 1}`, contentType: lesson.contentType,
              description: lesson.description, videoUrl: lesson.videoUrl || undefined,
              textContent: lesson.textContent || undefined, duration: lesson.duration,
              sortOrder: li, isFree: lesson.isFree, episodeNumber: lesson.episodeNumber || li + 1,
              milestoneId: mid,
            } as any);
            lid = l.id;
            updateLesson(mod._key, lesson._key, { id: lid });
          }
          // Save quiz questions for ALL quiz lessons (new or existing) — wipe and re-create so they stay in sync
          if ((lesson.contentType === 'QUIZ') && lesson.questions.length > 0) {
            const existing = await coursesService.getAssessments(cid, lid);
            for (const eq of existing) {
              await coursesService.deleteAssessment(cid, lid, eq.id);
            }
            for (const q of lesson.questions) {
              await coursesService.addAssessment(cid, lid, { question: q.question, type: q.type, options: q.options, correctAnswer: q.correctAnswer, points: q.points });
            }
          }
        }
      }

      // For new courses, status hasn't been set yet — do a final update to set the publish status
      if (!courseId) {
        await coursesService.update(cid, { status: publishStatus });
      }
      if (publishStatus === 'PUBLISHED') await coursesService.publish(cid);
      const msg = publishStatus === 'PUBLISHED' ? 'Course published!' : publishStatus === 'UNDER_REVIEW' ? 'Submitted for review!' : 'Course saved as draft';
      showToast('success', msg);
      router.push('/dashboard/courses');
    } catch (e: any) {
      showToast('error', e?.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [info, modules, courseId, settings, cert, router, showToast]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/courses')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div>
          <h1 className="text-xl font-black text-gray-900 dark:text-white">Course Builder</h1>
          <p className="text-sm text-gray-500">Build a fully-fledged institutional course</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="overflow-x-auto pb-2">
        <StepIndicator step={step} total={STEPS.length} />
      </div>

      {/* ─── Step 0: Course Info ─────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-5 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white text-base">Course Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Course Title *</label>
              <input value={info.title} onChange={e => setInfo(i => ({ ...i, title: e.target.value }))} className={ic} placeholder="e.g. Advanced Financial Modelling" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Tagline / Subtitle</label>
              <input value={info.subtitle} onChange={e => setInfo(i => ({ ...i, subtitle: e.target.value }))} className={ic} placeholder="One-line summary shown on course card" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Full Description</label>
              <textarea rows={4} value={info.description} onChange={e => setInfo(i => ({ ...i, description: e.target.value }))} className={ic + ' resize-none'} placeholder="Detailed course overview — objectives, target audience, outcomes..." />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Assigned Trainer *</label>
              <select value={info.selectedTrainerId} onChange={e => setInfo(i => ({ ...i, selectedTrainerId: e.target.value }))} className={ic}>
                <option value="">Select trainer…</option>
                {trainers.map(t => <option key={t.id} value={t.userId ?? t.id}>{t.user?.firstName} {t.user?.lastName} — {t.specialization}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Category</label>
              <select value={info.category} onChange={e => setInfo(i => ({ ...i, category: e.target.value }))} className={ic}>
                <option value="">Select category…</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Level</label>
              <select value={info.level} onChange={e => setInfo(i => ({ ...i, level: e.target.value }))} className={ic}>
                {['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'].map(l => <option key={l} value={l}>{l.replace('_', ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Language</label>
              <select value={info.language} onChange={e => setInfo(i => ({ ...i, language: e.target.value }))} className={ic}>
                {['English', 'Swahili', 'English & Swahili', 'French', 'Arabic'].map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Price (KES) — 0 for free</label>
              <input type="number" min={0} value={info.price} onChange={e => setInfo(i => ({ ...i, price: Number(e.target.value) }))} className={ic} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Estimated Duration (hours)</label>
              <input type="number" min={0} value={info.durationHours} onChange={e => setInfo(i => ({ ...i, durationHours: Number(e.target.value) }))} className={ic} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Tags (comma-separated)</label>
              <input value={info.tags} onChange={e => setInfo(i => ({ ...i, tags: e.target.value }))} className={ic} placeholder="finance, excel, modelling, cfa" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Course Thumbnail</label>
              {/* Upload zone */}
              <div
                onClick={() => !thumbUploading && pickFile('image/jpeg,image/png,image/webp,image/gif', handleThumbUpload)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleThumbUpload(f); }}
                className="cursor-pointer border-2 border-dashed border-gray-200 dark:border-white/10 rounded-lg p-4 flex flex-col items-center gap-2 hover:border-[#F77B0F]/60 transition-colors mb-2"
              >
                {info.thumbnail ? (
                  <img src={info.thumbnail} alt="thumbnail" className="h-24 rounded-lg object-cover" />
                ) : (
                  <>
                    <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span className="text-xs text-gray-400">{thumbUploading ? 'Uploading…' : 'Click or drag & drop to upload thumbnail'}</span>
                  </>
                )}
                {thumbUploading && <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-[#F77B0F] animate-pulse w-2/3" /></div>}
              </div>
              {/* URL fallback */}
              <input
                value={info.thumbnail}
                onChange={e => setInfo(i => ({ ...i, thumbnail: e.target.value }))}
                className={ic}
                placeholder="Or paste URL here — auto-filled after upload"
              />
            </div>
          </div>

          {/* What you'll learn */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">What Students Will Learn (up to 8 outcomes)</label>
            <div className="space-y-2">
              {info.whatYoullLearn.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-[#F77B0F] text-xs font-bold w-5 shrink-0">✓</span>
                  <input value={v} onChange={e => setInfo(ii => ({ ...ii, whatYoullLearn: ii.whatYoullLearn.map((x, j) => j === i ? e.target.value : x) }))} className={ic} placeholder={`Learning outcome ${i + 1}`} />
                  {i >= 4 && <button onClick={() => setInfo(ii => ({ ...ii, whatYoullLearn: ii.whatYoullLearn.filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-500 text-xs">✕</button>}
                </div>
              ))}
              {info.whatYoullLearn.length < 8 && (
                <button onClick={() => setInfo(ii => ({ ...ii, whatYoullLearn: [...ii.whatYoullLearn, ''] }))} className="text-xs text-[#F77B0F] dark:text-blue-400 font-medium hover:underline">+ Add outcome</button>
              )}
            </div>
          </div>

          {/* Prerequisites */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">Prerequisites</label>
            <div className="space-y-2">
              {info.prerequisites.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-gray-400 text-xs w-5 shrink-0">→</span>
                  <input value={v} onChange={e => setInfo(ii => ({ ...ii, prerequisites: ii.prerequisites.map((x, j) => j === i ? e.target.value : x) }))} className={ic} placeholder={`Prerequisite ${i + 1}`} />
                  {i >= 2 && <button onClick={() => setInfo(ii => ({ ...ii, prerequisites: ii.prerequisites.filter((_, j) => j !== i) }))} className="text-gray-400 hover:text-red-500 text-xs">✕</button>}
                </div>
              ))}
              {info.prerequisites.length < 6 && (
                <button onClick={() => setInfo(ii => ({ ...ii, prerequisites: [...ii.prerequisites, ''] }))} className="text-xs text-[#F77B0F] dark:text-blue-400 font-medium hover:underline">+ Add prerequisite</button>
              )}
            </div>
          </div>

          {/* Certificate toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`relative w-11 h-6 rounded-full transition-colors ${info.certEnabled ? 'bg-[#F77B0F]' : 'bg-gray-300 dark:bg-white/20'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${info.certEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              <input type="checkbox" className="sr-only" checked={info.certEnabled} onChange={e => setInfo(i => ({ ...i, certEnabled: e.target.checked }))} />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Issue completion certificate</span>
          </label>
        </div>
      )}

      {/* ─── Step 1: Curriculum ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 dark:text-white">Curriculum — Modules & Lessons</h2>
            <button onClick={addModule} className="px-3 py-1.5 text-xs font-medium border border-[#F77B0F] dark:border-white/20 text-[#F77B0F] dark:text-white rounded-lg hover:bg-gray-50 dark:hover:bg-white/10">+ Add Module</button>
          </div>

          {modules.map((mod, mi) => (
            <div key={mod._key} className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
              {/* Module header */}
              <div className="bg-gray-50 dark:bg-white/5 px-4 py-3 flex gap-3 items-start">
                <div className="w-7 h-7 rounded-lg bg-[#F77B0F] text-white text-xs font-black flex items-center justify-center shrink-0">{mi + 1}</div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input value={mod.title} onChange={e => updateModule(mod._key, { title: e.target.value })} className={ic + ' !bg-white dark:!bg-white/10'} placeholder={`Module ${mi + 1} title`} />
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Pass %</label>
                    <input type="number" min={0} max={100} value={mod.passingScore} onChange={e => updateModule(mod._key, { passingScore: Number(e.target.value) })} className={ic + ' !bg-white dark:!bg-white/10'} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Weight</label>
                    <input type="number" min={1} value={mod.weight} onChange={e => updateModule(mod._key, { weight: Number(e.target.value) })} className={ic + ' !bg-white dark:!bg-white/10'} />
                  </div>
                </div>
                {modules.length > 1 && (
                  <button onClick={() => removeModule(mod._key)} className="text-gray-400 hover:text-red-500 text-sm shrink-0">✕</button>
                )}
              </div>

              {/* Lessons */}
              <div className="p-4 space-y-3">
                {mod.lessons.map((lesson, li) => (
                  <LessonRow
                    key={lesson._key}
                    lesson={lesson}
                    index={li}
                    onUpdate={patch => updateLesson(mod._key, lesson._key, patch)}
                    onRemove={() => removeLesson(mod._key, lesson._key)}
                    canRemove={mod.lessons.length > 1}
                  />
                ))}
                <button onClick={() => addLesson(mod._key)} className="w-full py-2 border border-dashed border-gray-300 dark:border-white/20 rounded-lg text-xs text-gray-500 hover:text-gray-700 dark:hover:text-white hover:border-gray-400 transition-colors">+ Add Lesson to Module {mi + 1}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Step 2: Assessments ─────────────────────────────────────────────── */}
      {step === 2 && (() => {
        const assessableLessons = modules.flatMap(mod =>
          mod.lessons.filter(l => l.contentType === 'QUIZ' || l.contentType === 'ASSIGNMENT').map(l => ({ mod, lesson: l }))
        );
        return (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold text-gray-900 dark:text-white">Assessments & Quiz Builder</h2>
                <p className="text-sm text-gray-500 mt-0.5">Build questions for every Quiz or Assignment lesson in your course.</p>
              </div>
              <button
                onClick={() => {
                  const firstMod = modules[0];
                  setModules(ms => ms.map(m => m._key === firstMod._key
                    ? { ...m, lessons: [...m.lessons, { ...emptyLesson(), contentType: 'QUIZ', title: 'Quiz' }] }
                    : m
                  ));
                  showToast('success', 'Quiz lesson added to Module 1 — build its questions below');
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Quick-add Quiz Lesson
              </button>
            </div>

            {assessableLessons.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-white/10 p-10 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                  <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No quiz or assignment lessons yet</p>
                  <p className="text-xs text-gray-400 mt-1">Click <strong>"Quick-add Quiz Lesson"</strong> above to create one here, or go back to Curriculum and change any lesson type to <strong>QUIZ</strong> or <strong>ASSIGNMENT</strong>.</p>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => setStep(1)} className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
                    ← Go to Curriculum
                  </button>
                </div>
              </div>
            ) : (
              assessableLessons.map(({ mod, lesson }) => (
                <QuizBuilder
                  key={lesson._key}
                  lesson={lesson}
                  moduleName={mod.title || 'Module'}
                  onAddQuestion={() => addQuestion(mod._key, lesson._key)}
                  onRemoveQuestion={qk => removeQuestion(mod._key, lesson._key, qk)}
                  onUpdateQuestion={(qk, patch) => updateQuestion(mod._key, lesson._key, qk, patch)}
                />
              ))
            )}
          </div>
        );
      })()}

      {/* ─── Step 3: Certification ───────────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">

          {/* Issuance */}
          <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white">Certificate Issuance</h2>

            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${cert.autoIssue ? 'bg-[#F77B0F]' : 'bg-gray-300 dark:bg-white/20'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cert.autoIssue ? 'translate-x-5' : 'translate-x-0.5'}`} />
                <input type="checkbox" className="sr-only" checked={cert.autoIssue} onChange={e => setCert(c => ({ ...c, autoIssue: e.target.checked }))} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Auto-issue certificate on completion</p>
                <p className="text-xs text-gray-500">Certificate generated automatically when student meets the passing grade</p>
              </div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Minimum Passing Grade (%)</label>
                <input type="number" min={0} max={100} value={cert.minPassingGrade} onChange={e => setCert(c => ({ ...c, minPassingGrade: Number(e.target.value) }))} className={ic} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Cert Number Prefix</label>
                <input value={cert.certNumberPrefix} onChange={e => setCert(c => ({ ...c, certNumberPrefix: e.target.value }))} className={ic} placeholder="e.g. CERT, SKS, TRN" />
              </div>
              <div className="flex items-end">
                <div className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-xs text-gray-400">
                  Preview: <span className="font-mono text-gray-700 dark:text-gray-200">{cert.certNumberPrefix}-2024-0001</span>
                </div>
              </div>
            </div>

            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`relative w-11 h-6 rounded-full transition-colors ${cert.gradeScale ? 'bg-[#F77B0F]' : 'bg-gray-300 dark:bg-white/20'}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${cert.gradeScale ? 'translate-x-5' : 'translate-x-0.5'}`} />
                <input type="checkbox" className="sr-only" checked={cert.gradeScale} onChange={e => setCert(c => ({ ...c, gradeScale: e.target.checked }))} />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Show letter grade on certificate</p>
                <p className="text-xs text-gray-500">A (90–100%) · B (75–89%) · C (60–74%)</p>
              </div>
            </label>

            {/* Grade scale */}
            <div className="grid grid-cols-4 gap-2 text-center">
              {[['A', '90–100%', 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'], ['B', '75–89%', 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'], ['C', '60–74%', 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'], ['F', `<${cert.minPassingGrade}%`, 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400']].map(([g, r, cls]) => (
                <div key={g} className={`rounded-lg px-2 py-3 ${cls}`}>
                  <p className="text-xl font-black">{g}</p>
                  <p className="text-[11px] mt-0.5">{r}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Signatory */}
          <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white">Signatory Details</h2>
            <p className="text-xs text-gray-400">Printed on the certificate under the signature line.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Signatory Name</label>
                <input value={cert.signatoryName} onChange={e => setCert(c => ({ ...c, signatoryName: e.target.value }))} className={ic} placeholder="e.g. Dr. Jane Wanjiku" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Signatory Title</label>
                <input value={cert.signatoryTitle} onChange={e => setCert(c => ({ ...c, signatoryTitle: e.target.value }))} className={ic} placeholder="e.g. Director of Learning" />
              </div>
            </div>
          </div>

          {/* Template */}
          <div className="bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-6 space-y-4">
            <h2 className="font-bold text-gray-900 dark:text-white">Certificate Template</h2>

            {/* Preset tiles */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'PROFESSIONAL', label: 'Professional', sub: 'Navy + Gold', colors: 'from-[#F77B0F] to-[#1a3480]', accent: 'text-yellow-300' },
                { id: 'MODERN', label: 'Modern', sub: 'White + Orange', colors: 'from-white to-gray-50', accent: 'text-[#F77B0F]', dark: true },
                { id: 'CLASSIC', label: 'Classic', sub: 'Cream + Seal', colors: 'from-amber-50 to-yellow-100', accent: 'text-amber-800', dark: true },
                { id: 'CUSTOM', label: 'Custom Upload', sub: 'Your own template', colors: 'from-gray-100 to-gray-200 dark:from-white/5 dark:to-white/10', accent: 'text-gray-500', icon: true },
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCert(c => ({ ...c, templateStyle: t.id }))}
                  className={`relative rounded-xl border-2 overflow-hidden transition-all ${cert.templateStyle === t.id ? 'border-[#F77B0F] shadow-md' : 'border-gray-200 dark:border-white/10 hover:border-gray-300'}`}
                >
                  <div className={`bg-gradient-to-br ${t.colors} p-5 flex flex-col items-center gap-1`}>
                    {t.icon ? (
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    ) : (
                      <svg className={`w-8 h-8 ${t.accent}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                    )}
                    <p className={`text-xs font-bold mt-1 ${t.dark ? 'text-gray-800' : 'text-white'}`}>{t.label}</p>
                    <p className={`text-[10px] ${t.dark ? 'text-gray-500' : 'text-white/70'}`}>{t.sub}</p>
                  </div>
                  {cert.templateStyle === t.id && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-[#F77B0F] rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Custom template upload — shown when CUSTOM selected */}
            {cert.templateStyle === 'CUSTOM' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400">Upload Certificate Template</label>
                <p className="text-xs text-gray-400">Upload a pre-designed PDF or image (A4 landscape). We'll overlay student name, date, grade, and cert number automatically.</p>
                <div
                  onClick={() => !certTemplateUploading && pickFile('image/*,.pdf', async (file) => {
                    setCertTemplateUploading(true);
                    try {
                      const url = await uploadToS3(file, 'certificates');
                      setCert(c => ({ ...c, customTemplateUrl: url }));
                      showToast('success', 'Certificate template uploaded');
                    } catch { showToast('error', 'Template upload failed'); }
                    finally { setCertTemplateUploading(false); }
                  })}
                  className="cursor-pointer border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-[#F77B0F]/50 transition-colors"
                >
                  {certTemplateUploading ? (
                    <>
                      <span className="w-6 h-6 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-gray-400">Uploading template…</p>
                    </>
                  ) : cert.customTemplateUrl ? (
                    <>
                      {cert.customTemplateUrl.match(/\.(jpg|jpeg|png|webp)$/i) && (
                        <img src={cert.customTemplateUrl} alt="template" className="max-h-40 rounded-lg object-contain border border-gray-200" />
                      )}
                      <p className="text-xs text-green-600 font-medium">✓ Template uploaded</p>
                      <p className="text-[11px] text-gray-400 underline">Click to replace</p>
                    </>
                  ) : (
                    <>
                      <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      <p className="text-sm font-medium text-gray-500">Click or drag to upload template</p>
                      <p className="text-xs text-gray-400">PDF or image · A4 landscape recommended</p>
                    </>
                  )}
                </div>
                {cert.customTemplateUrl && (
                  <input value={cert.customTemplateUrl} onChange={e => setCert(c => ({ ...c, customTemplateUrl: e.target.value }))} className={ic} placeholder="Or paste template URL" />
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Step 4: Publish Settings ─────────────────────────────────────────── */}
      {step === 4 && (
        <div className="space-y-5 bg-white dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 p-6">
          <h2 className="font-bold text-gray-900 dark:text-white">Settings & Publish</h2>

          <div className="space-y-4">
            {([
              ['aiDetection', 'AI Plagiarism Detection', 'Flag AI-generated or plagiarised submission content'],
              ['readingMetrics', 'Reading Time Tracking', 'Track average reading time per text lesson for engagement analytics'],
              ['proctoring', 'Quiz Proctoring', 'Require webcam verification during timed assessments'],
            ] as [keyof typeof settings, string, string][]).map(([key, label, desc]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <div className={`relative w-11 h-6 rounded-full transition-colors ${settings[key] ? 'bg-[#F77B0F]' : 'bg-gray-300 dark:bg-white/20'}`}>
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${settings[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  <input type="checkbox" className="sr-only" checked={!!settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: e.target.checked }))} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Course Access</label>
              <select value={settings.accessType} onChange={e => setSettings(s => ({ ...s, accessType: e.target.value }))} className={ic}>
                <option value="LIFETIME">Lifetime access</option>
                <option value="30_DAYS">30 days</option>
                <option value="90_DAYS">90 days</option>
                <option value="1_YEAR">1 year</option>
              </select>
            </div>
          </div>

          {/* Publish action */}
          <div className="border border-gray-200 dark:border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Ready to go?</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button onClick={() => handleSave('DRAFT')} disabled={saving} className="px-4 py-2.5 text-sm font-medium border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50">
                {saving ? '…' : 'Save Draft'}
              </button>
              <button onClick={() => handleSave('UNDER_REVIEW')} disabled={saving} className="px-4 py-2.5 text-sm font-medium border border-[#F77B0F] dark:border-white/20 text-[#F77B0F] dark:text-white rounded-lg hover:bg-blue-50 dark:hover:bg-white/10 disabled:opacity-50">
                {saving ? '…' : 'Submit for Review'}
              </button>
              <button onClick={() => handleSave('PUBLISHED')} disabled={saving} className="px-4 py-2.5 text-sm font-medium bg-[#F77B0F] hover:bg-[#e06a00] text-white rounded-lg disabled:opacity-50">
                {saving ? 'Publishing…' : 'Publish Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Navigation ──────────────────────────────────────────────────────── */}
      <div className="flex justify-between pt-2">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="px-5 py-2 text-sm font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-30">
          ← Back
        </button>
        {step < STEPS.length - 1 && (
          <button onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))} className="px-5 py-2 text-sm font-medium bg-[#F77B0F] hover:bg-[#1a3480] text-white rounded-lg">
            Next →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Lesson Row Component ─────────────────────────────────────────────────────

function LessonRow({ lesson, index, onUpdate, onRemove, canRemove }: {
  lesson: Lesson; index: number;
  onUpdate: (patch: Partial<Lesson>) => void;
  onRemove: () => void; canRemove: boolean;
}) {
  const ic = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/40';
  const { addToast: toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [docUploading, setDocUploading] = useState(false);

  const handleVideoUpload = async (file: File) => {
    setVideoUploading(true); setVideoProgress(0);
    try {
      const url = await presignAndUpload(file, 'videos', pct => setVideoProgress(pct));
      onUpdate({ videoUrl: url });
      toast('success', `"${lesson.title || `Lesson ${index + 1}`}" video uploaded — ready to publish`);
    } catch {
      toast('error', `Video upload failed for "${lesson.title || `Lesson ${index + 1}`}"`);
    } finally { setVideoUploading(false); }
  };

  const handleDocUpload = async (file: File) => {
    setDocUploading(true);
    try {
      const url = await uploadToS3(file, 'documents');
      onUpdate({ videoUrl: url });
      toast('success', `Document attached to "${lesson.title || `Lesson ${index + 1}`}"`);
    } catch {
      toast('error', 'Document upload failed');
    } finally { setDocUploading(false); }
  };

  const TYPE_COLORS: Record<string, string> = {
    VIDEO: 'bg-purple-100 text-purple-700', TEXT: 'bg-blue-100 text-blue-700',
    QUIZ: 'bg-amber-100 text-amber-700', ASSIGNMENT: 'bg-teal-100 text-teal-700',
    LIVE: 'bg-green-100 text-green-700',
  };

  return (
    <div className={`rounded-xl overflow-hidden border transition-all ${videoUploading ? 'border-[#F77B0F]/40 shadow-sm' : 'border-gray-100 dark:border-white/5'}`}>

      {/* ── Row header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-white/5">
        <span className="text-xs font-semibold text-gray-400 w-5 shrink-0 text-center">{index + 1}</span>

        <select
          value={lesson.contentType}
          onChange={e => onUpdate({ contentType: e.target.value as any })}
          className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-800 dark:text-white focus:outline-none shrink-0"
        >
          {['VIDEO', 'TEXT', 'QUIZ', 'ASSIGNMENT', 'LIVE'].map(t => <option key={t}>{t}</option>)}
        </select>

        <input
          value={lesson.title}
          onChange={e => onUpdate({ title: e.target.value })}
          className="flex-1 text-sm bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 min-w-0"
          placeholder="Lesson title…"
        />

        {/* ── Upload status chip — VIDEO ── */}
        {lesson.contentType === 'VIDEO' && (
          videoUploading ? (
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F77B0F]/10 border border-[#F77B0F]/30">
              <span className="w-3 h-3 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-xs font-semibold text-[#F77B0F] whitespace-nowrap">{videoProgress}% uploading…</span>
            </div>
          ) : lesson.videoUrl ? (
            <div className="shrink-0 flex items-center gap-1.5">
              <span className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Video ready
              </span>
              <button
                type="button"
                onClick={() => pickFile('video/*', handleVideoUpload)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-white underline"
              >
                Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => pickFile('video/*', handleVideoUpload)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F77B0F] hover:bg-[#1a3480] active:scale-95 text-white text-xs font-semibold transition-all cursor-pointer select-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Upload Video
            </button>
          )
        )}

        {/* ── Upload status chip — TEXT ── */}
        {lesson.contentType === 'TEXT' && (
          docUploading ? (
            <div className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200">
              <span className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="text-xs font-semibold text-blue-600 whitespace-nowrap">Uploading…</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => pickFile('.pdf,.doc,.docx,.ppt,.pptx', handleDocUpload)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 hover:border-[#F77B0F] hover:text-[#F77B0F] text-gray-500 dark:text-gray-400 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              {lesson.videoUrl ? 'Doc attached' : 'Attach Doc'}
            </button>
          )
        )}

        <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer shrink-0 ml-1">
          <input type="checkbox" checked={lesson.isFree} onChange={e => onUpdate({ isFree: e.target.checked })} className="rounded" />
          Free
        </label>
        <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-colors shrink-0">
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {canRemove && (
          <button onClick={onRemove} className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* ── Upload progress bar — spans full width, visible even when collapsed ── */}
      {videoUploading && (
        <div className="h-1 w-full bg-gray-100 dark:bg-white/10">
          <div className="h-full bg-[#F77B0F] transition-all duration-300" style={{ width: `${videoProgress}%` }} />
        </div>
      )}

      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-3 bg-gray-50 dark:bg-white/3 border-t border-gray-100 dark:border-white/5">
          <textarea rows={2} value={lesson.description} onChange={e => onUpdate({ description: e.target.value })} className={ic + ' resize-none'} placeholder="Lesson description…" />

          {lesson.contentType === 'VIDEO' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Video URL (auto-filled after upload)</label>
                <input value={lesson.videoUrl} onChange={e => onUpdate({ videoUrl: e.target.value })} className={ic} placeholder="Paste URL or use Upload Video above" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                <input type="number" min={0} value={lesson.duration} onChange={e => onUpdate({ duration: Number(e.target.value) })} className={ic} />
              </div>
            </div>
          )}

          {lesson.contentType === 'TEXT' && (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs text-gray-500">Text Content</label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{readingTime(lesson.textContent)} min read</span>
                  <button type="button" onClick={() => pickFile('.pdf,.doc,.docx,.ppt,.pptx', handleDocUpload)} disabled={docUploading} className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-white/10 text-gray-500 hover:text-[#F77B0F] hover:border-[#F77B0F] disabled:opacity-50">
                    {docUploading ? 'Uploading…' : '↑ Upload Doc'}
                  </button>
                </div>
              </div>
              <textarea rows={6} value={lesson.textContent} onChange={e => onUpdate({ textContent: e.target.value })} className={ic + ' resize-none font-mono text-xs'} placeholder="Full lesson content — markdown supported…" />
              {lesson.videoUrl && <p className="text-xs text-gray-400 mt-1">Attached doc: <a href={lesson.videoUrl} target="_blank" rel="noreferrer" className="text-[#F77B0F] dark:text-blue-400 underline truncate">{lesson.videoUrl.split('/').pop()}</a></p>}
            </div>
          )}

          {lesson.contentType === 'QUIZ' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Allowed Attempts</label>
                <input type="number" min={1} value={lesson.maxAttempts} onChange={e => onUpdate({ maxAttempts: Number(e.target.value) })} className={ic} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Time Limit (min, 0 = none)</label>
                <input type="number" min={0} value={lesson.timeLimitMin} onChange={e => onUpdate({ timeLimitMin: Number(e.target.value) })} className={ic} />
              </div>
            </div>
          )}

          {lesson.contentType === 'ASSIGNMENT' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Assignment Instructions</label>
              <textarea rows={4} value={lesson.assignmentInstructions} onChange={e => onUpdate({ assignmentInstructions: e.target.value })} className={ic + ' resize-none'} placeholder="Detailed assignment instructions, rubric, submission format…" />
            </div>
          )}

          {lesson.contentType === 'LIVE' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Live Session Join URL</label>
                <input value={lesson.videoUrl} onChange={e => onUpdate({ videoUrl: e.target.value })} className={ic} placeholder="https://meet.google.com/… or Zoom link" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Duration (min)</label>
                <input type="number" min={0} value={lesson.duration} onChange={e => onUpdate({ duration: Number(e.target.value) })} className={ic} />
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Episode #</label>
              <input type="number" min={1} value={lesson.episodeNumber || index + 1} onChange={e => onUpdate({ episodeNumber: Number(e.target.value) })} className={ic} />
            </div>
            <div className={`px-2 py-1 rounded text-xs font-medium mt-4 ${TYPE_COLORS[lesson.contentType] ?? 'bg-gray-100 text-gray-600'}`}>{lesson.contentType}</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quiz Builder Component ───────────────────────────────────────────────────

function QuizBuilder({ lesson, moduleName, onAddQuestion, onRemoveQuestion, onUpdateQuestion }: {
  lesson: Lesson; moduleName: string;
  onAddQuestion: () => void;
  onRemoveQuestion: (qk: string) => void;
  onUpdateQuestion: (qk: string, patch: Partial<QuizQuestion>) => void;
}) {
  const ic = 'w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/40';

  return (
    <div className="border border-gray-200 dark:border-white/10 rounded-xl overflow-hidden">
      <div className="bg-gray-50 dark:bg-white/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">{lesson.title || 'Untitled lesson'}</p>
          <p className="text-xs text-gray-500">{moduleName} · {lesson.contentType} · {lesson.questions.length} question{lesson.questions.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={onAddQuestion} className="text-xs font-medium px-3 py-1.5 border border-[#F77B0F] dark:border-white/20 text-[#F77B0F] dark:text-white rounded-lg hover:bg-blue-50 dark:hover:bg-white/10">+ Question</button>
      </div>

      <div className="p-4 space-y-4">
        {lesson.questions.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">No questions yet. Click "+ Question" to add one.</p>
        )}
        {lesson.questions.map((q, qi) => (
          <div key={q._key} className="border border-gray-100 dark:border-white/10 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500">Q{qi + 1}</span>
              <div className="flex items-center gap-3">
                <select value={q.type} onChange={e => onUpdateQuestion(q._key, { type: e.target.value as any })} className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-700 dark:text-white focus:outline-none">
                  {['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'ESSAY', 'FILE_UPLOAD'].map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
                </select>
                <input type="number" min={1} value={q.points} onChange={e => onUpdateQuestion(q._key, { points: Number(e.target.value) })} className="w-16 text-xs px-2 py-1 rounded border border-gray-200 dark:border-white/10 bg-white dark:bg-white/10 text-gray-700 dark:text-white focus:outline-none text-center" placeholder="pts" />
                <button onClick={() => onRemoveQuestion(q._key)} className="text-gray-300 hover:text-red-500">✕</button>
              </div>
            </div>

            <textarea rows={2} value={q.question} onChange={e => onUpdateQuestion(q._key, { question: e.target.value })} className={ic + ' resize-none'} placeholder="Question text…" />

            {q.type === 'MULTIPLE_CHOICE' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Options — click radio to mark correct</p>
                {q.options.map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type="radio" name={q._key} checked={q.correctAnswer === String(oi)} onChange={() => onUpdateQuestion(q._key, { correctAnswer: String(oi) })} className="text-[#F77B0F] shrink-0" />
                    <input value={opt} onChange={e => { const opts = [...q.options]; opts[oi] = e.target.value; onUpdateQuestion(q._key, { options: opts }); }} className={ic + ' !py-1.5'} placeholder={`Option ${String.fromCharCode(65 + oi)}`} />
                  </div>
                ))}
                {q.options.length < 6 && (
                  <button onClick={() => onUpdateQuestion(q._key, { options: [...q.options, ''] })} className="text-xs text-[#F77B0F] dark:text-blue-400 hover:underline">+ Add option</button>
                )}
              </div>
            )}

            {q.type === 'TRUE_FALSE' && (
              <div className="flex gap-4">
                {['True', 'False'].map(v => (
                  <label key={v} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name={q._key} checked={q.correctAnswer === v} onChange={() => onUpdateQuestion(q._key, { correctAnswer: v })} className="text-[#F77B0F]" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{v}</span>
                  </label>
                ))}
              </div>
            )}

            {(q.type === 'SHORT_ANSWER' || q.type === 'ESSAY') && (
              <input value={q.correctAnswer} onChange={e => onUpdateQuestion(q._key, { correctAnswer: e.target.value })} className={ic} placeholder="Model answer / marking guide…" />
            )}

            {q.type === 'FILE_UPLOAD' && (
              <p className="text-xs text-gray-400 italic">Students will upload a file. Grade manually.</p>
            )}

            <input value={q.explanation} onChange={e => onUpdateQuestion(q._key, { explanation: e.target.value })} className={ic} placeholder="Explanation shown after answering (optional)…" />
          </div>
        ))}
      </div>
    </div>
  );
}
