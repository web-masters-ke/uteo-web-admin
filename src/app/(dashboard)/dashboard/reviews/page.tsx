'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { RatingStars } from '@/components/RatingStars';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Modal } from '@/components/Modal';
import { reviewService } from '@/lib/services/reviewService';
import { Review } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatDate, truncate } from '@/lib/utils';

/* ── Interactive Stars (click-to-rate) ── */
function InteractiveStars({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="focus:outline-none"
        >
          <svg
            className={`w-7 h-7 ${
              i <= (hover || rating) ? 'text-[#F77B0F]' : 'text-gray-200 dark:text-gray-700'
            } transition-colors`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/* ── Rating Distribution Bar ── */
function RatingDistribution({ distribution, total }: { distribution: Record<number, number>; total: number }) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = distribution[star] || 0;
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-right text-muted-foreground font-medium">{star}</span>
            <svg className="w-3.5 h-3.5 text-[#F77B0F] flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#F77B0F] rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-muted-foreground">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ReviewsPage() {
  const { addToast } = useToast();
  const [data, setData] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Stats
  const [stats, setStats] = useState<{
    averageRating: number;
    totalReviews: number;
    distribution: Record<number, number>;
  } | null>(null);

  // Filters
  const [ratingFilter, setRatingFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');

  // Edit modal
  const [editModal, setEditModal] = useState<{ open: boolean; review: Review | null }>({ open: false, review: null });
  const [editRating, setEditRating] = useState(0);
  const [editComment, setEditComment] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; review: Review | null }>({ open: false, review: null });
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Toggle visibility dialog
  const [toggleDialog, setToggleDialog] = useState<{ open: boolean; review: Review | null }>({ open: false, review: null });
  const [toggleLoading, setToggleLoading] = useState(false);

  // Detail modal
  const [detailModal, setDetailModal] = useState<{ open: boolean; review: Review | null }>({ open: false, review: null });

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const d = await reviewService.getAll({
        page,
        limit: 20,
        rating: ratingFilter ? Number(ratingFilter) : undefined,
        search: searchFilter || undefined,
        isVisible: visibilityFilter || undefined,
      });
      setData(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch {
      addToast('error', 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  }, [page, ratingFilter, searchFilter, visibilityFilter, addToast]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await reviewService.getGlobalStats();
      setStats(s);
    } catch {
      // Silently fail — stats are supplementary
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // ── Edit handlers ──
  const openEdit = (review: Review) => {
    setEditModal({ open: true, review });
    setEditRating(review.rating);
    setEditComment(review.comment || '');
  };

  const closeEdit = () => {
    setEditModal({ open: false, review: null });
    setEditRating(0);
    setEditComment('');
  };

  const handleEditSave = async () => {
    if (!editModal.review) return;
    if (editRating < 1 || editRating > 5) {
      addToast('error', 'Please select a rating between 1 and 5');
      return;
    }
    setEditSaving(true);
    try {
      await reviewService.update(editModal.review.id, {
        rating: editRating,
        comment: editComment || undefined,
      });
      addToast('success', 'Review updated');
      closeEdit();
      fetchReviews();
      fetchStats();
    } catch {
      addToast('error', 'Failed to update review');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete handlers ──
  const handleDelete = async () => {
    if (!deleteDialog.review) return;
    setDeleteLoading(true);
    try {
      await reviewService.remove(deleteDialog.review.id);
      addToast('success', 'Review deleted');
      setDeleteDialog({ open: false, review: null });
      fetchReviews();
      fetchStats();
    } catch {
      addToast('error', 'Failed to delete review');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Toggle visibility ──
  const handleToggleVisibility = async () => {
    if (!toggleDialog.review) return;
    setToggleLoading(true);
    try {
      await reviewService.toggleVisibility(toggleDialog.review.id, !toggleDialog.review.isVisible);
      addToast('success', toggleDialog.review.isVisible ? 'Review hidden' : 'Review made visible');
      setToggleDialog({ open: false, review: null });
      fetchReviews();
      fetchStats();
    } catch {
      addToast('error', 'Failed to update review visibility');
    } finally {
      setToggleLoading(false);
    }
  };

  // ── Helpers ──
  const getReviewerName = (r: Review) => {
    const rv = r.reviewer as Record<string, string> | undefined;
    return rv ? `${rv.firstName} ${rv.lastName}` : '-';
  };

  const getTrainerName = (r: Review) => {
    const t = r.trainer as Record<string, unknown> | undefined;
    if (!t) return '-';
    const u = t.user as Record<string, string> | undefined;
    if (u) return `${u.firstName} ${u.lastName}`;
    return `${t.firstName || ''} ${t.lastName || ''}`.trim() || '-';
  };

  const getAvatar = (user: Record<string, string> | undefined) => {
    if (!user) return null;
    const url = user.avatar || user.avatarUrl;
    const initials = `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase();
    if (url) {
      return (
        <img src={url} alt="" className="w-8 h-8 rounded-full object-cover" />
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center text-xs font-medium">
        {initials || '?'}
      </div>
    );
  };

  const inputCls =
    'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';

  const columns: Column<Review>[] = [
    {
      key: 'reviewer',
      label: 'Reviewer',
      render: (r) => {
        const rv = r.reviewer as Record<string, string> | undefined;
        return (
          <div className="flex items-center gap-2.5">
            {getAvatar(rv)}
            <span className="font-medium text-sm">{getReviewerName(r)}</span>
          </div>
        );
      },
    },
    {
      key: 'trainer',
      label: 'Trainer',
      render: (r) => {
        const t = r.trainer as Record<string, unknown> | undefined;
        const u = (t?.user as Record<string, string>) || (t as Record<string, string> | undefined);
        return (
          <div className="flex items-center gap-2.5">
            {getAvatar(u as Record<string, string> | undefined)}
            <span className="text-sm">{getTrainerName(r)}</span>
          </div>
        );
      },
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (r) => <RatingStars rating={r.rating} size="sm" />,
    },
    {
      key: 'comment',
      label: 'Comment',
      render: (r) => (
        <span className="text-muted-foreground text-sm" title={r.comment}>
          {truncate(r.comment, 50)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (r) => <span className="text-muted-foreground text-sm">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'isVisible',
      label: 'Visible',
      render: (r) => (
        <span
          className={
            r.isVisible
              ? 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }
        >
          {r.isVisible ? 'Visible' : 'Hidden'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          {/* Edit */}
          <button
            onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="p-1.5 rounded-lg text-primary-600 dark:text-primary-400 hover:bg-gray-50 dark:hover:bg-white/10/10 transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
          </button>
          {/* Hide / Show */}
          <button
            onClick={(e) => { e.stopPropagation(); setToggleDialog({ open: true, review: r }); }}
            className={`p-1.5 rounded-lg transition-colors ${
              r.isVisible
                ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10'
                : 'text-green-600 dark:text-green-400 hover:bg-green-500/10'
            }`}
            title={r.isVisible ? 'Hide' : 'Show'}
          >
            {r.isVisible ? (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </button>
          {/* Delete */}
          <button
            onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, review: r }); }}
            className="p-1.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reviews"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Reviews' }]}
      />

      {/* ── Stats Row ── */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Total Reviews */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{stats.totalReviews}</p>
                <p className="text-xs text-muted-foreground">Total Reviews</p>
              </div>
            </div>
          </div>

          {/* Average Rating */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-lg bg-[#F77B0F]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#F77B0F]" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-card-foreground">{stats.averageRating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </div>
            </div>
            <div className="mt-1">
              <RatingStars rating={stats.averageRating} size="sm" />
            </div>
          </div>

          {/* Rating Distribution */}
          <div className="bg-card border border-border rounded-xl p-5">
            <p className="text-xs font-medium text-muted-foreground mb-2">Rating Distribution</p>
            <RatingDistribution distribution={stats.distribution} total={stats.totalReviews} />
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            value={searchFilter}
            onChange={(e) => { setSearchFilter(e.target.value); setPage(1); }}
            placeholder="Search by name or comment..."
            className={`${inputCls} pl-9 w-64`}
          />
        </div>

        <select
          value={ratingFilter}
          onChange={(e) => { setRatingFilter(e.target.value); setPage(1); }}
          className={`${inputCls} w-40`}
        >
          <option value="">All Ratings</option>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {r} Star{r !== 1 ? 's' : ''}
            </option>
          ))}
        </select>

        <select
          value={visibilityFilter}
          onChange={(e) => { setVisibilityFilter(e.target.value); setPage(1); }}
          className={`${inputCls} w-36`}
        >
          <option value="">All</option>
          <option value="true">Visible</option>
          <option value="false">Hidden</option>
        </select>

        {(ratingFilter || searchFilter || visibilityFilter) && (
          <button
            onClick={() => { setRatingFilter(''); setSearchFilter(''); setVisibilityFilter(''); setPage(1); }}
            className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={(r) => r.id}
        emptyMessage="No reviews found"
        onRowClick={(r) => setDetailModal({ open: true, review: r })}
      />

      {/* ── Edit Modal ── */}
      <Modal
        isOpen={editModal.open}
        onClose={closeEdit}
        title="Edit Review"
        size="md"
      >
        {editModal.review && (
          <div>
            {/* Context */}
            <div className="flex items-center gap-4 mb-5 p-3 bg-muted/50 rounded-lg">
              <div className="text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-card-foreground">{getReviewerName(editModal.review)}</span>
                  {' reviewed '}
                  <span className="font-medium text-card-foreground">{getTrainerName(editModal.review)}</span>
                </p>
              </div>
            </div>

            {/* Rating */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Rating
              </label>
              <InteractiveStars rating={editRating} onChange={setEditRating} />
            </div>

            {/* Comment */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-card-foreground mb-2">
                Comment
              </label>
              <textarea
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                rows={4}
                maxLength={2000}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-card text-card-foreground focus:ring-2 focus:ring-primary-500/50 outline-none resize-none text-sm"
                placeholder="Review comment..."
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {editComment.length}/2000
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                onClick={closeEdit}
                className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving || editRating < 1}
                className="px-5 py-2 text-sm font-medium border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent rounded-lg hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal
        isOpen={detailModal.open}
        onClose={() => setDetailModal({ open: false, review: null })}
        title="Review Details"
        size="md"
      >
        {detailModal.review && (() => {
          const r = detailModal.review;
          const rv = r.reviewer as Record<string, string> | undefined;
          const t = r.trainer as Record<string, unknown> | undefined;
          const b = r.booking as Record<string, string> | undefined;
          return (
            <div className="space-y-5">
              {/* Reviewer */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {getAvatar(rv)}
                <div>
                  <p className="font-medium text-card-foreground text-sm">{getReviewerName(r)}</p>
                  <p className="text-xs text-muted-foreground">Reviewer</p>
                </div>
              </div>

              {/* Trainer */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                {getAvatar((t?.user || t) as Record<string, string> | undefined)}
                <div>
                  <p className="font-medium text-card-foreground text-sm">{getTrainerName(r)}</p>
                  <p className="text-xs text-muted-foreground">Trainer</p>
                </div>
              </div>

              {/* Rating */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Rating</p>
                <RatingStars rating={r.rating} size="md" />
              </div>

              {/* Comment */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Comment</p>
                <p className="text-sm text-card-foreground">{r.comment || 'No comment provided.'}</p>
              </div>

              {/* Booking info */}
              {b && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Session Info</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type: </span>
                      <span className="text-card-foreground font-medium">{b.sessionType || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="text-card-foreground font-medium">{b.scheduledAt ? formatDate(b.scheduledAt) : '-'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Meta */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                <span>Created: {formatDate(r.createdAt)}</span>
                <span
                  className={
                    r.isVisible
                      ? 'inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'inline-flex items-center px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }
                >
                  {r.isVisible ? 'Visible' : 'Hidden'}
                </span>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ── Toggle Visibility Dialog ── */}
      <ConfirmDialog
        isOpen={toggleDialog.open}
        onClose={() => setToggleDialog({ open: false, review: null })}
        onConfirm={handleToggleVisibility}
        title={toggleDialog.review?.isVisible ? 'Hide Review' : 'Show Review'}
        message={
          toggleDialog.review?.isVisible
            ? 'This review will be hidden from public view. The reviewer and trainer will not see it.'
            : 'This review will be made visible to the public again.'
        }
        confirmLabel={toggleDialog.review?.isVisible ? 'Hide Review' : 'Show Review'}
        confirmVariant={toggleDialog.review?.isVisible ? 'danger' : 'primary'}
        loading={toggleLoading}
      />

      {/* ── Delete Dialog ── */}
      <ConfirmDialog
        isOpen={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, review: null })}
        onConfirm={handleDelete}
        title="Delete Review"
        message="Are you sure you want to permanently delete this review? This action cannot be undone and will recalculate the trainer's rating."
        confirmLabel="Delete Review"
        confirmVariant="danger"
        loading={deleteLoading}
      />
    </div>
  );
}
