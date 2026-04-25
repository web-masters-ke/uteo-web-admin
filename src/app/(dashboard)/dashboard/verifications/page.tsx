'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { StatsCard } from '@/components/StatsCard';
import { Modal } from '@/components/Modal';
import api, { unwrap } from '@/lib/api';
import { verificationService } from '@/lib/services/verificationService';
import { trainerService } from '@/lib/services/trainerService';
import { VerificationRequest, Trainer } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatDate, formatRelative, getInitials, formatCurrency } from '@/lib/utils';

/* ─── Constants ─── */
const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'];

const CREDENTIAL_TYPE_COLORS: Record<string, string> = {
  DEGREE: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  DIPLOMA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CERTIFICATE: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  LICENSE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PROFESSIONAL_MEMBERSHIP: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  TRADE_CERTIFICATE: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  APPRENTICESHIP: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PORTFOLIO: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  DEGREE: 'Degree', DIPLOMA: 'Diploma', CERTIFICATE: 'Certificate', LICENSE: 'License',
  PROFESSIONAL_MEMBERSHIP: 'Professional Membership', TRADE_CERTIFICATE: 'Trade Certificate',
  APPRENTICESHIP: 'Apprenticeship', PORTFOLIO: 'Portfolio',
};

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  CERTIFIED: { label: 'Certified', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  EXPERIENCED: { label: 'Experienced', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  ENTRY_LEVEL: { label: 'Entry Level', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
};

const TRAINER_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  PROFESSIONAL: { label: 'White Collar', color: 'bg-[#192C67]/10 text-[#192C67] dark:bg-[#192C67]/30 dark:text-[#5b8bc7]' },
  VOCATIONAL: { label: 'Blue Collar', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  BOTH: { label: 'Both', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
};

const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

/* ─── Types for credentials ─── */
interface CredentialStats {
  totalPending: number;
  approvedToday: number;
  rejectedToday: number;
  byType: Record<string, number>;
}

interface CredentialItem {
  id: string;
  name: string;
  credentialType: string;
  issuer: string;
  year?: number;
  yearObtained?: number;
  documentUrl?: string;
  verificationStatus: string;
  rejectedReason?: string;
  reviewNote?: string;
  trainer?: {
    id: string;
    trainerType?: string;
    tier?: string;
    user?: { id: string; firstName: string; lastName: string; email: string; avatarUrl?: string };
  };
  createdAt: string;
}

/* ─── Helper: Trainer context for a request ─── */
interface TrainerContext {
  trainer: Trainer | null;
  loading: boolean;
}

function useTrainerContext(trainerId: string | undefined): TrainerContext {
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!trainerId) return;
    setLoading(true);
    trainerService.getById(trainerId)
      .then(setTrainer)
      .catch(() => setTrainer(null))
      .finally(() => setLoading(false));
  }, [trainerId]);

  return { trainer, loading };
}

