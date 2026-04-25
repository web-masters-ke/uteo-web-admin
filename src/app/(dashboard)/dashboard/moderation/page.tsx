'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import {
  moderationService,
  ModerationCourse,
  ModerationReview,
  ModerationMessage,
} from '@/lib/services/moderationService';
import { useToast } from '@/lib/toast';
import { formatDateTime } from '@/lib/utils';

type Tab = 'courses' | 'reviews' | 'messages';

const ic =
  'w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';

export default function ModerationPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('courses');

  // Courses
  const [courses, setCourses] = useState<ModerationCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ModerationCourse | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  // Messages
  const [messages, setMessages] = useState<ModerationMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(true);

  const fetchCourses = useCallback(async () => {
    setCoursesLoading(true);
    try {
      const data = await moderationService.getCourses();
      setCourses(data);
    } catch {
      addToast('error', 'Failed to load courses under review');
    } finally {
      setCoursesLoading(false);
    }
  }, [addToast]);

  const fetchReviews = useCallback(async () => {
    setReviewsLoading(true);
    try {
      const data = await moderationService.getFlaggedReviews();
      setReviews(data);
    } catch {
      addToast('error', 'Failed to load flagged reviews');
      setReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, [addToast]);

  const fetchMessages = useCallback(async () => {
    setMessagesLoading(true);
    try {
      const data = await moderationService.getFlaggedMessages();
      setMessages(data);
    } catch {
      addToast('error', 'Failed to load flagged messages');
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchCourses();
    fetchReviews();
    fetchMessages();
  }, [fetchCourses, fetchReviews, fetchMessages]);

  // ── Course Actions ──────────────────────────────────────────────────────────

  const handleApproveCourse = async (course: ModerationCourse) => {
    setActionLoading(true);
    try {
      await moderationService.approveCourse(course.id);
      addToast('success', `"${course.title}" approved`);
      fetchCourses();
    } catch {
      addToast('error', 'Failed to approve course');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (course: ModerationCourse) => {
    setRejectTarget(course);
    setRejectReason('');
    setRejectModal(true);
  };

  const handleRejectCourse = async () => {
    if (!rejectTarget || !rejectReason.trim()) {
      addToast('error', 'Rejection reason is required');
      return;
    }
    setActionLoading(true);
    try {
      await moderationService.rejectCourse(rejectTarget.id, rejectReason);
      addToast('success', `"${rejectTarget.title}" rejected`);
      setRejectModal(false);
      setRejectTarget(null);
      fetchCourses();
    } catch {
      addToast('error', 'Failed to reject course');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Review Actions ──────────────────────────────────────────────────────────

  const handleRemoveReview = async (review: ModerationReview) => {
    setActionLoading(true);
    try {
      await moderationService.removeReview(review.id);
      addToast('success', 'Review removed');
      fetchReviews();
    } catch {
      addToast('error', 'Failed to remove review');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Message Actions ─────────────────────────────────────────────────────────

  const handleDismissMessage = async (msg: ModerationMessage) => {
    setActionLoading(true);
    try {
      await moderationService.dismissMessage(msg.id);
      addToast('success', 'Report dismissed');
      fetchMessages();
    } catch {
      addToast('error', 'Failed to dismiss report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMessage = async (msg: ModerationMessage) => {
    setActionLoading(true);
    try {
      await moderationService.deleteMessage(msg.id);
      addToast('success', 'Message deleted');
      fetchMessages();
    } catch {
      addToast('error', 'Failed to delete message');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendSender = async (msg: ModerationMessage) => {
    if (!msg.senderId) { addToast('error', 'Cannot identify sender'); return; }
    setActionLoading(true);
    try {
      await moderationService.suspendUser(msg.senderId);
      addToast('success', `${msg.sender} suspended`);
    } catch {
      addToast('error', 'Failed to suspend user');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Columns ─────────────────────────────────────────────────────────────────

  const courseCols: Column<ModerationCourse>[] = [
    {
      key: 'title',
      label: 'Course Title',
      render: (c) => <span className="font-medium text-card-foreground">{c.title}</span>,
    },
    { key: 'trainer', label: 'Trainer', render: (c) => c.trainer },
    {
      key: 'submittedAt',
      label: 'Submitted',
      render: (c) => <span className="text-xs text-muted-foreground">{formatDateTime(c.submittedAt)}</span>,
    },
    { key: 'category', label: 'Category', render: (c) => c.category },
    {
      key: 'preview',
      label: 'Preview',
      render: (c) =>
        c.previewUrl ? (
          <a href={c.previewUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:text-blue-600 underline">
            View
          </a>
        ) : (
          <span className="text-muted-foreground text-xs">N/A</span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (c) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleApproveCourse(c); }}
            disabled={actionLoading}
            className="px-2.5 py-1 text-xs rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
          >
            Approve
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); openRejectModal(c); }}
            className="px-2.5 py-1 text-xs rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
          >
            Reject
          </button>
        </div>
      ),
    },
  ];

  const reviewCols: Column<ModerationReview>[] = [
    {
      key: 'text',
      label: 'Review Text',
      render: (r) => (
        <span className="text-sm text-card-foreground" title={r.text}>
          {r.text.length > 80 ? `${r.text.slice(0, 80)}…` : r.text}
        </span>
      ),
    },
    {
      key: 'rating',
      label: 'Rating',
      render: (r) => (
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5 text-[#F77B0F]" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {r.rating}
        </span>
      ),
    },
    { key: 'reviewer', label: 'Reviewer', render: (r) => r.reviewer },
    { key: 'trainer', label: 'Trainer', render: (r) => r.trainer },
    {
      key: 'bookingId',
      label: 'Booking',
      render: (r) => <span className="font-mono text-xs text-muted-foreground">{r.bookingId?.slice(0, 8)}</span>,
    },
    {
      key: 'flagReason',
      label: 'Flag Reason',
      render: (r) => r.flagReason ? (
        <span className="text-xs text-amber-600 dark:text-amber-400">{r.flagReason}</span>
      ) : (
        <span className="text-muted-foreground text-xs">-</span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); }}
            className="px-2.5 py-1 text-xs rounded-lg bg-muted hover:bg-muted/70 transition-colors text-card-foreground"
          >
            Keep
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleRemoveReview(r); }}
            disabled={actionLoading}
            className="px-2.5 py-1 text-xs rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  const messageCols: Column<ModerationMessage>[] = [
    {
      key: 'content',
      label: 'Message',
      render: (m) => (
        <span className="text-sm text-card-foreground" title={m.content}>
          {m.content.length > 70 ? `${m.content.slice(0, 70)}…` : m.content}
        </span>
      ),
    },
    { key: 'sender', label: 'Sender', render: (m) => m.sender },
    { key: 'reportedBy', label: 'Reported By', render: (m) => m.reportedBy },
    {
      key: 'conversationId',
      label: 'Conversation',
      render: (m) => <span className="font-mono text-xs text-muted-foreground">{m.conversationId?.slice(0, 8)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (m) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); handleDismissMessage(m); }}
            disabled={actionLoading}
            className="px-2 py-1 text-xs rounded-lg bg-muted hover:bg-muted/70 transition-colors text-card-foreground disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDeleteMessage(m); }}
            disabled={actionLoading}
            className="px-2 py-1 text-xs rounded-lg bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            Delete
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleSuspendSender(m); }}
            disabled={actionLoading}
            className="px-2 py-1 text-xs rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
          >
            Suspend User
          </button>
        </div>
      ),
    },
  ];

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'courses', label: 'Courses', count: courses.length },
    { key: 'reviews', label: 'Reviews', count: reviews.length },
    { key: 'messages', label: 'Flagged Messages', count: messages.length },
  ];

  return (
    <div>
      <PageHeader
        title="Content Moderation Queue"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Moderation Queue' },
        ]}
      />

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === tab.key
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-muted-foreground hover:text-card-foreground'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                activeTab === tab.key ? 'bg-primary-500/10 text-primary-500' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'courses' && (
        <DataTable
          columns={courseCols}
          data={courses}
          loading={coursesLoading}
          keyExtractor={(c) => c.id}
          emptyMessage="No courses pending moderation"
        />
      )}

      {activeTab === 'reviews' && (
        <DataTable
          columns={reviewCols}
          data={reviews}
          loading={reviewsLoading}
          keyExtractor={(r) => r.id}
          emptyMessage="No flagged reviews"
        />
      )}

      {activeTab === 'messages' && (
        <DataTable
          columns={messageCols}
          data={messages}
          loading={messagesLoading}
          keyExtractor={(m) => m.id}
          emptyMessage="No flagged messages"
        />
      )}

      {/* Reject Course Modal */}
      <Modal
        isOpen={rejectModal}
        onClose={() => { setRejectModal(false); setRejectTarget(null); }}
        title="Reject Course"
        size="sm"
      >
        <div className="space-y-4">
          {rejectTarget && (
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium">{rejectTarget.title}</p>
              <p className="text-xs text-muted-foreground">by {rejectTarget.trainer}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Explain why this course is being rejected..."
              className={ic}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              onClick={() => { setRejectModal(false); setRejectTarget(null); }}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectCourse}
              disabled={actionLoading || !rejectReason.trim()}
              className="px-5 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? 'Rejecting…' : 'Reject Course'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
