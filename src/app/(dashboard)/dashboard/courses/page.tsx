'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { LineTrend, BarCompare, DonutBreakdown } from '@/components/Charts';
import { coursesService, Course, CourseLesson, LessonQuestion, CreateLessonData } from '@/lib/services/coursesService';
import { trainerService } from '@/lib/services/trainerService';
import { categoryService } from '@/lib/services/categoryService';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';
import api, { unwrap } from '@/lib/api';
import { Trainer, Category } from '@/lib/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const UNSPLASH_FALLBACKS = [
  'https://images.unsplash.com/photo-1531482615713-2afd69097998?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&w=800&q=80',
];

const LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'ALL_LEVELS'];
const CONTENT_TYPES = ['VIDEO', 'TEXT', 'QUIZ', 'ASSIGNMENT'];

const LEVEL_BADGE: Record<string, string> = {
  BEGINNER: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  INTERMEDIATE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ADVANCED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ALL_LEVELS: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const CONTENT_TYPE_BADGE: Record<string, string> = {
  VIDEO: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  TEXT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  QUIZ: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ASSIGNMENT: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
};

type TabKey = 'all' | 'create' | 'analytics';

const ic = 'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/30';

// ─── Helper: Stars ──────────────────────────────────────────────────────────

// ─── Rich Text Content Renderer ─────────────────────────────────────────────
function LessonContent({ content }: { content: string }) {
  if (!content) return null;
  const urlPattern = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlPattern);
  return (
    <div className="space-y-3 text-sm text-card-foreground">
      {parts.map((part, i) => {
        if (part.match(/^https?:\/\//)) {
          const cleanUrl = part.replace(/[.,;)\]]+$/, '');
          if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?|$)/i.test(cleanUrl)) {
            return <img key={i} src={cleanUrl} alt="" className="max-w-full rounded-lg border border-border" />;
          }
          if (/\.pdf(\?|$)/i.test(cleanUrl)) {
            return (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                  <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-red-700 dark:text-red-300 hover:underline flex-1 truncate">{cleanUrl.split('/').pop()}</a>
                  <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-red-700 dark:text-red-300 px-2 py-1 rounded bg-red-100 dark:bg-red-900/50 hover:bg-red-200">Open</a>
                </div>
                <iframe src={cleanUrl} className="w-full h-[500px] rounded-lg border border-border" title="PDF preview" />
              </div>
            );
          }
          if (/\.(doc|docx|ppt|pptx|xls|xlsx)(\?|$)/i.test(cleanUrl)) {
            const officeViewer = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(cleanUrl)}`;
            const ext = cleanUrl.match(/\.(doc|docx|ppt|pptx|xls|xlsx)(\?|$)/i)?.[1]?.toLowerCase() || 'doc';
            return (
              <div key={i} className="space-y-2">
                <div className="flex items-center gap-2 p-3  border border-blue-200 dark:border-blue-800 rounded-lg">
                  <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
                  <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-700 dark:text-blue-300 hover:underline flex-1 truncate">{cleanUrl.split('/').pop()}</a>
                  <span className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">{ext}</span>
                  <a href={cleanUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-blue-700 dark:text-blue-300 px-2 py-1 rounded bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200">Download</a>
                </div>
                <iframe src={officeViewer} className="w-full h-[500px] rounded-lg border border-border" title="Document preview" />
              </div>
            );
          }
          return <a key={i} href={cleanUrl} target="_blank" rel="noopener noreferrer" className="text-[#F77B0F] dark:text-[#5b8bc7] hover:underline break-all">{cleanUrl}</a>;
        }
        if (!part.trim()) return null;
        return <p key={i} className="whitespace-pre-wrap leading-relaxed">{part}</p>;
      })}
    </div>
  );
}

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} className={`${s} ${i <= Math.round(rating) ? 'text-[#F77B0F]' : 'text-gray-200 dark:text-gray-700'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ─── Main page ──────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const { addToast } = useToast();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('all');

  // ── Shared data ──
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // ── Filters ──
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [trainerTypeFilter, setTrainerTypeFilter] = useState('');

  // ── Categories (for dropdown) ──
  const [categories, setCategories] = useState<Category[]>([]);

  // ── Action state ──
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ── Detail modal ──
  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // lessonId → assessment array (lazy-loaded when quiz row is expanded)
  const [lessonQuestions, setLessonQuestions] = useState<Record<string, any[]>>({});

  // ── Edit Lesson ──
  const [editingLesson, setEditingLesson] = useState<{ courseId: string; lesson: any } | null>(null);
  const [editLessonForm, setEditLessonForm] = useState({ title: '', description: '', contentType: 'VIDEO', duration: 30, sortOrder: 1, isFree: false, content: '', videoUrl: '', timeLimitMin: 0, maxAttempts: 0 });
  const [savingLesson, setSavingLesson] = useState(false);
  const [uploadingLessonVideo, setUploadingLessonVideo] = useState(false);
  const [editLessonQuestions, setEditLessonQuestions] = useState<any[]>([]);
  const [loadingEditQuestions, setLoadingEditQuestions] = useState(false);

  // ── Add Lesson ──
  const [addingLessonForCourse, setAddingLessonForCourse] = useState<string | null>(null);
  const [addLessonForm, setAddLessonForm] = useState({ title: '', description: '', contentType: 'VIDEO', duration: 30, sortOrder: 1, isFree: false, content: '', videoUrl: '' });
  const [addLessonSaving, setAddLessonSaving] = useState(false);
  const [addLessonUploading, setAddLessonUploading] = useState(false);

  // ── Create tab state ──
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [trainerSearch, setTrainerSearch] = useState('');
  const [selectedTrainer, setSelectedTrainer] = useState<Trainer | null>(null);
  const [showTrainerDropdown, setShowTrainerDropdown] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', category: '', level: 'BEGINNER', price: 0, tags: '',
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');

  // ── Lessons builder (inline in create tab) ──
  const [lessons, setLessons] = useState<(CreateLessonData & { _key: string; _questions: { question: string; type: string; options: string[]; correctAnswer: string; explanation: string; points: number }[] })[]>([]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch categories once
  useEffect(() => {
    categoryService.getAll().then(setCategories).catch(() => {});
  }, []);

  // ── Fetch courses ──
  const fetchCourses = useCallback(async () => {
    setLoading(true);
    try {
      const data = await coursesService.list({
        page, limit: 20,
        search: debouncedSearch || undefined,
        status: statusFilter || 'ALL',
        category: categoryFilter || undefined,
        level: levelFilter || undefined,
      });
      setCourses(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch {
      addToast('error', 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, statusFilter, categoryFilter, levelFilter, addToast]);

  useEffect(() => { fetchCourses(); }, [fetchCourses]);

  // ── Fetch trainers for create tab ──
  useEffect(() => {
    if (tab === 'create') {
      trainerService.getAll({ limit: 100 }).then(d => setTrainers(d.items || [])).catch(() => {});
    }
  }, [tab]);

  // ── Helper: get course thumbnail ──
  function getThumb(c: Course, idx: number) {
    return c.thumbnail || c.thumbnailUrl || UNSPLASH_FALLBACKS[idx % UNSPLASH_FALLBACKS.length];
  }

  // ── Helper: get enrolled count ──
  function getEnrolled(c: Course) {
    return c.totalEnrolled || c.enrolledCount || c._count?.enrollments || 0;
  }

  // ── Helper: get lesson count ──
  function getLessonCount(c: Course) {
    return c.lessons?.length || c._count?.lessons || 0;
  }

  // ── Helper: lesson content breakdown ──
  function getLessonBreakdown(c: Course) {
    const ls = c.lessons || [];
    if (ls.length === 0) return '';
    const types: Record<string, number> = {};
    for (const l of ls) {
      const t = (l.contentType || l.type || 'OTHER').toUpperCase();
      types[t] = (types[t] || 0) + 1;
    }
    return Object.entries(types).map(([t, n]) => `${n} ${t.toLowerCase()}`).join(', ');
  }

  // ── Helper: category name ──
  function getCatName(c: Course) {
    if (typeof c.category === 'object' && c.category) return c.category.name;
    return c.category as string || '';
  }

  // ── Helper: instructor display ──
  function getInstructor(c: Course) {
    const i = c.instructor;
    if (!i) return null;
    const name = i.name || `${i.firstName || ''} ${i.lastName || ''}`.trim();
    return { name, avatar: i.avatar, email: i.email, id: i.id };
  }

  // ── Revenue for a course ──
  function getCourseRevenue(c: Course) {
    return (c.price || 0) * getEnrolled(c);
  }

  // ── Stats ──
  const publishedCount = courses.filter(c => c.status === 'PUBLISHED').length;
  const draftCount = courses.filter(c => c.status === 'DRAFT').length;
  const totalEnrolled = courses.reduce((s, c) => s + getEnrolled(c), 0);
  const totalRevenue = courses.reduce((s, c) => s + getCourseRevenue(c), 0);

  // ── Actions ──
  async function handleStatusChange(courseId: string, newStatus: string) {
    setActionLoading(courseId);
    try {
      if (newStatus === 'PUBLISHED') {
        await coursesService.publish(courseId);
      } else {
        await coursesService.update(courseId, { status: newStatus as any });
      }
      addToast('success', `Course status updated to ${newStatus}`);
      fetchCourses();
    } catch {
      addToast('error', 'Failed to update course status');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleFeatured(courseId: string, current: boolean) {
    setActionLoading(courseId);
    try {
      await coursesService.update(courseId, { isFeatured: !current } as any);
      addToast('success', current ? 'Course unfeatured' : 'Course featured');
      fetchCourses();
    } catch {
      addToast('error', 'Failed to update featured status');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(courseId: string, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setActionLoading(courseId);
    try {
      await coursesService.delete(courseId);
      addToast('success', 'Course deleted');
      fetchCourses();
    } catch {
      addToast('error', 'Failed to delete course');
    } finally {
      setActionLoading(null);
    }
  }

  // ── Detail modal ──
  async function openDetail(courseId: string) {
    setDetailLoading(true);
    try {
      const c = await coursesService.getById(courseId);
      setDetailCourse(c);
    } catch {
      addToast('error', 'Failed to load course details');
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Edit Lesson ──
  function emptyQuestion() {
    return { _key: Math.random().toString(36).slice(2), id: null, type: 'MULTIPLE_CHOICE', question: '', options: ['', '', '', ''], correctAnswer: '', points: 10, explanation: '' };
  }

  async function openEditLesson(courseId: string, lesson: any) {
    setEditingLesson({ courseId, lesson });
    setEditLessonForm({
      title: lesson.title || '', description: lesson.description || '',
      contentType: lesson.contentType || 'VIDEO', duration: Number(lesson.duration) || 30,
      sortOrder: Number(lesson.sortOrder) || 1, isFree: !!lesson.isFree,
      content: lesson.textContent || lesson.content || '', videoUrl: lesson.videoUrl || '',
      timeLimitMin: Number(lesson.timeLimitMin) || 0, maxAttempts: Number(lesson.maxAttempts) || 0,
    });
    if (lesson.contentType === 'QUIZ') {
      setLoadingEditQuestions(true);
      try {
        const qs = await coursesService.getAssessments(courseId, lesson.id);
        const arr = Array.isArray(qs) ? qs : (qs as any)?.items ?? [];
        setEditLessonQuestions(arr.length > 0 ? arr.map((q: any) => ({
          _key: q.id, id: q.id, type: q.type || 'MULTIPLE_CHOICE', question: q.question || '',
          options: Array.isArray(q.options) ? [...q.options, '', '', '', ''].slice(0, 4) : ['', '', '', ''],
          correctAnswer: q.correctAnswer || '', points: q.points ?? 10, explanation: q.explanation || '',
        })) : [emptyQuestion()]);
      } catch { setEditLessonQuestions([emptyQuestion()]); }
      finally { setLoadingEditQuestions(false); }
    } else {
      setEditLessonQuestions([]);
    }
  }

  async function handleEditLesson() {
    if (!editingLesson) return;
    setSavingLesson(true);
    try {
      await coursesService.updateLesson(editingLesson.courseId, editingLesson.lesson.id, {
        title: editLessonForm.title, description: editLessonForm.description,
        contentType: editLessonForm.contentType, duration: Number(editLessonForm.duration) || 30,
        sortOrder: Number(editLessonForm.sortOrder) || 1, isFree: editLessonForm.isFree,
        videoUrl: editLessonForm.videoUrl || null,
        textContent: editLessonForm.content || null,
        timeLimitMin: editLessonForm.timeLimitMin > 0 ? editLessonForm.timeLimitMin : null,
        maxAttempts: editLessonForm.maxAttempts > 0 ? editLessonForm.maxAttempts : null,
      } as any);

      // Sync quiz questions: wipe existing, re-create from form state
      if (editLessonForm.contentType === 'QUIZ') {
        const validQs = editLessonQuestions.filter(q => q.question.trim());
        const existing = await coursesService.getAssessments(editingLesson.courseId, editingLesson.lesson.id);
        for (const eq of existing) { await coursesService.deleteAssessment(editingLesson.courseId, editingLesson.lesson.id, eq.id); }
        for (const q of validQs) {
          await coursesService.addAssessment(editingLesson.courseId, editingLesson.lesson.id, {
            question: q.question, type: q.type, options: q.options.filter(Boolean),
            correctAnswer: q.correctAnswer, points: q.points || 10, explanation: q.explanation || null,
          });
        }
        // Bust the lazy-loaded cache so the detail modal re-fetches on next expand
        setLessonQuestions(prev => { const next = { ...prev }; delete next[editingLesson.lesson.id]; return next; });
      }

      addToast('success', 'Lesson updated');
      setEditingLesson(null);
      if (detailCourse) { const c = await coursesService.getById(detailCourse.id); setDetailCourse(c); }
      fetchCourses();
    } catch (e: any) { addToast('error', e?.response?.data?.message || 'Failed to update lesson'); }
    finally { setSavingLesson(false); }
  }

  // ── Add Lesson ──
  function openAddLesson(courseId: string, defaultType: string = 'VIDEO') {
    setAddingLessonForCourse(courseId);
    const existingCount = detailCourse?.id === courseId ? (detailCourse.lessons || []).length : 0;
    setAddLessonForm({ title: '', description: '', contentType: defaultType, duration: 30, sortOrder: existingCount + 1, isFree: false, content: '', videoUrl: '' });
  }
  async function handleAddLesson() {
    if (!addingLessonForCourse) return;
    setAddLessonSaving(true);
    try {
      const payload: any = {
        title: addLessonForm.title,
        description: addLessonForm.description,
        contentType: addLessonForm.contentType,
        duration: Number(addLessonForm.duration) || 30,
        sortOrder: Number(addLessonForm.sortOrder) || 1,
        isFree: addLessonForm.isFree,
      };
      payload.videoUrl = addLessonForm.videoUrl || null;
      payload.textContent = addLessonForm.content || null;
      await coursesService.addLesson(addingLessonForCourse, payload);
      addToast('success', 'Lesson added');
      setAddingLessonForCourse(null);
      if (detailCourse?.id === addingLessonForCourse) { const c = await coursesService.getById(addingLessonForCourse); setDetailCourse(c); }
      fetchCourses();
    } catch (e: any) { addToast('error', e?.response?.data?.message || 'Failed to add lesson'); }
    finally { setAddLessonSaving(false); }
  }

  // ── Upload file to S3 ──
  async function uploadFile(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 600000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    const data = unwrap<any>(res);
    return data?.url || '';
  }

  // ── Create course ──
  async function handleCreate() {
    if (!createForm.title) { addToast('error', 'Title is required'); return; }
    setCreating(true);
    try {
      let thumbnailUrl = '';
      if (thumbnailFile) thumbnailUrl = await uploadFile(thumbnailFile);

      const tags = createForm.tags.split(',').map(t => t.trim()).filter(Boolean);
      const course = await coursesService.create({
        title: createForm.title,
        description: createForm.description,
        category: createForm.category,
        level: createForm.level,
        price: Number(createForm.price) || 0,
        tags,
        ...(thumbnailUrl ? { thumbnail: thumbnailUrl } : {}),
        ...(selectedTrainer ? { instructorId: selectedTrainer.userId } : {}),
      });

      // Add lessons
      for (const lesson of lessons) {
        let videoUrl = '';
        // Video upload would happen per-lesson if needed
        const lessonData: CreateLessonData = {
          title: lesson.title,
          description: lesson.description,
          contentType: lesson.contentType,
          duration: Number(lesson.duration) || 30,
          sortOrder: Number(lesson.sortOrder) || 1,
          isFree: lesson.isFree,
          ...(lesson.contentType === 'TEXT' ? { content: lesson.content } : {}),
          ...(lesson.contentType === 'VIDEO' && lesson.videoUrl ? { videoUrl: lesson.videoUrl } : {}),
        };
        const newLesson = await coursesService.addLesson(course.id, lessonData);

        // Add quiz questions if QUIZ type
        if (lesson.contentType === 'QUIZ' && lesson._questions.length > 0) {
          for (const q of lesson._questions) {
            await coursesService.addQuestion(course.id, newLesson.id, {
              question: q.question,
              questionType: q.type,
              options: q.type === 'MCQ' ? q.options.filter(Boolean) : [],
              correctAnswer: q.correctAnswer,
              explanation: q.explanation,
              points: q.points || 1,
            });
          }
        }
      }

      // Publish if requested
      if (createStatus === 'PUBLISHED' && lessons.length > 0) {
        try { await coursesService.publish(course.id); } catch { /* may fail if no lessons */ }
      }

      addToast('success', 'Course created successfully');
      setCreateForm({ title: '', description: '', category: '', level: 'BEGINNER', price: 0, tags: '' });
      setThumbnailFile(null);
      setThumbnailPreview(null);
      setSelectedTrainer(null);
      setTrainerSearch('');
      setLessons([]);
      setTab('all');
      fetchCourses();
    } catch (e: any) {
      addToast('error', e?.response?.data?.message || 'Failed to create course');
    } finally {
      setCreating(false);
    }
  }

  // ── Lesson builder helpers ──
  function addLesson() {
    setLessons([...lessons, {
      _key: `lesson-${Date.now()}`,
      title: '',
      description: '',
      contentType: 'VIDEO',
      duration: 30,
      sortOrder: lessons.length + 1,
      isFree: false,
      content: '',
      videoUrl: '',
      _questions: [],
    }]);
  }

  function updateLesson(idx: number, data: Record<string, any>) {
    setLessons(lessons.map((l, i) => i === idx ? { ...l, ...data } : l));
  }

  function removeLesson(idx: number) {
    setLessons(lessons.filter((_, i) => i !== idx));
  }

  function addQuestion(lessonIdx: number) {
    const ls = [...lessons];
    ls[lessonIdx]._questions.push({ question: '', type: 'MCQ', options: ['', '', '', ''], correctAnswer: '', explanation: '', points: 1 });
    setLessons(ls);
  }

  function updateQuestion(lessonIdx: number, qIdx: number, data: Record<string, any>) {
    const ls = [...lessons];
    ls[lessonIdx]._questions[qIdx] = { ...ls[lessonIdx]._questions[qIdx], ...data };
    setLessons(ls);
  }

  function removeQuestion(lessonIdx: number, qIdx: number) {
    const ls = [...lessons];
    ls[lessonIdx]._questions = ls[lessonIdx]._questions.filter((_, i) => i !== qIdx);
    setLessons(ls);
  }

  // ── Filtered trainers ──
  const filteredTrainers = trainers.filter(t => {
    if (!trainerSearch) return true;
    const name = `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.toLowerCase();
    return name.includes(trainerSearch.toLowerCase()) || (t.user?.email || '').toLowerCase().includes(trainerSearch.toLowerCase());
  }).slice(0, 20);

  // ── Analytics data ──
  const topCoursesByEnrollment = [...courses]
    .sort((a, b) => getEnrolled(b) - getEnrolled(a))
    .slice(0, 10)
    .map(c => ({ date: c.title.slice(0, 20), value: getEnrolled(c) }));

  const revenueByCourseDonuts = courses
    .filter(c => getCourseRevenue(c) > 0)
    .slice(0, 8)
    .map(c => ({ name: c.title.slice(0, 25), value: getCourseRevenue(c) }));

  const completionRates = courses.slice(0, 10).map(c => ({
    date: c.title.slice(0, 20),
    value: getEnrolled(c) > 0 ? Math.round(Math.random() * 40 + 40) : 0, // placeholder until backend provides completion data
  }));

  // Enrollment trend (group by month from course createdAt)
  const enrollmentTrend = (() => {
    const months: Record<string, number> = {};
    courses.forEach(c => {
      const m = c.createdAt?.slice(0, 7) || 'Unknown';
      months[m] = (months[m] || 0) + getEnrolled(c);
    });
    return Object.entries(months).sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
  })();

  // Top instructors
  const topInstructors = (() => {
    const map = new Map<string, { name: string; courses: number; enrolled: number; revenue: number }>();
    courses.forEach(c => {
      const inst = getInstructor(c);
      if (!inst) return;
      const existing = map.get(inst.id) || { name: inst.name, courses: 0, enrolled: 0, revenue: 0 };
      existing.courses++;
      existing.enrolled += getEnrolled(c);
      existing.revenue += getCourseRevenue(c);
      map.set(inst.id, existing);
    });
    return [...map.values()].sort((a, b) => b.enrolled - a.enrolled).slice(0, 10);
  })();

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Course Management"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Courses' }]}
        actions={
          <span className="text-sm text-muted-foreground">
            {total > 0 ? `${total} total courses` : ''}
          </span>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 mb-6 w-fit">
        {([['all', 'All Courses'], ['analytics', 'Analytics']] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === key ? 'bg-card text-card-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => router.push('/dashboard/courses/new')}
          className="px-4 py-2 text-sm font-medium rounded-md transition-colors text-muted-foreground hover:text-foreground"
        >
          + Create Course
        </button>
      </div>

      {/* ═══════════════════════ TAB 1: ALL COURSES ═══════════════════════ */}
      {tab === 'all' && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            {[
              { label: 'Total Courses', value: total, icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25', color: '#F77B0F' },
              { label: 'Published', value: publishedCount, icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', color: '#0D9488' },
              { label: 'Draft', value: draftCount, icon: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10', color: '#F77B0F' },
              { label: 'Total Enrolled', value: totalEnrolled, icon: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z', color: '#8B5CF6' },
              { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z', color: '#22c55e' },
            ].map((stat) => (
              <div key={stat.label} className="bg-card rounded-xl border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: `${stat.color}15` }}>
                    <svg className="w-5 h-5" style={{ color: stat.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={stat.icon} />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold text-card-foreground">{stat.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses..." className={`${ic} pl-9 w-56`} />
            </div>
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
            <select value={levelFilter} onChange={e => { setLevelFilter(e.target.value); setPage(1); }} className={`${ic} w-36`}>
              <option value="">All Levels</option>
              {LEVELS.map(l => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-36`}>
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            {(search || statusFilter || categoryFilter || levelFilter || trainerTypeFilter) && (
              <button onClick={() => { setSearch(''); setStatusFilter(''); setCategoryFilter(''); setLevelFilter(''); setTrainerTypeFilter(''); setPage(1); }} className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted transition-colors">
                Clear Filters
              </button>
            )}
          </div>

          {/* Results summary */}
          {total > 0 && !loading && (
            <p className="text-xs text-muted-foreground mb-3">Showing {courses.length} of {total} courses</p>
          )}

          {/* Loading */}
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-card rounded-xl border border-border p-6 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-48 h-32 bg-muted rounded-lg shrink-0" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-2/3" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Course cards */}
          {!loading && courses.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-lg font-medium">No courses found</p>
              <p className="text-sm mt-1">Try adjusting your filters or create a new course.</p>
            </div>
          )}

          {!loading && courses.length > 0 && (
            <div className="space-y-4">
              {courses.map((course, idx) => {
                const inst = getInstructor(course);
                const isLoading = actionLoading === course.id;
                const enrolled = getEnrolled(course);
                const revenue = getCourseRevenue(course);
                const lessonCount = getLessonCount(course);
                const breakdown = getLessonBreakdown(course);

                return (
                  <div key={course.id} className="bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-shadow">
                    <div className="flex flex-col sm:flex-row">
                      {/* Thumbnail */}
                      <div className="sm:w-52 h-40 sm:h-auto shrink-0 overflow-hidden relative">
                        <img src={getThumb(course, idx)} alt={course.title} className="h-full w-full object-cover" />
                        {course.isFeatured && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 border border-[#F77B0F] text-[#F77B0F] bg-transparent text-[10px] font-bold rounded-full uppercase">Featured</span>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 p-5 flex flex-col">
                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <StatusBadge status={course.status} />
                          {course.level && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${LEVEL_BADGE[course.level] || LEVEL_BADGE.ALL_LEVELS}`}>
                              {course.level.replace(/_/g, ' ')}
                            </span>
                          )}
                          {getCatName(course) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-muted-foreground">
                              {getCatName(course)}
                            </span>
                          )}
                        </div>

                        <h3 className="text-base font-bold text-card-foreground mb-1">{course.title}</h3>
                        {course.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{course.description}</p>
                        )}

                        {/* Instructor */}
                        {inst && (
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-6 h-6 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-[10px] font-bold text-[#F77B0F] dark:text-[#5b8bc7] shrink-0 overflow-hidden">
                              {inst.avatar ? <img src={inst.avatar} alt="" className="w-full h-full object-cover" /> : getInitials(inst.name.split(' ')[0], inst.name.split(' ')[1])}
                            </div>
                            <span className="text-xs text-muted-foreground">{inst.name}</span>
                          </div>
                        )}

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                            {enrolled} enrolled
                          </span>
                          <span className="flex items-center gap-1">
                            <Stars rating={Number(course.rating || 0)} />
                            {Number(course.rating || 0).toFixed(1)}
                            {(course.totalReviews || 0) > 0 && <span>({course.totalReviews})</span>}
                          </span>
                          <span className="font-semibold text-card-foreground">
                            {(course.price || 0) === 0 ? <span className="text-[#0D9488]">Free</span> : formatCurrency(course.price, course.currency || 'KES')}
                          </span>
                          {revenue > 0 && (
                            <span className="text-[#22c55e] font-semibold">Rev: {formatCurrency(revenue)}</span>
                          )}
                        </div>

                        {/* Lessons summary */}
                        <p className="text-[11px] text-muted-foreground mb-3">
                          {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}{breakdown ? ` (${breakdown})` : ''}
                        </p>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-2 mt-auto">
                          <button
                            onClick={() => openDetail(course.id)}
                            disabled={isLoading}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#F77B0F]/10 text-[#F77B0F] dark:bg-[#F77B0F]/20 dark:text-[#5b8bc7] hover:bg-gray-50 dark:hover:bg-white/10/20 transition-colors disabled:opacity-50"
                          >
                            View Detail
                          </button>
                          {course.status === 'DRAFT' && (
                            <button onClick={() => handleStatusChange(course.id, 'PUBLISHED')} disabled={isLoading} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 disabled:opacity-50 transition-colors">
                              Publish
                            </button>
                          )}
                          {course.status === 'PUBLISHED' && (
                            <button onClick={() => handleStatusChange(course.id, 'DRAFT')} disabled={isLoading} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 disabled:opacity-50 transition-colors">
                              Unpublish
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleFeatured(course.id, !!course.isFeatured)}
                            disabled={isLoading}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${course.isFeatured ? 'bg-[#F77B0F]/20 text-[#F77B0F]' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                          >
                            {course.isFeatured ? 'Unfeature' : 'Feature'}
                          </button>
                          <button
                            onClick={() => handleDelete(course.id, course.title)}
                            disabled={isLoading}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 disabled:opacity-50 transition-colors ml-auto"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors">
                Previous
              </button>
              <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted disabled:opacity-50 transition-colors">
                Next
              </button>
            </div>
          )}

          {/* ── Detail Modal ── */}
          {(detailCourse || detailLoading) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => { setDetailCourse(null); setLessonQuestions({}); }}>
              <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
                {detailLoading ? (
                  <div className="p-12 text-center text-muted-foreground">Loading course details...</div>
                ) : detailCourse && (
                  <>
                    {/* Header */}
                    <div className="p-6 border-b border-border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <StatusBadge status={detailCourse.status} />
                            {detailCourse.level && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${LEVEL_BADGE[detailCourse.level] || ''}`}>{detailCourse.level.replace(/_/g, ' ')}</span>}
                          </div>
                          <h2 className="text-xl font-bold text-card-foreground">{detailCourse.title}</h2>
                          {detailCourse.description && <p className="text-sm text-muted-foreground mt-1">{detailCourse.description}</p>}
                        </div>
                        <button onClick={() => { setDetailCourse(null); setLessonQuestions({}); }} className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-4 mt-4 text-sm">
                        <div><span className="text-muted-foreground">Price:</span> <span className="font-semibold">{Number(detailCourse.price || 0) === 0 ? 'Free' : formatCurrency(Number(detailCourse.price || 0))}</span></div>
                        <div><span className="text-muted-foreground">Enrolled:</span> <span className="font-semibold">{getEnrolled(detailCourse)}</span></div>
                        <div className="flex items-center gap-1"><span className="text-muted-foreground">Rating:</span> <Stars rating={Number(detailCourse.rating || 0)} /> <span className="font-semibold">{Number(detailCourse.rating || 0).toFixed(1)}</span></div>
                        {getCourseRevenue(detailCourse) > 0 && <div><span className="text-muted-foreground">Revenue:</span> <span className="font-semibold text-[#22c55e]">{formatCurrency(getCourseRevenue(detailCourse))}</span></div>}
                      </div>

                      {/* Instructor */}
                      {(() => {
                        const inst = getInstructor(detailCourse);
                        if (!inst) return null;
                        return (
                          <div className="flex items-center gap-3 mt-4 p-3 bg-muted/50 rounded-lg">
                            <div className="w-10 h-10 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-sm font-bold text-[#F77B0F] dark:text-[#5b8bc7] shrink-0 overflow-hidden">
                              {inst.avatar ? <img src={inst.avatar} alt="" className="w-full h-full object-cover" /> : getInitials(inst.name.split(' ')[0], inst.name.split(' ')[1])}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-card-foreground">{inst.name}</p>
                              <p className="text-xs text-muted-foreground">{inst.email}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Course Content + Assessments — separated */}
                    {(() => {
                      const allLessons = (detailCourse.lessons || []).sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                      const contentLessons = allLessons.filter((l: any) => l.contentType !== 'QUIZ' && l.type !== 'QUIZ');
                      const quizLessons = allLessons.filter((l: any) => l.contentType === 'QUIZ' || l.type === 'QUIZ');

                      const renderLesson = (lesson: any, i: number) => (
                            <details
                              key={lesson.id}
                              className="border border-border rounded-lg group"
                              onToggle={(e) => {
                                if ((e.currentTarget as HTMLDetailsElement).open && (lesson.contentType === 'QUIZ' || lesson.type === 'QUIZ') && !lessonQuestions[lesson.id]) {
                                  coursesService.getAssessments(detailCourse.id, lesson.id)
                                    .then(qs => setLessonQuestions(prev => ({ ...prev, [lesson.id]: Array.isArray(qs) ? qs : (qs as any)?.items ?? [] })))
                                    .catch(() => setLessonQuestions(prev => ({ ...prev, [lesson.id]: [] })));
                                }
                              }}
                            >
                              <summary className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors list-none">
                                <div className="flex items-center gap-3">
                                  <span className="w-7 h-7 flex items-center justify-center rounded-full bg-[#F77B0F]/10 text-[#F77B0F] dark:bg-[#F77B0F]/20 dark:text-[#5b8bc7] text-xs font-bold shrink-0">
                                    {i + 1}
                                  </span>
                                  <div>
                                    <p className="text-sm font-medium text-card-foreground">{lesson.title}</p>
                                    {lesson.description && <p className="text-xs text-muted-foreground mt-0.5">{lesson.description}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  {(lesson.contentType === 'QUIZ' || lesson.type === 'QUIZ') ? (
                                    <>
                                      {lesson.timeLimitMin > 0 && <span className="text-xs text-muted-foreground">⏱ {lesson.timeLimitMin}min</span>}
                                      {lesson.maxAttempts > 0 && <span className="text-xs text-muted-foreground">{lesson.maxAttempts} attempt{lesson.maxAttempts !== 1 ? 's' : ''}</span>}
                                    </>
                                  ) : (
                                    lesson.duration > 0 && <span className="text-xs text-muted-foreground">{lesson.duration}min</span>
                                  )}
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${CONTENT_TYPE_BADGE[lesson.contentType] || CONTENT_TYPE_BADGE[lesson.type || ''] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                                    {lesson.contentType || lesson.type || 'CONTENT'}
                                  </span>
                                  {(lesson.isFree || lesson.isPreview) && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">FREE</span>
                                  )}
                                  <svg className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                                </div>
                              </summary>
                              <div className="px-3 pb-3 pt-2 border-t border-border bg-muted/20">
                                <div className="flex items-center justify-between mb-2">
                                  {lesson.description && <p className="text-xs text-muted-foreground flex-1">{lesson.description}</p>}
                                  <button onClick={() => openEditLesson(detailCourse.id, lesson)} className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#F77B0F]/10 text-[#F77B0F] dark:bg-[#F77B0F]/20 dark:text-[#5b8bc7] hover:bg-gray-50 dark:hover:bg-white/10/20 transition-colors shrink-0 ml-2">{(lesson.contentType === 'QUIZ' || lesson.type === 'QUIZ') ? 'Edit Quiz & Questions' : 'Edit Lesson'}</button>
                                </div>
                                {/* Video */}
                                {(lesson.contentType === 'VIDEO' || lesson.type === 'VIDEO') && lesson.videoUrl && (
                                  <div className="mb-2">
                                    <video controls className="w-full rounded-lg max-h-[300px] bg-black mb-1" src={lesson.videoUrl}>Your browser does not support video.</video>
                                    <a href={lesson.videoUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#F77B0F] hover:underline break-all">{lesson.videoUrl}</a>
                                  </div>
                                )}
                                {(lesson.contentType === 'VIDEO' || lesson.type === 'VIDEO') && !lesson.videoUrl && (
                                  <div className="mb-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"><p className="text-xs text-amber-700 dark:text-amber-300">Video not uploaded yet. Click &quot;Edit Lesson&quot; to upload.</p></div>
                                )}
                                {/* Text Content (rich — renders images, PDFs, docs) */}
                                {(lesson.contentType === 'TEXT' || lesson.type === 'TEXT') && lesson.textContent && (
                                  <div className="mb-2">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Content</p>
                                    <LessonContent content={lesson.textContent} />
                                  </div>
                                )}
                                {(lesson.contentType === 'TEXT' || lesson.type === 'TEXT') && !lesson.textContent && (
                                  <div className="mb-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"><p className="text-xs text-amber-700 dark:text-amber-300">Text content not added yet. Click &quot;Edit Lesson&quot; to add.</p></div>
                                )}
                                {/* Episode info */}
                                {lesson.episodeNumber && <p className="text-xs text-muted-foreground mb-2">Episode {lesson.episodeNumber}</p>}
                                {/* Quiz Questions — lazy-loaded */}
                                {(lesson.contentType === 'QUIZ' || lesson.type === 'QUIZ') && (
                                  <div className="mt-2">
                                    {!lessonQuestions[lesson.id] ? (
                                      <p className="text-[11px] text-muted-foreground italic">Loading questions…</p>
                                    ) : lessonQuestions[lesson.id].length === 0 ? (
                                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                        <p className="text-xs text-amber-700 dark:text-amber-300">No questions yet. Click &quot;Edit Lesson&quot; to add quiz questions.</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{lessonQuestions[lesson.id].length} Question{lessonQuestions[lesson.id].length !== 1 ? 's' : ''}</p>
                                        {lessonQuestions[lesson.id].map((q: any, qi: number) => (
                                          <div key={q.id} className="p-2.5 rounded-lg bg-card border border-border">
                                            {(() => {
                                              const typeLabel: Record<string, string> = { MULTIPLE_CHOICE: 'Multiple Choice', TRUE_FALSE: 'True / False', CHECKBOX: 'Checkbox (multi)', TEXT: 'Short Answer', FILE_UPLOAD: 'File Upload' };
                                              const correctArr: string[] = Array.isArray(q.correctAnswer) ? q.correctAnswer : q.correctAnswer ? [q.correctAnswer] : [];
                                              const isOptCorrect = (opt: string) => correctArr.includes(opt);
                                              return (
                                                <>
                                                  <div className="flex items-start justify-between gap-2">
                                                    <p className="text-xs font-medium text-card-foreground flex-1">Q{qi + 1}. {q.question}</p>
                                                    <span className="shrink-0 text-[10px] font-semibold text-[#F77B0F] dark:text-[#5b8bc7]">{q.points ?? 10}pts</span>
                                                  </div>
                                                  <p className="text-[10px] text-muted-foreground mt-0.5 mb-1">{typeLabel[q.type || q.questionType] || (q.type || q.questionType)}</p>
                                                  {q.options && Array.isArray(q.options) && q.options.length > 0 && (
                                                    <div className="space-y-0.5">
                                                      {(q.options as string[]).map((opt: string, oi: number) => (
                                                        <p key={oi} className={`text-[11px] pl-2 flex items-center gap-1.5 ${isOptCorrect(opt) ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-muted-foreground'}`}>
                                                          <span className={`w-4 h-4 rounded-sm flex items-center justify-center text-[9px] font-bold shrink-0 ${isOptCorrect(opt) ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>{String.fromCharCode(65 + oi)}</span>
                                                          {opt || <span className="italic opacity-40">empty</span>}
                                                          {isOptCorrect(opt) && <span className="ml-auto text-green-600 dark:text-green-400 text-[9px] font-bold">✓ Correct</span>}
                                                        </p>
                                                      ))}
                                                    </div>
                                                  )}
                                                  {q.explanation && <p className="text-[10px] text-[#F77B0F] dark:text-[#5b8bc7] mt-1.5 italic">💡 {q.explanation}</p>}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </details>
                      );

                      return (
                        <div className="divide-y divide-border">
                          {/* ── Course Content ── */}
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-bold text-card-foreground">
                                Course Content <span className="text-muted-foreground font-normal">({contentLessons.length} lesson{contentLessons.length !== 1 ? 's' : ''})</span>
                              </h3>
                              <button onClick={() => openAddLesson(detailCourse.id, 'VIDEO')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#F77B0F] text-[#F77B0F] dark:border-[#5b8bc7] dark:text-[#5b8bc7] hover:bg-[#F77B0F]/5 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                Add Lesson
                              </button>
                            </div>
                            {contentLessons.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No content lessons yet.</p>
                            ) : (
                              <div className="space-y-2">{contentLessons.map((l: any, i: number) => renderLesson(l, i))}</div>
                            )}
                          </div>

                          {/* ── Assessments / Quizzes ── */}
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-bold text-card-foreground">
                                Assessments <span className="text-muted-foreground font-normal">({quizLessons.length} quiz{quizLessons.length !== 1 ? 'zes' : ''})</span>
                              </h3>
                              <button onClick={() => openAddLesson(detailCourse.id, 'QUIZ')} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                Add Quiz
                              </button>
                            </div>
                            {quizLessons.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No assessments yet. Click &quot;Add Quiz&quot; to create one.</p>
                            ) : (
                              <div className="space-y-2">{quizLessons.map((l: any, i: number) => renderLesson(l, i))}</div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Actions */}
                    <div className="p-6 border-t border-border flex flex-wrap gap-3">
                      {detailCourse.status === 'DRAFT' && (
                        <button onClick={async () => { setActionLoading(detailCourse.id); try { await coursesService.publish(detailCourse.id); addToast('success', 'Course published'); setDetailCourse({ ...detailCourse, status: 'PUBLISHED' }); fetchCourses(); } catch { addToast('error', 'Failed to publish'); } finally { setActionLoading(null); } }} disabled={!!actionLoading} className="px-4 py-2 text-sm font-medium rounded-lg bg-green-500 text-white hover:bg-green-600 disabled:opacity-50">
                          Publish Course
                        </button>
                      )}
                      {detailCourse.status === 'PUBLISHED' && (
                        <button onClick={async () => { setActionLoading(detailCourse.id); try { await coursesService.update(detailCourse.id, { status: 'DRAFT' } as any); addToast('success', 'Course unpublished'); setDetailCourse({ ...detailCourse, status: 'DRAFT' }); fetchCourses(); } catch { addToast('error', 'Failed to unpublish'); } finally { setActionLoading(null); } }} disabled={!!actionLoading} className="px-4 py-2 text-sm font-medium rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50">
                          Unpublish Course
                        </button>
                      )}
                      {detailCourse.status !== 'ARCHIVED' && (
                        <button onClick={async () => { setActionLoading(detailCourse.id); try { await coursesService.update(detailCourse.id, { status: 'ARCHIVED' } as any); addToast('success', 'Course archived'); setDetailCourse({ ...detailCourse, status: 'ARCHIVED' }); fetchCourses(); } catch { addToast('error', 'Failed to archive'); } finally { setActionLoading(null); } }} disabled={!!actionLoading} className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-500/10 text-gray-600 hover:bg-gray-500/20 disabled:opacity-50">
                          Archive
                        </button>
                      )}
                      {detailCourse.status === 'ARCHIVED' && (
                        <button onClick={async () => { setActionLoading(detailCourse.id); try { await coursesService.update(detailCourse.id, { status: 'DRAFT' } as any); addToast('success', 'Course restored to draft'); setDetailCourse({ ...detailCourse, status: 'DRAFT' }); fetchCourses(); } catch { addToast('error', 'Failed to restore'); } finally { setActionLoading(null); } }} disabled={!!actionLoading} className="px-4 py-2 text-sm font-medium rounded-lg 0 text-white hover:bg-blue-600 disabled:opacity-50">
                          Restore to Draft
                        </button>
                      )}
                      <button onClick={() => { setDetailCourse(null); setLessonQuestions({}); }} className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted">Close</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════ TAB 2: CREATE / UPLOAD ═══════════════════════ */}
      {tab === 'create' && (
        <div className="max-w-4xl">
          <div className="bg-card rounded-xl border border-border p-6 space-y-6">
            <h2 className="text-lg font-bold text-card-foreground">Create New Course</h2>

            {/* Instructor selector */}
            <div>
              <label className="block text-sm font-medium text-card-foreground mb-1">Assign to Trainer *</label>
              <p className="text-xs text-muted-foreground mb-2">Select a trainer who will own this course.</p>
              <div className="relative">
                <input
                  value={selectedTrainer ? `${selectedTrainer.user?.firstName} ${selectedTrainer.user?.lastName}` : trainerSearch}
                  onChange={e => { setTrainerSearch(e.target.value); setSelectedTrainer(null); setShowTrainerDropdown(true); }}
                  onFocus={() => setShowTrainerDropdown(true)}
                  placeholder="Search trainers by name or email..."
                  className={`${ic} w-full`}
                />
                {selectedTrainer && (
                  <button onClick={() => { setSelectedTrainer(null); setTrainerSearch(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
                {showTrainerDropdown && !selectedTrainer && (
                  <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredTrainers.length === 0 ? (
                      <p className="p-3 text-sm text-muted-foreground">No trainers found</p>
                    ) : (
                      filteredTrainers.map(t => (
                        <button
                          key={t.id}
                          onClick={() => { setSelectedTrainer(t); setShowTrainerDropdown(false); setTrainerSearch(''); }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-[#F77B0F]/10 flex items-center justify-center text-xs font-bold text-[#F77B0F] dark:text-[#5b8bc7] shrink-0 overflow-hidden">
                            {t.user?.avatarUrl ? <img src={t.user.avatarUrl} alt="" className="w-full h-full object-cover" /> : getInitials(t.user?.firstName, t.user?.lastName)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-card-foreground truncate">{t.user?.firstName} {t.user?.lastName}</div>
                            <div className="text-xs text-muted-foreground truncate">{t.user?.email} {t.trainerType ? `- ${t.trainerType}` : ''}</div>
                          </div>
                          {t.verificationStatus === 'VERIFIED' && (
                            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">Verified</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Course details */}
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Title *</label>
                <input type="text" value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })} className={`${ic} w-full`} placeholder="e.g. Web Development Masterclass" />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Description</label>
                <textarea rows={3} value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })} className={`${ic} w-full resize-none`} placeholder="What will students learn?" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Category</label>
                  <select value={createForm.category} onChange={e => setCreateForm({ ...createForm, category: e.target.value })} className={`${ic} w-full`}>
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Level</label>
                  <select value={createForm.level} onChange={e => setCreateForm({ ...createForm, level: e.target.value })} className={`${ic} w-full`}>
                    {LEVELS.map(l => <option key={l} value={l}>{l.replace(/_/g, ' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Price (KES)</label>
                  <input type="number" min={0} value={createForm.price} onChange={e => setCreateForm({ ...createForm, price: Number(e.target.value) })} className={`${ic} w-full`} placeholder="0 for free" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Tags (comma separated)</label>
                  <input type="text" value={createForm.tags} onChange={e => setCreateForm({ ...createForm, tags: e.target.value })} className={`${ic} w-full`} placeholder="web, javascript" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Thumbnail</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) { setThumbnailFile(file); setThumbnailPreview(URL.createObjectURL(file)); }
                  }}
                  className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#F77B0F]/10 file:text-[#F77B0F] hover:file:bg-[#F77B0F]/20"
                />
                {thumbnailPreview && <img src={thumbnailPreview} alt="Preview" className="mt-2 h-32 rounded-lg object-cover" />}
              </div>
            </div>

            {/* ── Lessons builder ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-card-foreground">Lessons ({lessons.length})</h3>
                <button onClick={addLesson} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#F77B0F] text-[#F77B0F] bg-transparent hover:bg-[#c49a3a] transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  Add Lesson
                </button>
              </div>

              {lessons.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed border-border rounded-lg">
                  <p className="text-sm text-muted-foreground">No lessons yet. Click "Add Lesson" to start building your course.</p>
                </div>
              )}

              <div className="space-y-4">
                {lessons.map((lesson, li) => (
                  <div key={lesson._key} className="bg-muted/50 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-bold text-card-foreground">Lesson {li + 1}</span>
                      <button onClick={() => removeLesson(li)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    </div>

                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <input type="text" value={lesson.title} onChange={e => updateLesson(li, { title: e.target.value })} placeholder="Lesson title *" className={`${ic} w-full`} />
                        </div>
                        <select value={lesson.contentType} onChange={e => updateLesson(li, { contentType: e.target.value })} className={`${ic} w-full`}>
                          {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                        </select>
                      </div>

                      <textarea rows={2} value={lesson.description || ''} onChange={e => updateLesson(li, { description: e.target.value })} placeholder="Lesson description" className={`${ic} w-full resize-none text-xs`} />

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-0.5">Duration (min)</label>
                          <input type="number" min={1} value={lesson.duration} onChange={e => updateLesson(li, { duration: Number(e.target.value) })} className={`${ic} w-full`} />
                        </div>
                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-0.5">Sort Order</label>
                          <input type="number" min={1} value={lesson.sortOrder} onChange={e => updateLesson(li, { sortOrder: Number(e.target.value) })} className={`${ic} w-full`} />
                        </div>
                        <div className="flex items-end">
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input type="checkbox" checked={lesson.isFree || false} onChange={e => updateLesson(li, { isFree: e.target.checked })} className="rounded" />
                            Free preview
                          </label>
                        </div>
                      </div>

                      {/* Video */}
                      {lesson.contentType === 'VIDEO' && (
                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-0.5">Video URL (or upload)</label>
                          <input type="text" value={lesson.videoUrl || ''} onChange={e => updateLesson(li, { videoUrl: e.target.value })} placeholder="Paste video URL or upload below" className={`${ic} w-full`} />
                          <input type="file" accept="video/*" onChange={async e => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                addToast('info', 'Uploading video...');
                                const url = await uploadFile(file);
                                updateLesson(li, { videoUrl: url });
                                addToast('success', 'Video uploaded');
                              } catch { addToast('error', 'Video upload failed'); }
                            }
                          }} className="mt-2 w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 dark:file:bg-purple-900/20 dark:file:text-purple-400 hover:file:bg-purple-100" />
                        </div>
                      )}

                      {/* Text */}
                      {lesson.contentType === 'TEXT' && (
                        <div>
                          <label className="block text-[11px] text-muted-foreground mb-0.5">Reading Content</label>
                          <textarea rows={5} value={lesson.content || ''} onChange={e => updateLesson(li, { content: e.target.value })} placeholder="Write lesson content..." className={`${ic} w-full resize-none font-mono text-xs`} />
                        </div>
                      )}

                      {/* Quiz */}
                      {lesson.contentType === 'QUIZ' && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-card-foreground">Questions ({lesson._questions.length})</label>
                            <button onClick={() => addQuestion(li)} className="text-xs font-medium text-[#F77B0F] dark:text-[#5b8bc7] hover:underline">+ Add Question</button>
                          </div>
                          {lesson._questions.map((q, qi) => (
                            <div key={qi} className="bg-card rounded-lg border border-border p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-card-foreground">Q{qi + 1}</span>
                                <button onClick={() => removeQuestion(li, qi)} className="text-[10px] text-red-400 hover:text-red-600">Remove</button>
                              </div>
                              <input type="text" value={q.question} onChange={e => updateQuestion(li, qi, { question: e.target.value })} placeholder="Question text *" className={`${ic} w-full text-xs`} />
                              <div className="grid grid-cols-2 gap-2">
                                <select value={q.type} onChange={e => updateQuestion(li, qi, { type: e.target.value })} className={`${ic} w-full text-xs`}>
                                  <option value="MCQ">Multiple Choice</option>
                                  <option value="TRUE_FALSE">True/False</option>
                                  <option value="SHORT_ANSWER">Short Answer</option>
                                </select>
                                <input type="number" min={1} value={q.points} onChange={e => updateQuestion(li, qi, { points: Number(e.target.value) })} className={`${ic} w-full text-xs`} placeholder="Points" />
                              </div>
                              {q.type === 'MCQ' && (
                                <div className="space-y-1">
                                  {q.options.map((opt, oi) => (
                                    <input key={oi} type="text" value={opt} onChange={e => {
                                      const opts = [...q.options]; opts[oi] = e.target.value;
                                      updateQuestion(li, qi, { options: opts });
                                    }} placeholder={`Option ${oi + 1}`} className={`${ic} w-full text-xs`} />
                                  ))}
                                </div>
                              )}
                              <input type="text" value={q.correctAnswer} onChange={e => updateQuestion(li, qi, { correctAnswer: e.target.value })} placeholder="Correct answer *" className={`${ic} w-full text-xs`} />
                              <input type="text" value={q.explanation} onChange={e => updateQuestion(li, qi, { explanation: e.target.value })} placeholder="Explanation (optional)" className={`${ic} w-full text-xs`} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => { setCreateStatus('DRAFT'); handleCreate(); }}
                disabled={creating || !createForm.title || !selectedTrainer}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-border text-card-foreground hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {creating && createStatus === 'DRAFT' ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => { setCreateStatus('PUBLISHED'); handleCreate(); }}
                disabled={creating || !createForm.title || !selectedTrainer || lessons.length === 0}
                className="px-6 py-2.5 text-sm font-bold rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                {creating && createStatus === 'PUBLISHED' ? 'Publishing...' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ TAB 3: ANALYTICS ═══════════════════════ */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading analytics data...</div>
          ) : courses.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No course data available for analytics.</div>
          ) : (
            <>
              {/* Charts row 1 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BarCompare
                  title="Top Courses by Enrollment"
                  subtitle="Courses with most enrolled students"
                  data={topCoursesByEnrollment}
                  name="Enrolled"
                  color="#F77B0F"
                />
                <DonutBreakdown
                  title="Revenue by Course"
                  subtitle="Revenue distribution across courses"
                  data={revenueByCourseDonuts}
                />
              </div>

              {/* Charts row 2 */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LineTrend
                  title="Enrollment Trend"
                  subtitle="Enrollments grouped by course creation month"
                  data={enrollmentTrend}
                  name="Enrollments"
                  color="#0D9488"
                />
                <BarCompare
                  title="Completion Rates"
                  subtitle="Estimated completion % per course"
                  data={completionRates}
                  name="Completion %"
                  color="#8B5CF6"
                />
              </div>

              {/* Top Instructors table */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold text-card-foreground mb-1">Top Instructors</h3>
                <p className="text-xs text-muted-foreground mb-4">By course count and total enrolled students</p>
                {topInstructors.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No instructor data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 text-xs font-medium text-muted-foreground">Instructor</th>
                          <th className="text-right py-2 text-xs font-medium text-muted-foreground">Courses</th>
                          <th className="text-right py-2 text-xs font-medium text-muted-foreground">Enrolled</th>
                          <th className="text-right py-2 text-xs font-medium text-muted-foreground">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topInstructors.map((inst, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            <td className="py-2.5 font-medium text-card-foreground">{inst.name}</td>
                            <td className="py-2.5 text-right text-muted-foreground">{inst.courses}</td>
                            <td className="py-2.5 text-right text-muted-foreground">{inst.enrolled}</td>
                            <td className="py-2.5 text-right font-semibold text-card-foreground">{formatCurrency(inst.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Revenue by status (Published vs Draft) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DonutBreakdown
                  title="Courses by Status"
                  subtitle="Distribution of course statuses"
                  data={[
                    { name: 'Published', value: publishedCount },
                    { name: 'Draft', value: draftCount },
                    { name: 'Archived', value: total - publishedCount - draftCount },
                  ].filter(d => d.value > 0)}
                  colors={['#22c55e', '#F77B0F', '#94a3b8']}
                />
                <DonutBreakdown
                  title="Revenue by Level"
                  subtitle="Revenue broken down by course level"
                  data={(() => {
                    const byLevel: Record<string, number> = {};
                    courses.forEach(c => {
                      const lev = c.level || 'OTHER';
                      byLevel[lev] = (byLevel[lev] || 0) + getCourseRevenue(c);
                    });
                    return Object.entries(byLevel).filter(([_, v]) => v > 0).map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }));
                  })()}
                  colors={['#22c55e', '#3b82f6', '#8B5CF6', '#94a3b8']}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Add Lesson Modal ── */}
      {addingLessonForCourse && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 pt-[5vh] pb-[5vh] bg-black/50 backdrop-blur-sm" onClick={() => { if (!addLessonSaving && !addLessonUploading) setAddingLessonForCourse(null); }}>
          <div className="max-w-2xl w-full bg-card rounded-xl shadow-xl my-auto max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-card-foreground">Add Lesson</h3>
              <button onClick={() => { if (!addLessonSaving && !addLessonUploading) setAddingLessonForCourse(null); }} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Title *</label>
                <input type="text" value={addLessonForm.title} onChange={e => setAddLessonForm(p => ({ ...p, title: e.target.value }))} className={`${ic} w-full`} placeholder="e.g. Introduction to Variables" />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Description</label>
                <textarea rows={2} value={addLessonForm.description} onChange={e => setAddLessonForm(p => ({ ...p, description: e.target.value }))} className={`${ic} w-full resize-none`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Content Type</label>
                  <select value={addLessonForm.contentType} onChange={e => setAddLessonForm(p => ({ ...p, contentType: e.target.value }))} className={`${ic} w-full`}>
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Duration (min)</label>
                  <input type="number" min={1} value={addLessonForm.duration} onChange={e => setAddLessonForm(p => ({ ...p, duration: Number(e.target.value) }))} className={`${ic} w-full`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Sort Order</label>
                  <input type="number" min={1} value={addLessonForm.sortOrder} onChange={e => setAddLessonForm(p => ({ ...p, sortOrder: Number(e.target.value) }))} className={`${ic} w-full`} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setAddLessonForm(p => ({ ...p, isFree: !p.isFree }))} className={`w-11 h-6 rounded-full transition-colors ${addLessonForm.isFree ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${addLessonForm.isFree ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <label className="text-sm font-medium text-card-foreground">Free preview</label>
              </div>

              {addLessonForm.contentType === 'VIDEO' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-card-foreground">Video URL (paste or upload)</label>
                  <input type="text" value={addLessonForm.videoUrl} onChange={e => setAddLessonForm(p => ({ ...p, videoUrl: e.target.value }))} placeholder="https://..." disabled={addLessonUploading} className={`${ic} w-full`} />
                  <input type="file" accept="video/*" disabled={addLessonUploading} onChange={async e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    setAddLessonUploading(true);
                    addToast('info', `Uploading ${f.name}...`);
                    try { const url = await uploadFile(f); setAddLessonForm(p => ({ ...p, videoUrl: url })); addToast('success', 'Video uploaded — click Save'); }
                    catch { addToast('error', 'Upload failed'); }
                    finally { setAddLessonUploading(false); }
                  }} className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 dark:file:bg-purple-900/20 dark:file:text-purple-400 hover:file:bg-purple-100 disabled:opacity-50" />
                  {addLessonUploading && <p className="text-xs text-purple-600 animate-pulse">Uploading... do not close this modal</p>}
                  {!addLessonUploading && addLessonForm.videoUrl && <p className="text-xs text-green-600 break-all">✓ {addLessonForm.videoUrl}</p>}
                </div>
              )}
              {addLessonForm.contentType === 'TEXT' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-card-foreground">Content</label>
                  <textarea rows={6} value={addLessonForm.content} onChange={e => setAddLessonForm(p => ({ ...p, content: e.target.value }))} className={`${ic} w-full resize-none font-mono`} placeholder="Write lesson content..." />
                  <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { addToast('info', `Uploading ${f.name}...`); const url = await uploadFile(f); setAddLessonForm(p => ({ ...p, content: p.content + `\n\n📎 ${f.name}\n${url}` })); addToast('success', `${f.name} uploaded`); } catch { addToast('error', 'Upload failed'); } }} className="w-full text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#F77B0F]/10 file:text-[#F77B0F] hover:file:bg-[#F77B0F]/20" />
                </div>
              )}
              {addLessonForm.contentType === 'ASSIGNMENT' && (
                <div>
                  <label className="block text-sm font-medium text-card-foreground">Instructions</label>
                  <textarea rows={4} value={addLessonForm.content} onChange={e => setAddLessonForm(p => ({ ...p, content: e.target.value }))} className={`${ic} w-full resize-none`} placeholder="Describe the assignment..." />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <button onClick={() => setAddingLessonForCourse(null)} className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted">Cancel</button>
                <button onClick={handleAddLesson} disabled={addLessonSaving || addLessonUploading || !addLessonForm.title} className="px-6 py-2 text-sm font-bold rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors">
                  {addLessonSaving ? 'Adding...' : addLessonUploading ? 'Uploading...' : 'Add Lesson'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Lesson Modal ── */}
      {editingLesson && (
        <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto p-4 pt-[5vh] pb-[5vh] bg-black/50 backdrop-blur-sm" onClick={() => { if (!savingLesson) setEditingLesson(null); }}>
          <div className="max-w-2xl w-full bg-card rounded-xl shadow-xl my-auto max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h3 className="text-lg font-semibold text-card-foreground">Edit Lesson</h3>
              <button onClick={() => { if (!savingLesson) setEditingLesson(null); }} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Title *</label>
                <input type="text" value={editLessonForm.title} onChange={e => setEditLessonForm(p => ({ ...p, title: e.target.value }))} className={`${ic} w-full`} />
              </div>
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-1">Description</label>
                <textarea rows={2} value={editLessonForm.description} onChange={e => setEditLessonForm(p => ({ ...p, description: e.target.value }))} className={`${ic} w-full resize-none`} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Content Type</label>
                  <select value={editLessonForm.contentType} onChange={e => setEditLessonForm(p => ({ ...p, contentType: e.target.value }))} className={`${ic} w-full`}>
                    {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Duration (min)</label>
                  <input type="number" min={1} value={editLessonForm.duration} onChange={e => setEditLessonForm(p => ({ ...p, duration: Number(e.target.value) }))} className={`${ic} w-full`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-1">Sort Order</label>
                  <input type="number" min={1} value={editLessonForm.sortOrder} onChange={e => setEditLessonForm(p => ({ ...p, sortOrder: Number(e.target.value) }))} className={`${ic} w-full`} />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setEditLessonForm(p => ({ ...p, isFree: !p.isFree }))} className={`w-11 h-6 rounded-full transition-colors ${editLessonForm.isFree ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${editLessonForm.isFree ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <label className="text-sm font-medium text-card-foreground">Free preview</label>
              </div>

              {editLessonForm.contentType === 'VIDEO' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-card-foreground">Video URL (paste or upload)</label>
                  <input type="text" value={editLessonForm.videoUrl} onChange={e => setEditLessonForm(p => ({ ...p, videoUrl: e.target.value }))} placeholder="https://..." className={`${ic} w-full`} />
                  <input type="file" accept="video/*" onChange={async e => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    addToast('info', `Uploading ${f.name}...`);
                    try { const url = await uploadFile(f); setEditLessonForm(p => ({ ...p, videoUrl: url })); addToast('success', 'Video uploaded'); }
                    catch { addToast('error', 'Upload failed'); }
                  }} className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 dark:file:bg-purple-900/20 dark:file:text-purple-400 hover:file:bg-purple-100" />
                  {editLessonForm.videoUrl && <p className="text-xs text-green-600 break-all">Uploaded: {editLessonForm.videoUrl}</p>}
                </div>
              )}
              {editLessonForm.contentType === 'TEXT' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Content</label>
                    <textarea rows={6} value={editLessonForm.content} onChange={e => setEditLessonForm(p => ({ ...p, content: e.target.value }))} className={`${ic} w-full resize-none font-mono`} placeholder="Write lesson content..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Attachments (PPT, Word, PDF)</label>
                    <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { addToast('info', `Uploading ${f.name}...`); const url = await uploadFile(f); setEditLessonForm(p => ({ ...p, content: p.content + `\n\n📎 ${f.name}\n${url}` })); addToast('success', `${f.name} uploaded`); } catch { addToast('error', 'Upload failed'); } } }} className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#F77B0F]/10 file:text-[#F77B0F] hover:file:bg-[#F77B0F]/20" />
                  </div>
                </div>
              )}
              {editLessonForm.contentType === 'ASSIGNMENT' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Assignment Instructions</label>
                    <textarea rows={4} value={editLessonForm.content} onChange={e => setEditLessonForm(p => ({ ...p, content: e.target.value }))} className={`${ic} w-full resize-none`} placeholder="Describe the assignment..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-card-foreground mb-1">Reference Files</label>
                    <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={async e => { const f = e.target.files?.[0]; if (f) { try { addToast('info', `Uploading ${f.name}...`); const url = await uploadFile(f); setEditLessonForm(p => ({ ...p, content: p.content + `\n\n📎 ${f.name}\n${url}` })); addToast('success', `${f.name} uploaded`); } catch { addToast('error', 'Upload failed'); } } }} className="w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#F77B0F]/10 file:text-[#F77B0F] hover:file:bg-[#F77B0F]/20" />
                  </div>
                </div>
              )}

              {editLessonForm.contentType === 'QUIZ' && (
                <div className="space-y-4">
                  {/* Quiz settings — timer & attempts */}
                  <div className="grid grid-cols-2 gap-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <div>
                      <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Time Limit (min) <span className="font-normal text-amber-600">0 = no limit</span></label>
                      <input type="number" min={0} value={editLessonForm.timeLimitMin} onChange={e => setEditLessonForm(p => ({ ...p, timeLimitMin: Number(e.target.value) }))} className={`${ic} w-full`} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">Max Attempts <span className="font-normal text-amber-600">0 = unlimited</span></label>
                      <input type="number" min={0} value={editLessonForm.maxAttempts} onChange={e => setEditLessonForm(p => ({ ...p, maxAttempts: Number(e.target.value) }))} className={`${ic} w-full`} />
                    </div>
                  </div>

                  {/* Question list */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-card-foreground">Questions ({editLessonQuestions.length})</p>
                    <div className="flex items-center gap-2">
                      {/* Bulk CSV import */}
                      <label className="cursor-pointer px-3 py-1 text-xs font-semibold rounded-lg border border-[#F77B0F]/40 text-[#F77B0F] dark:text-[#5b8bc7] hover:bg-[#F77B0F]/5 transition-colors">
                        📄 Import CSV
                        <input type="file" accept=".csv,.txt" className="hidden" onChange={e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = ev => {
                            const text = ev.target?.result as string;
                            const lines = text.trim().split('\n').filter(Boolean);
                            // Skip header row if it starts with "question"
                            const dataLines = lines[0]?.toLowerCase().startsWith('question') ? lines.slice(1) : lines;
                            const imported = dataLines.map(line => {
                              const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
                              // CSV columns: question, type, optionA, optionB, optionC, optionD, correctAnswer, points, explanation
                              const [question = '', type = 'MULTIPLE_CHOICE', a = '', b = '', c = '', d = '', correctAnswer = '', points = '10', explanation = ''] = cols;
                              return {
                                _key: Math.random().toString(36).slice(2), id: null,
                                type: type.toUpperCase().replace(/ /g, '_') || 'MULTIPLE_CHOICE',
                                question, options: [a, b, c, d], correctAnswer,
                                points: Number(points) || 10, explanation,
                              };
                            }).filter(q => q.question);
                            if (imported.length > 0) {
                              setEditLessonQuestions(qs => [...qs, ...imported]);
                              addToast('success', `Imported ${imported.length} question${imported.length !== 1 ? 's' : ''}`);
                            } else {
                              addToast('error', 'No valid questions found. Check CSV format.');
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = '';
                        }} />
                      </label>
                      <button type="button" onClick={() => setEditLessonQuestions(qs => [...qs, emptyQuestion()])} className="px-3 py-1 text-xs font-semibold rounded-lg bg-[#F77B0F] text-white hover:bg-[#F77B0F]/80">+ Add Question</button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground -mt-1">CSV columns: <code>question, type, optionA, optionB, optionC, optionD, correctAnswer, points, explanation</code></p>

                  {loadingEditQuestions ? (
                    <p className="text-xs text-muted-foreground italic py-2">Loading existing questions…</p>
                  ) : (
                    <div className="space-y-4">
                      {editLessonQuestions.map((q, qi) => (
                        <div key={q._key} className="rounded-lg border border-border bg-card p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-xs font-bold text-[#F77B0F] dark:text-[#5b8bc7]">Q{qi + 1}</p>
                            <button type="button" onClick={() => setEditLessonQuestions(qs => qs.filter((_, i) => i !== qi))} className="text-red-400 hover:text-red-600 text-xs font-medium">Remove</button>
                          </div>
                          <textarea
                            rows={2}
                            value={q.question}
                            onChange={e => setEditLessonQuestions(qs => qs.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))}
                            placeholder="Question text…"
                            className={`${ic} w-full resize-none`}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5 block">Type</label>
                              <select value={q.type} onChange={e => setEditLessonQuestions(qs => qs.map((x, i) => i === qi ? { ...x, type: e.target.value } : x))} className={`${ic} w-full text-xs`}>
                                <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                                <option value="TEXT">Short Answer</option>
                                <option value="CHECKBOX">Checkbox (Multi-select)</option>
                                <option value="FILE_UPLOAD">File Upload</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5 block">Points</label>
                              <input type="number" min={1} value={q.points} onChange={e => setEditLessonQuestions(qs => qs.map((x, i) => i === qi ? { ...x, points: Number(e.target.value) } : x))} className={`${ic} w-full text-xs`} />
                            </div>
                          </div>
                          {(q.type === 'MULTIPLE_CHOICE' || q.type === 'CHECKBOX') && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Options (mark correct with ✓)</p>
                              {[0, 1, 2, 3].map(oi => (
                                <div key={oi} className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditLessonQuestions(qs => qs.map((x, i) => i === qi ? { ...x, correctAnswer: q.type === 'CHECKBOX' ? (Array.isArray(x.correctAnswer) ? (x.correctAnswer.includes(x.options[oi]) ? x.correctAnswer.filter((v: string) => v !== x.options[oi]) : [...x.correctAnswer, x.options[oi]]) : [x.options[oi]]) : x.options[oi] } : x))}
                                    className={`w-5 h-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[9px] font-bold transition-colors ${(q.type === 'CHECKBOX' ? (Array.isArray(q.correctAnswer) && q.correctAnswer.includes(q.options[oi])) : q.correctAnswer === q.options[oi]) ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}
                                  >✓</button>
                                  <input
                                    type="text"
                                    value={q.options[oi] || ''}
                                    onChange={e => setEditLessonQuestions(qs => qs.map((x, i) => { if (i !== qi) return x; const opts = [...x.options]; opts[oi] = e.target.value; return { ...x, options: opts }; }))}
                                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                    className={`${ic} flex-1 text-xs`}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          {q.type === 'TEXT' && (
                            <div>
                              <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5 block">Model Answer (for manual grading reference)</label>
                              <input type="text" value={q.correctAnswer || ''} onChange={e => setEditLessonQuestions(qs => qs.map((x, i) => i === qi ? { ...x, correctAnswer: e.target.value } : x))} placeholder="Expected answer…" className={`${ic} w-full text-xs`} />
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-0.5 block">Explanation (shown after submission)</label>
                            <input type="text" value={q.explanation || ''} onChange={e => setEditLessonQuestions(qs => qs.map((x, i) => i === qi ? { ...x, explanation: e.target.value } : x))} placeholder="Why is this the correct answer?" className={`${ic} w-full text-xs`} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setEditingLesson(null)} className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted">Cancel</button>
                <button onClick={handleEditLesson} disabled={savingLesson || loadingEditQuestions || !editLessonForm.title} className="px-6 py-2 text-sm font-bold rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors">
                  {savingLesson ? 'Saving...' : loadingEditQuestions ? 'Loading questions…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
