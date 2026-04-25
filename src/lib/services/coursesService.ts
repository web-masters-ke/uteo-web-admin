import api, { unwrap } from '../api';
import { PaginatedResponse } from '../types';

export interface Course {
  id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  category?: string | { id: string; name: string };
  categoryId?: string;
  level: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  instructor?: { id: string; firstName: string; lastName: string; email: string; name?: string; avatar?: string; trainerProfile?: { rating?: number; specialization?: string } };
  instructorId?: string;
  enrolledCount: number;
  totalEnrolled?: number;
  rating: number;
  totalReviews: number;
  thumbnail?: string;
  thumbnailUrl?: string;
  tags?: string[];
  isFeatured?: boolean;
  lessons?: CourseLesson[];
  _count?: { enrollments?: number; lessons?: number };
  createdAt: string;
  updatedAt: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  duration: number;
  sortOrder: number;
  contentType: string;
  type?: string;
  videoUrl?: string;
  textContent?: string;
  isFree: boolean;
  isPreview?: boolean;
  episodeNumber?: number;
  questions?: LessonQuestion[];
}

export interface LessonQuestion {
  id: string;
  question: string;
  questionType: string;
  options: string[];
  correctAnswer?: string;
  explanation?: string;
  points: number;
  sortOrder: number;
}

export interface CreateCourseData {
  title: string;
  description?: string;
  thumbnail?: string;
  price?: number;
  currency?: string;
  category?: string;
  level?: string;
  duration?: number;
  tags?: string[];
  instructorId?: string;
  settings?: Record<string, any>;
  certConfig?: Record<string, any>;
}

export interface CreateLessonData {
  title: string;
  description?: string;
  contentType?: string;
  videoUrl?: string;
  textContent?: string;
  duration?: number;
  sortOrder?: number;
  isFree?: boolean;
  episodeNumber?: number;
  content?: string;
  questions?: { question: string; type: string; options: string[]; correctAnswer: string; explanation?: string; points?: number }[];
}

export const coursesService = {
  list: async (params?: Record<string, any>): Promise<PaginatedResponse<Course>> => {
    const qs = new URLSearchParams();
    if (params) Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') qs.set(k, String(v)); });
    const res = await api.get(`/courses?${qs.toString()}`);
    return unwrap<PaginatedResponse<Course>>(res);
  },

  getById: async (id: string): Promise<Course> => {
    const res = await api.get(`/courses/${id}`);
    return unwrap<Course>(res);
  },

  create: async (data: CreateCourseData): Promise<Course> => {
    const res = await api.post('/courses', data);
    return unwrap<Course>(res);
  },

  update: async (id: string, data: Partial<Course> & Record<string, any>) => {
    const res = await api.patch(`/courses/${id}`, data);
    return unwrap<Course>(res);
  },

  delete: async (id: string) => {
    const res = await api.delete(`/courses/${id}`);
    return unwrap<any>(res);
  },

  publish: async (id: string) => {
    const res = await api.post(`/courses/${id}/publish`);
    return unwrap<Course>(res);
  },

  addLesson: async (courseId: string, data: CreateLessonData) => {
    const res = await api.post(`/courses/${courseId}/lessons`, data);
    return unwrap<CourseLesson>(res);
  },

  updateLesson: async (courseId: string, lessonId: string, data: Partial<CreateLessonData>) => {
    const res = await api.patch(`/courses/${courseId}/lessons/${lessonId}`, data);
    return unwrap<CourseLesson>(res);
  },

  deleteLesson: async (courseId: string, lessonId: string) => {
    const res = await api.delete(`/courses/${courseId}/lessons/${lessonId}`);
    return unwrap<any>(res);
  },

  addQuestion: async (courseId: string, lessonId: string, data: { question: string; questionType?: string; options?: string[]; correctAnswer?: string; explanation?: string; points?: number; sortOrder?: number }) => {
    const res = await api.post(`/courses/${courseId}/lessons/${lessonId}/questions`, data);
    return unwrap<LessonQuestion>(res);
  },

  deleteQuestion: async (courseId: string, lessonId: string, questionId: string) => {
    const res = await api.delete(`/courses/${courseId}/lessons/${lessonId}/questions/${questionId}`);
    return unwrap<any>(res);
  },

  // Milestones (Modules)
  getMilestones: async (courseId: string) => {
    const res = await api.get(`/courses/${courseId}/milestones`); return unwrap<any[]>(res);
  },
  createMilestone: async (courseId: string, data: { title: string; description?: string; orderIndex?: number; passingScore?: number; weight?: number }) => {
    const res = await api.post(`/courses/${courseId}/milestones`, data); return unwrap<any>(res);
  },
  updateMilestone: async (courseId: string, milestoneId: string, data: any) => {
    const res = await api.patch(`/courses/${courseId}/milestones/${milestoneId}`, data); return unwrap<any>(res);
  },
  deleteMilestone: async (courseId: string, milestoneId: string) => {
    const res = await api.delete(`/courses/${courseId}/milestones/${milestoneId}`); return unwrap<any>(res);
  },

  // Assessments
  getAssessments: async (courseId: string, lessonId: string) => {
    const res = await api.get(`/courses/${courseId}/lessons/${lessonId}/assessments`); return unwrap<any[]>(res);
  },
  addAssessment: async (courseId: string, lessonId: string, data: { question: string; type?: string; options?: any; correctAnswer?: any; points?: number; orderIndex?: number; explanation?: string | null }) => {
    const res = await api.post(`/courses/${courseId}/lessons/${lessonId}/assessments`, data); return unwrap<any>(res);
  },
  updateAssessment: async (courseId: string, lessonId: string, assessmentId: string, data: any) => {
    const res = await api.patch(`/courses/${courseId}/lessons/${lessonId}/assessments/${assessmentId}`, data); return unwrap<any>(res);
  },
  deleteAssessment: async (courseId: string, lessonId: string, assessmentId: string) => {
    const res = await api.delete(`/courses/${courseId}/lessons/${lessonId}/assessments/${assessmentId}`); return unwrap<any>(res);
  },

  // Certificates
  getCertificates: async (courseId: string) => {
    const res = await api.get(`/courses/${courseId}/certificates`); return unwrap<any[]>(res);
  },
  issueCertificate: async (courseId: string, userId: string, finalGrade?: number) => {
    const res = await api.post(`/courses/${courseId}/certificates/issue/${userId}`, { finalGrade }); return unwrap<any>(res);
  },
  revokeCertificate: async (courseId: string, certId: string, reason: string) => {
    const res = await api.patch(`/courses/${courseId}/certificates/${certId}/revoke`, { reason }); return unwrap<any>(res);
  },
};