/* ─── Trainer Profile Card (shown in review) ─── */
function TrainerContextPanel({ trainerId }: { trainerId: string }) {
  const { trainer, loading } = useTrainerContext(trainerId);

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-3 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (!trainer) {
    return <p className="text-xs text-muted-foreground">Could not load trainer details.</p>;
  }

  const user = trainer.user;
  const tierCfg = trainer.tier ? TIER_CONFIG[trainer.tier] : null;
  const typeCfg = trainer.trainerType ? TRAINER_TYPE_CONFIG[trainer.trainerType] : null;

  return (
    <div className="space-y-4">
      {/* Trainer header */}
      <div className="flex items-center gap-3">
        {user?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center text-sm font-bold">
            {getInitials(user?.firstName, user?.lastName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm text-card-foreground">{user?.firstName} {user?.lastName}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5">
        {tierCfg && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${tierCfg.color}`}>{tierCfg.label}</span>}
        {typeCfg && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>}
      </div>

      {/* Profile summary */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        {trainer.specialization && (
          <><span className="text-muted-foreground">Specialization</span><span className="font-medium text-card-foreground">{trainer.specialization}</span></>
        )}
        {trainer.experience != null && trainer.experience > 0 && (
          <><span className="text-muted-foreground">Experience</span><span className="font-medium text-card-foreground">{trainer.experience} years</span></>
        )}
        {trainer.averageRating != null && trainer.averageRating > 0 && (
          <><span className="text-muted-foreground">Rating</span><span className="font-medium text-card-foreground">{trainer.averageRating.toFixed(1)} / 5 ({trainer.totalReviews} reviews)</span></>
        )}
        {trainer.completedSessions != null && trainer.completedSessions > 0 && (
          <><span className="text-muted-foreground">Sessions</span><span className="font-medium text-card-foreground">{trainer.completedSessions} completed</span></>
        )}
        {trainer.hourlyRate != null && trainer.hourlyRate > 0 && (
          <><span className="text-muted-foreground">Rate</span><span className="font-medium text-card-foreground">{formatCurrency(trainer.hourlyRate, trainer.currency || 'KES')}/hr</span></>
        )}
        {(trainer.city || trainer.county) && (
          <><span className="text-muted-foreground">Location</span><span className="font-medium text-card-foreground">{[trainer.city, trainer.county].filter(Boolean).join(', ')}</span></>
        )}
      </div>

      {/* Skills */}
      {trainer.skills && trainer.skills.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Skills</p>
          <div className="flex flex-wrap gap-1">
            {trainer.skills.slice(0, 8).map((s) => (
              <span key={s.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400">
                {s.icon || ''} {s.name}
              </span>
            ))}
            {trainer.skills.length > 8 && (
              <span className="text-[10px] text-muted-foreground">+{trainer.skills.length - 8} more</span>
            )}
          </div>
        </div>
      )}

      {/* Existing credentials */}
      {trainer.certifications && trainer.certifications.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">Existing Credentials</p>
          <div className="space-y-1">
            {trainer.certifications.map((cert) => {
              const verified = cert.verified || cert.verificationStatus === 'APPROVED';
              return (
                <div key={cert.id} className="flex items-center gap-2 text-xs">
                  {verified ? (
                    <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
                  )}
                  <span className="text-card-foreground">{cert.name}</span>
                  <span className="text-muted-foreground">({cert.issuer})</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Document Preview Inline ─── */
function DocumentPreview({ url }: { url?: string }) {
  const [imgState, setImgState] = React.useState<'loading' | 'loaded' | 'error'>('loading');

  if (!url) return <span className="text-xs text-muted-foreground italic">No document uploaded</span>;

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const isPdf = /\.pdf$/i.test(url);

  return (
    <div className="mt-2">
      {isImage ? (
        <div className="relative">
          {imgState === 'loading' && (
            <div className="w-full h-24 rounded-lg bg-muted animate-pulse" />
          )}
          {imgState === 'error' ? (
            <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              Image unavailable —{' '}
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline">open link</a>
            </div>
          ) : (
            <a href={url} target="_blank" rel="noopener noreferrer" className={`block transition-opacity ${imgState === 'loaded' ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Document"
                className="max-h-32 rounded-lg border border-border object-contain"
                onLoad={() => setImgState('loaded')}
                onError={() => setImgState('error')}
              />
            </a>
          )}
        </div>
      ) : isPdf ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
          Open PDF ↗
        </a>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-primary-500 hover:underline">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          View Document ↗
        </a>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function VerificationsPage() {
  const { addToast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'credentials'>('pending');

  // ── Tab 1: Pending Review ──
  const [pendingReqs, setPendingReqs] = useState<VerificationRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingStats, setPendingStats] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0, avgReviewTime: '-' });

  // ── Tab 2: All Requests ──
  const [allReqs, setAllReqs] = useState<VerificationRequest[]>([]);
  const [allLoading, setAllLoading] = useState(true);
  const [allPage, setAllPage] = useState(1);
  const [allTotalPages, setAllTotalPages] = useState(1);
  const [allTotal, setAllTotal] = useState(0);
  const [allStatusFilter, setAllStatusFilter] = useState('');

  // ── Tab 3: Credentials ──
  const [credStats, setCredStats] = useState<CredentialStats>({ totalPending: 0, approvedToday: 0, rejectedToday: 0, byType: {} });
  const [credentials, setCredentials] = useState<CredentialItem[]>([]);
  const [credLoading, setCredLoading] = useState(true);
  const [credSearch, setCredSearch] = useState('');
  const [credTypeFilter, setCredTypeFilter] = useState('');

  // ── Shared modal state ──
  const [reviewReq, setReviewReq] = useState<VerificationRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | 'need_info' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  // Credential review modal
  const [credReviewItem, setCredReviewItem] = useState<CredentialItem | null>(null);
  const [credReviewAction, setCredReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [credReviewNote, setCredReviewNote] = useState('');
  const [credActionLoading, setCredActionLoading] = useState(false);

  // Document preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  /* ─── Fetch: Pending Requests ─── */
  const fetchPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const d = await verificationService.getAll({ page: 1, limit: 50, status: 'PENDING' });
      setPendingReqs(d.items);
      setPendingStats((prev) => ({ ...prev, pending: d.total }));
    } catch {
      addToast('error', 'Failed to load pending requests');
    } finally {
      setPendingLoading(false);
    }
  }, [addToast]);

  const fetchPendingStats = useCallback(async () => {
    try {
      // Use the credentials stats endpoint which has richer data
      const res = await api.get('/verification/credentials/stats');
      const data = unwrap<CredentialStats>(res);
      setPendingStats({
        pending: data.totalPending,
        approvedToday: data.approvedToday,
        rejectedToday: data.rejectedToday,
        avgReviewTime: '-',
      });
    } catch {
      // Fallback — just use the count from the requests
    }
  }, []);

  /* ─── Fetch: All Requests ─── */
  const fetchAll = useCallback(async () => {
    setAllLoading(true);
    try {
      const d = await verificationService.getAll({ page: allPage, limit: 10, status: allStatusFilter || undefined });
      setAllReqs(d.items);
      setAllTotalPages(d.totalPages);
      setAllTotal(d.total);
    } catch {
      addToast('error', 'Failed to load verification requests');
    } finally {
      setAllLoading(false);
    }
  }, [allPage, allStatusFilter, addToast]);

  /* ─── Fetch: Credentials ─── */
  const fetchCredStats = useCallback(async () => {
    try {
      const res = await api.get('/verification/credentials/stats');
      const data = unwrap<CredentialStats>(res);
      setCredStats(data);
    } catch { /* endpoint may not exist */ }
  }, []);

  const fetchCredentials = useCallback(async () => {
    setCredLoading(true);
    try {
      const params = new URLSearchParams();
      if (credSearch) params.set('search', credSearch);
      if (credTypeFilter) params.set('credentialType', credTypeFilter);
      const res = await api.get(`/verification/credentials/all?${params.toString()}`);
      const data = unwrap<any>(res);
      setCredentials(Array.isArray(data) ? data : data?.items || data?.data || []);
    } catch {
      addToast('error', 'Failed to load credentials');
    } finally {
      setCredLoading(false);
    }
  }, [credSearch, credTypeFilter, addToast]);

  /* ─── Effects ─── */
  useEffect(() => { fetchPending(); fetchPendingStats(); }, [fetchPending, fetchPendingStats]);
  useEffect(() => { if (activeTab === 'all') fetchAll(); }, [activeTab, fetchAll]);
  useEffect(() => { if (activeTab === 'credentials') { fetchCredStats(); fetchCredentials(); } }, [activeTab, fetchCredStats, fetchCredentials]);

  /* ─── Actions: Verification Requests ─── */
  const handleReview = async () => {
    if (!reviewReq || !reviewAction) return;
    if (reviewAction === 'reject' && !reviewNotes.trim()) {
      addToast('error', 'Rejection reason is required');
      return;
    }
    setReviewLoading(true);
    try {
      if (reviewAction === 'approve') {
        await verificationService.approve(reviewReq.id, reviewNotes);
        addToast('success', 'Verification approved');
      } else if (reviewAction === 'reject') {
        await verificationService.reject(reviewReq.id, reviewNotes);
        addToast('success', 'Verification rejected');
      } else if (reviewAction === 'need_info') {
        // Send notification to trainer asking for more info — don't change status
        // Get the user ID — trainer on verification might be profile ID or user ID
        let userId = (reviewReq as any).trainer?.user?.id || (reviewReq as any).trainer?.userId;
        if (!userId && reviewReq.trainerId) {
          // trainerId might be the profile ID — fetch the trainer to get userId
          try {
            const tRes = await api.get(`/trainers/${reviewReq.trainerId}`);
            const tData = unwrap<any>(tRes);
            userId = tData?.user?.id || tData?.userId || reviewReq.trainerId;
          } catch {
            userId = reviewReq.trainerId; // fallback — try it as userId
          }
        }
        if (userId) {
          await api.post('/notifications/send', {
            userId,
            userId,
            channel: 'IN_APP',
            title: 'More information needed for your verification',
            message: reviewNotes || 'Please provide additional documentation or clearer copies for your credential verification.',
          });
          // Also try email
          await api.post('/notifications/send', {
            userId,
            channel: 'EMAIL',
            title: 'SkillSasa: More information needed',
            message: `We need more information to verify your credential.\n\nDetails: ${reviewNotes}\n\nPlease log in to your SkillSasa account and resubmit your documents.`,
          }).catch(() => {});
        }
        addToast('success', 'Request for more information sent to trainer');
      }
      closeReviewModal();
      fetchPending();
      fetchPendingStats();
      if (activeTab === 'all') fetchAll();
    } catch {
      addToast('error', `Failed to ${reviewAction} verification`);
    } finally {
      setReviewLoading(false);
    }
  };

  const closeReviewModal = () => {
    setReviewReq(null);
    setReviewAction(null);
    setReviewNotes('');
  };

  /* ─── Actions: Credential Review ─── */
  const handleCredReview = async () => {
    if (!credReviewItem || !credReviewAction) return;
    if (credReviewAction === 'reject' && !credReviewNote.trim()) {
      addToast('error', 'Rejection reason is required');
      return;
    }
    setCredActionLoading(true);
    try {
      const body: Record<string, string> = { status: credReviewAction === 'approve' ? 'APPROVED' : 'REJECTED' };
      if (credReviewAction === 'approve') body.reviewNote = credReviewNote || 'Verified';
      else body.rejectedReason = credReviewNote;

      await api.patch(`/verification/credential/${credReviewItem.id}/review`, body);
      addToast('success', `Credential ${credReviewAction === 'approve' ? 'approved' : 'rejected'}`);
      closeCredReviewModal();
      fetchCredentials();
      fetchCredStats();
      fetchPendingStats();
    } catch {
      addToast('error', `Failed to ${credReviewAction} credential`);
    } finally {
      setCredActionLoading(false);
    }
  };

  const closeCredReviewModal = () => {
    setCredReviewItem(null);
    setCredReviewAction(null);
    setCredReviewNote('');
  };

  /* ─── Helpers ─── */
  const getTrainerName = (r: VerificationRequest): string => {
    if (r.trainer?.user) return `${r.trainer.user.firstName} ${r.trainer.user.lastName}`;
    return '-';
  };

  const getTrainerEmail = (r: VerificationRequest): string => {
    if (r.trainer?.user) return r.trainer.user.email;
    return '';
  };

  /* ─── Tab 2: All Requests table columns ─── */
  const allColumns: Column<VerificationRequest>[] = [
    {
      key: 'trainer',
      label: 'Trainer',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-[10px] font-bold shrink-0">
            {getInitials(r.trainer?.user?.firstName, r.trainer?.user?.lastName)}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{getTrainerName(r)}</p>
            <p className="text-xs text-muted-foreground truncate">{getTrainerEmail(r)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'documentType',
      label: 'Document Type',
      render: (r) => {
        const color = CREDENTIAL_TYPE_COLORS[r.documentType] || 'bg-gray-100 text-gray-700';
        const label = CREDENTIAL_TYPE_LABELS[r.documentType] || r.documentType.replace(/_/g, ' ');
        return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>{label}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'reviewedBy',
      label: 'Reviewer',
      render: (r) => <span className="text-sm text-muted-foreground">{r.reviewedBy ? `${(r.reviewedBy as any).firstName || ''} ${(r.reviewedBy as any).lastName || ''}`.trim() || 'Admin' : '-'}</span>,
    },
    {
      key: 'reviewNote',
      label: 'Notes',
      render: (r) => <span className="text-xs text-muted-foreground max-w-[200px] truncate block">{r.reviewNote || r.notes || '-'}</span>,
    },
    {
      key: 'createdAt',
      label: 'Submitted',
      sortable: true,
      render: (r) => <span className="text-muted-foreground text-xs">{formatDate(r.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="flex gap-1">
          {r.documentUrl && (
            <button onClick={(e) => { e.stopPropagation(); setPreviewUrl(r.documentUrl); }} className="px-2 py-1 text-xs rounded font-medium 0/10 text-blue-600 hover:0/20">
              View Doc
            </button>
          )}
          {r.status === 'PENDING' && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setReviewReq(r); setReviewAction('approve'); setReviewNotes(''); }} className="px-2 py-1 text-xs rounded font-medium bg-green-500/10 text-green-600 hover:bg-green-500/20">
                Approve
              </button>
              <button onClick={(e) => { e.stopPropagation(); setReviewReq(r); setReviewAction('reject'); setReviewNotes(''); }} className="px-2 py-1 text-xs rounded font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20">
                Reject
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  /* ─── TABS definition ─── */
  const tabs: { key: typeof activeTab; label: string; count?: number }[] = [
    { key: 'pending', label: 'Pending Review', count: pendingStats.pending },
    { key: 'all', label: 'All Requests' },
    { key: 'credentials', label: 'Credentials', count: credStats.totalPending },
  ];

  return (
    <div>
      <PageHeader
        title="Verification Centre"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Verifications' }]}
      />

      {/* ── Tab Switcher ── */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`relative px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'text-primary-500 border-b-2 border-primary-500'
                : 'text-muted-foreground hover:text-card-foreground'
            }`}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white min-w-[18px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1: PENDING REVIEW
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pending' && (
        <div>
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              label="Pending"
              value={pendingStats.pending}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatsCard
              label="Approved Today"
              value={pendingStats.approvedToday}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatsCard
              label="Rejected Today"
              value={pendingStats.rejectedToday}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatsCard
              label="Avg Review Time"
              value={pendingStats.avgReviewTime}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
          </div>

          {/* Pending request cards */}
          {pendingLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-card rounded-xl border border-border p-6 animate-pulse">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : pendingReqs.length === 0 ? (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <svg className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <p className="text-muted-foreground font-medium">No pending verifications</p>
              <p className="text-sm text-muted-foreground/70 mt-1">All caught up! Check back later.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingReqs.map((req) => {
                const trainerUser = req.trainer?.user;
                const trainerType = req.trainer?.trainerType;
                const typeCfg = trainerType ? TRAINER_TYPE_CONFIG[trainerType] : null;
                const tierCfg = req.trainer?.tier ? TIER_CONFIG[req.trainer.tier] : null;
                const docTypeColor = CREDENTIAL_TYPE_COLORS[req.documentType] || 'bg-gray-100 text-gray-700';
                const docTypeLabel = CREDENTIAL_TYPE_LABELS[req.documentType] || req.documentType.replace(/_/g, ' ');

                return (
                  <div key={req.id} className="bg-card rounded-xl border border-border overflow-hidden">
                    {/* Card header */}
                    <div className="p-5 border-b border-border/50">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {trainerUser?.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={trainerUser.avatarUrl} alt="" className="w-11 h-11 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-sm font-bold shrink-0">
                              {getInitials(trainerUser?.firstName, trainerUser?.lastName)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-card-foreground">{trainerUser?.firstName} {trainerUser?.lastName}</p>
                              {tierCfg && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${tierCfg.color}`}>{tierCfg.label}</span>}
                              {typeCfg && <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${typeCfg.color}`}>{typeCfg.label}</span>}
                            </div>
                            <p className="text-xs text-muted-foreground">{trainerUser?.email}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatRelative(req.createdAt)}</span>
                      </div>
                    </div>

                    {/* Card body — two columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border/50">
                      {/* Left: Document info */}
                      <div className="p-5">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Document Submitted</h4>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${docTypeColor}`}>
                            {docTypeLabel}
                          </span>
                        </div>
                        {req.notes && (
                          <p className="text-sm text-card-foreground mb-2">{req.notes}</p>
                        )}

                        {/* Document preview */}
                        <DocumentPreview url={req.documentUrl} />
                      </div>

                      {/* Right: Trainer context (loaded lazily) */}
                      <div className="p-5">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trainer Profile</h4>
                        {req.trainerId && <TrainerContextPanel trainerId={req.trainerId} />}
                      </div>
                    </div>

                    {/* Card footer — action buttons */}
                    <div className="px-5 py-3 bg-muted/30 border-t border-border/50 flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setReviewReq(req); setReviewAction('need_info'); setReviewNotes(''); }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors"
                      >
                        Need More Info
                      </button>
                      <button
                        onClick={() => { setReviewReq(req); setReviewAction('reject'); setReviewNotes(''); }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => { setReviewReq(req); setReviewAction('approve'); setReviewNotes(''); }}
                        className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2: ALL REQUESTS
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'all' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select
              value={allStatusFilter}
              onChange={(e) => { setAllStatusFilter(e.target.value); setAllPage(1); }}
              className={`${ic} w-40`}
            >
              <option value="">All Statuses</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {allStatusFilter && (
              <button onClick={() => { setAllStatusFilter(''); setAllPage(1); }} className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted">
                Clear
              </button>
            )}
          </div>

          <DataTable
            columns={allColumns}
            data={allReqs}
            loading={allLoading}
            page={allPage}
            totalPages={allTotalPages}
            total={allTotal}
            onPageChange={setAllPage}
            keyExtractor={(r) => r.id}
            emptyMessage="No verification requests"
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 3: CREDENTIALS
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'credentials' && (
        <div>
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard
              label="Total Pending"
              value={credStats.totalPending}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatsCard
              label="Approved Today"
              value={credStats.approvedToday}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatsCard
              label="Rejected Today"
              value={credStats.rejectedToday}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />
            <StatsCard
              label="By Type Breakdown"
              value={credStats.byType && Object.keys(credStats.byType).length > 0 ? Object.entries(credStats.byType).map(([k, v]) => `${CREDENTIAL_TYPE_LABELS[k] || k}: ${v}`).join(', ') : '-'}
              icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                value={credSearch}
                onChange={(e) => setCredSearch(e.target.value)}
                placeholder="Search trainer name..."
                className={`${ic} w-64 pl-9`}
              />
            </div>
            <select value={credTypeFilter} onChange={(e) => setCredTypeFilter(e.target.value)} className={`${ic} w-56`}>
              <option value="">All Credential Types</option>
              {Object.entries(CREDENTIAL_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {(credSearch || credTypeFilter) && (
              <button onClick={() => { setCredSearch(''); setCredTypeFilter(''); }} className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors">
                Clear filters
              </button>
            )}
          </div>

          {/* Credentials Table */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trainer</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credential</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Institution</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Year</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trainer Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Document</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {credLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <td key={j} className="px-4 py-4">
                            <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : credentials.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">
                        No pending credentials found
                      </td>
                    </tr>
                  ) : (
                    credentials.map((cred) => {
                      const trainerUser = cred.trainer?.user;
                      const trainerType = cred.trainer?.trainerType;
                      const typeColor = CREDENTIAL_TYPE_COLORS[cred.credentialType] || CREDENTIAL_TYPE_COLORS.PORTFOLIO;
                      const typeLabel = CREDENTIAL_TYPE_LABELS[cred.credentialType] || cred.credentialType;

                      return (
                        <tr key={cred.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-xs font-bold">
                                {getInitials(trainerUser?.firstName, trainerUser?.lastName)}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-card-foreground">{trainerUser?.firstName} {trainerUser?.lastName}</p>
                                <p className="text-xs text-muted-foreground">{trainerUser?.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className="text-sm font-medium text-card-foreground">{cred.name}</span></td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${typeColor}`}>{typeLabel}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{cred.issuer || '-'}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">{cred.year || cred.yearObtained || '-'}</td>
                          <td className="px-4 py-3">
                            {trainerType ? (
                              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                trainerType === 'PROFESSIONAL' ? 'bg-[#192C67]/10 text-[#192C67] dark:bg-[#192C67]/30 dark:text-[#5b8bc7]' : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                              }`}>
                                {trainerType === 'PROFESSIONAL' ? 'Professional' : 'Vocational'}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {cred.documentUrl ? (
                              <a href={cred.documentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-500 hover:underline inline-flex items-center gap-1">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                View
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">No file</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setCredReviewItem(cred); setCredReviewAction('approve'); setCredReviewNote(''); }}
                                disabled={credActionLoading}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-40"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => { setCredReviewItem(cred); setCredReviewAction('reject'); setCredReviewNote(''); }}
                                disabled={credActionLoading}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
         ════════════════════════════════════════════════════════════════════ */}

      {/* ── Verification Request Review Modal ── */}
      <Modal
        isOpen={!!reviewReq && !!reviewAction}
        onClose={closeReviewModal}
        title={
          reviewAction === 'approve' ? 'Approve Verification'
            : reviewAction === 'reject' ? 'Reject Verification'
              : 'Request More Information'
        }
        size="lg"
      >
        <div className="space-y-5">
          {/* Request summary */}
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-xs font-bold">
                {reviewReq && getInitials(reviewReq.trainer?.user?.firstName, reviewReq.trainer?.user?.lastName)}
              </div>
              <div>
                <p className="font-medium text-sm">{reviewReq ? getTrainerName(reviewReq) : '-'}</p>
                <p className="text-xs text-muted-foreground">{reviewReq ? getTrainerEmail(reviewReq) : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Document:</span>
              {reviewReq && (
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CREDENTIAL_TYPE_COLORS[reviewReq.documentType] || 'bg-gray-100 text-gray-700'}`}>
                  {CREDENTIAL_TYPE_LABELS[reviewReq.documentType] || reviewReq.documentType.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          </div>

          {/* Document */}
          {reviewReq?.documentUrl && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Document</p>
              <DocumentPreview url={reviewReq.documentUrl} />
              <a
                href={reviewReq.documentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary-500 hover:underline"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                Open in new tab
              </a>
            </div>
          )}

          {/* Trainer context */}
          {reviewReq?.trainerId && (
            <div className="border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trainer Context</p>
              <TrainerContextPanel trainerId={reviewReq.trainerId} />
            </div>
          )}

          {/* Notes / Reason */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              {reviewAction === 'approve' && 'Review Note (optional)'}
              {reviewAction === 'reject' && (
                <>Rejection Reason <span className="text-red-500">*</span></>
              )}
              {reviewAction === 'need_info' && (
                <>What additional information is needed? <span className="text-red-500">*</span></>
              )}
            </label>
            {reviewAction === 'reject' && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['Document is blurry/unreadable', 'Document has expired', 'Does not match profile information', 'Incomplete documentation', 'Suspected fraudulent document'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setReviewNotes(reason)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      reviewNotes === reason
                        ? 'bg-red-500 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={3}
              placeholder={
                reviewAction === 'approve' ? 'Optional notes about this approval...'
                  : reviewAction === 'reject' ? 'Explain why this verification is being rejected...'
                    : 'Describe what documents or information the trainer needs to provide...'
              }
              className={ic}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={closeReviewModal} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleReview}
              disabled={
                reviewLoading
                || (reviewAction === 'reject' && !reviewNotes.trim())
                || (reviewAction === 'need_info' && !reviewNotes.trim())
              }
              className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors ${
                reviewAction === 'approve' ? 'bg-green-500 hover:bg-green-600'
                  : reviewAction === 'reject' ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {reviewLoading ? 'Processing...'
                : reviewAction === 'approve' ? 'Approve'
                  : reviewAction === 'reject' ? 'Reject'
                    : 'Send Request'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Credential Review Modal ── */}
      <Modal
        isOpen={!!credReviewItem && !!credReviewAction}
        onClose={closeCredReviewModal}
        title={credReviewAction === 'approve' ? 'Approve Credential' : 'Reject Credential'}
        size="md"
      >
        <div className="space-y-4">
          {credReviewItem && (
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-xs font-bold">
                  {getInitials(credReviewItem.trainer?.user?.firstName, credReviewItem.trainer?.user?.lastName)}
                </div>
                <div>
                  <p className="text-sm font-medium">{credReviewItem.trainer?.user?.firstName} {credReviewItem.trainer?.user?.lastName}</p>
                  <p className="text-xs text-muted-foreground">{credReviewItem.trainer?.user?.email}</p>
                </div>
              </div>
              <p className="text-sm font-medium mt-2">{credReviewItem.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CREDENTIAL_TYPE_COLORS[credReviewItem.credentialType] || 'bg-gray-100 text-gray-700'}`}>
                  {CREDENTIAL_TYPE_LABELS[credReviewItem.credentialType] || credReviewItem.credentialType}
                </span>
                <span className="text-xs text-muted-foreground">{credReviewItem.issuer} - {credReviewItem.year || credReviewItem.yearObtained || '-'}</span>
              </div>
              {credReviewItem.documentUrl && (
                <div className="mt-2">
                  <DocumentPreview url={credReviewItem.documentUrl} />
                </div>
              )}
            </div>
          )}

          {/* Trainer context for credential review */}
          {credReviewItem?.trainer?.id && (
            <div className="border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Trainer Context</p>
              <TrainerContextPanel trainerId={credReviewItem.trainer.id} />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1.5">
              {credReviewAction === 'approve' ? 'Review Note (optional)' : (
                <>Reason for Rejection <span className="text-red-500">*</span></>
              )}
            </label>
            {credReviewAction === 'reject' && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {['Document is blurry/unreadable', 'Document has expired', 'Does not match profile information', 'Incomplete documentation'].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setCredReviewNote(reason)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      credReviewNote === reason ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            )}
            <textarea
              value={credReviewNote}
              onChange={(e) => setCredReviewNote(e.target.value)}
              rows={3}
              placeholder={credReviewAction === 'approve' ? 'Optional review notes...' : 'Provide a clear reason for rejecting this credential...'}
              className={ic}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={closeCredReviewModal} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCredReview}
              disabled={credActionLoading || (credReviewAction === 'reject' && !credReviewNote.trim())}
              className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors ${
                credReviewAction === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {credActionLoading ? 'Processing...' : credReviewAction === 'approve' ? 'Approve Credential' : 'Reject Credential'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Document Preview Modal ── */}
      <Modal
        isOpen={!!previewUrl}
        onClose={() => setPreviewUrl(null)}
        title="Document Preview"
        size="lg"
      >
        {previewUrl && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border overflow-hidden bg-muted/50 flex items-center justify-center min-h-[300px]">
              {previewUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Verification document" className="max-w-full max-h-[60vh] object-contain" />
              ) : previewUrl.match(/\.pdf$/i) ? (
                <div className="flex flex-col items-center justify-center gap-5 p-10 text-center w-full">
                  <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                    <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-card-foreground mb-1">PDF Document</p>
                    <p className="text-sm text-muted-foreground">Opens instantly in your browser's PDF viewer</p>
                  </div>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3 rounded-xl bg-[#F77B0F] text-white text-sm font-semibold hover:bg-[#e06a0d] transition-colors inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Open PDF
                  </a>
                </div>
              ) : (
                <div className="text-center p-8">
                  <p className="text-muted-foreground mb-3">Preview not available for this file type</p>
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm">
                    Download File
                  </a>
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                Open in new tab
              </a>
              <button onClick={() => setPreviewUrl(null)} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
