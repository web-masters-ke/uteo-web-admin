import api, { unwrap } from '../api';

export interface ModerationCourse {
  id: string;
  title: string;
  trainer: string;
  trainerId: string;
  submittedAt: string;
  category: string;
  previewUrl?: string;
  status: string;
}

export interface ModerationReview {
  id: string;
  text: string;
  rating: number;
  reviewer: string;
  trainer: string;
  bookingId: string;
  flagReason?: string;
}

export interface ModerationMessage {
  id: string;
  content: string;
  sender: string;
  senderId: string;
  reportedBy: string;
  conversationId: string;
  reportedAt: string;
}

export const moderationService = {
  getCourses: async (): Promise<ModerationCourse[]> => {
    const res = await api.get('/courses?status=UNDER_REVIEW&limit=50');
    const data = unwrap<any>(res);
    const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
    return items.map((c: any) => ({
      id: c.id,
      title: c.title,
      trainer: c.trainer?.user ? `${c.trainer.user.firstName} ${c.trainer.user.lastName}` : (c.trainerName ?? '-'),
      trainerId: c.trainerId ?? c.trainer?.id ?? '',
      submittedAt: c.createdAt ?? c.submittedAt ?? '',
      category: c.category?.name ?? c.categoryName ?? c.category ?? '-',
      previewUrl: c.previewUrl ?? c.videoUrl ?? '',
      status: c.status,
    }));
  },

  approveCourse: async (id: string): Promise<void> => {
    await api.patch(`/courses/${id}/approve`);
  },

  rejectCourse: async (id: string, reason: string): Promise<void> => {
    await api.patch(`/courses/${id}/reject`, { reason });
  },

  getFlaggedReviews: async (): Promise<ModerationReview[]> => {
    const res = await api.get('/reviews?flagged=true&limit=50');
    const data = unwrap<any>(res);
    const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
    return items.map((r: any) => ({
      id: r.id,
      text: r.comment ?? r.text ?? '',
      rating: Number(r.rating ?? 0),
      reviewer: r.reviewer ? `${r.reviewer.firstName} ${r.reviewer.lastName}` : (r.reviewerName ?? '-'),
      trainer: r.trainer?.user ? `${r.trainer.user.firstName} ${r.trainer.user.lastName}` : (r.trainerName ?? '-'),
      bookingId: r.bookingId ?? '',
      flagReason: r.flagReason ?? r.moderationReason ?? '',
    }));
  },

  removeReview: async (id: string): Promise<void> => {
    await api.delete(`/reviews/${id}`);
  },

  getFlaggedMessages: async (): Promise<ModerationMessage[]> => {
    const res = await api.get('/admin/flagged-messages?limit=50');
    const data = unwrap<any>(res);
    const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
    return items.map((m: any) => ({
      id: m.id,
      content: m.content ?? m.message ?? '',
      sender: m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : (m.senderName ?? '-'),
      senderId: m.senderId ?? m.sender?.id ?? '',
      reportedBy: m.reportedBy ? `${m.reportedBy.firstName} ${m.reportedBy.lastName}` : (m.reportedByName ?? '-'),
      conversationId: m.conversationId ?? m.chatId ?? '',
      reportedAt: m.reportedAt ?? m.createdAt ?? '',
    }));
  },

  dismissMessage: async (id: string): Promise<void> => {
    await api.patch(`/admin/flagged-messages/${id}/dismiss`);
  },

  deleteMessage: async (id: string): Promise<void> => {
    await api.delete(`/admin/flagged-messages/${id}`);
  },

  suspendUser: async (userId: string): Promise<void> => {
    await api.patch(`/users/${userId}/suspend`);
  },
};
