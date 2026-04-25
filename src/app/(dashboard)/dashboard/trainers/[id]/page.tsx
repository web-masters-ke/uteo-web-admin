'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { RatingStars } from '@/components/RatingStars';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { trainerService } from '@/lib/services/trainerService';
import { userService } from '@/lib/services/userService';
import { walletService } from '@/lib/services/walletService';
import { financialService } from '@/lib/services/financialService';
import { bookingService } from '@/lib/services/bookingService';
import { reviewService } from '@/lib/services/reviewService';
import { Trainer, Booking, Review } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, formatDateTime, getInitials } from '@/lib/utils';

const KENYAN_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit',
  'Meru','Migori','Mombasa','Murang\'a','Nairobi','Nakuru','Nandi','Narok','Nyamira',
  'Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi',
  'Trans-Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
];

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function TrainerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();

  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'reviews' | 'earnings'>('overview');

  // Earnings tab state
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsFetched, setEarningsFetched] = useState(false);
  const [earningsSummary, setEarningsSummary] = useState<{
    totalEarnings: number; commissionPaid: number; netEarnings: number; pendingWithdrawal: number;
  } | null>(null);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<{ month: string; amount: number }[]>([]);

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    bio: '', specialization: '', hourlyRate: '', experience: '', location: '', county: '',
    languages: '', portfolioUrl: '', linkedinUrl: '', websiteUrl: '',
    availableForOnline: false, availableForPhysical: false, availableForHybrid: false,
  });

  // Verify form
  const [verifyForm, setVerifyForm] = useState<{ action: 'approve' | 'reject'; notes: string }>({ action: 'approve', notes: '' });

  // Fund form
  const [fundForm, setFundForm] = useState({ amount: 0, description: '' });

  const ic = "w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors";

  const fetchTrainer = useCallback(async () => {
    try {
      const data = await trainerService.getById(params.id as string);
      setTrainer(data);
    } catch {
      addToast('error', 'Failed to load trainer');
      router.push('/dashboard/trainers');
    } finally {
      setLoading(false);
    }
  }, [params.id, addToast, router]);

  const fetchBookings = useCallback(async () => {
    if (!trainer) return;
    try {
      const d = await bookingService.getAll({ trainerId: trainer.userId, limit: 10 });
      setBookings(d.items);
    } catch { /* ignore */ }
  }, [trainer]);

  const fetchReviews = useCallback(async () => {
    if (!trainer) return;
    try {
      const d = await reviewService.getAll({ trainerId: trainer.userId, limit: 10 });
      setReviews(d.items);
    } catch { /* ignore */ }
  }, [trainer]);

  const fetchEarnings = useCallback(async () => {
    if (!trainer || earningsFetched) return;
    setEarningsLoading(true);
    try {
      // Fetch wallet for pending withdrawal
      let wallet: any = null;
      try { wallet = await walletService.getByUser(trainer.userId); } catch { /* ignore */ }

      // Fetch payouts (financial report for this trainer)
      let payoutsData: any[] = [];
      let totalEarnings = 0;
      let commissionPaid = 0;
      let netEarnings = 0;
      try {
        const { financialService } = await import('@/lib/services/financialService');
        const raw = await financialService.payoutQueue({ trainerId: trainer.userId, limit: 50 }).catch(() => null);
        payoutsData = Array.isArray(raw) ? raw : (raw?.items ?? raw?.data ?? []);
        totalEarnings = payoutsData.reduce((s: number, p: any) => s + Number(p.totalAmount ?? p.amount ?? 0), 0);
        commissionPaid = payoutsData.reduce((s: number, p: any) => s + Number(p.commissionAmount ?? p.commission ?? 0), 0);
        netEarnings = payoutsData.reduce((s: number, p: any) => s + Number(p.trainerAmount ?? p.netAmount ?? p.amount ?? 0), 0);
      } catch { /* ignore */ }

      setPayouts(payoutsData);
      setEarningsSummary({
        totalEarnings,
        commissionPaid,
        netEarnings,
        pendingWithdrawal: Number(wallet?.balance ?? 0),
      });

      // Build last-6-months earnings from payouts
      const months: Record<string, number> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months[d.toLocaleString('default', { month: 'short', year: '2-digit' })] = 0;
      }
      payoutsData.forEach((p: any) => {
        const d = new Date(p.createdAt ?? p.processedAt ?? '');
        if (!isNaN(d.getTime())) {
          const k = d.toLocaleString('default', { month: 'short', year: '2-digit' });
          if (k in months) months[k] += Number(p.trainerAmount ?? p.amount ?? 0);
        }
      });
      setMonthlyEarnings(Object.entries(months).map(([month, amount]) => ({ month, amount })));
      setEarningsFetched(true);
    } catch {
      addToast('error', 'Failed to load earnings data');
    } finally {
      setEarningsLoading(false);
    }
  }, [trainer, earningsFetched, addToast]);

  useEffect(() => { fetchTrainer(); }, [fetchTrainer]);
  useEffect(() => { if (trainer) { fetchBookings(); fetchReviews(); } }, [trainer, fetchBookings, fetchReviews]);
  useEffect(() => { if (activeTab === 'earnings' && trainer && !earningsFetched) fetchEarnings(); }, [activeTab, trainer, earningsFetched, fetchEarnings]);

  // Edit handler
  const handleEdit = async () => {
    if (!trainer) return;
    setActionLoading(true);
    try {
      await trainerService.update(trainer.id, {
        bio: editForm.bio || undefined,
        specialization: editForm.specialization || undefined,
        hourlyRate: editForm.hourlyRate ? Number(editForm.hourlyRate) : undefined,
        experience: editForm.experience ? Number(editForm.experience) : undefined,
        location: editForm.location || undefined,
        county: editForm.county || undefined,
        languages: editForm.languages ? editForm.languages.split(',').map(l => l.trim()).filter(Boolean) : undefined,
        portfolioUrl: editForm.portfolioUrl || undefined,
        linkedinUrl: editForm.linkedinUrl || undefined,
        websiteUrl: editForm.websiteUrl || undefined,
        availableForOnline: editForm.availableForOnline,
        availableForPhysical: editForm.availableForPhysical,
        availableForHybrid: editForm.availableForHybrid,
      });
      addToast('success', 'Trainer updated');
      setEditOpen(false);
      fetchTrainer();
    } catch {
      addToast('error', 'Failed to update trainer');
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = () => {
    if (!trainer) return;
    setEditForm({
      bio: trainer.bio || '',
      specialization: trainer.specialization || '',
      hourlyRate: String(trainer.hourlyRate || ''),
      experience: String(trainer.experience || ''),
      location: trainer.location || '',
      county: trainer.county || '',
      languages: (trainer.languages || []).join(', '),
      portfolioUrl: trainer.portfolioUrl || '',
      linkedinUrl: trainer.linkedinUrl || '',
      websiteUrl: trainer.websiteUrl || '',
      availableForOnline: trainer.availableForOnline || false,
      availableForPhysical: trainer.availableForPhysical || false,
      availableForHybrid: trainer.availableForHybrid || false,
    });
    setEditOpen(true);
  };

  // Verify handler
  const handleVerify = async () => {
    if (!trainer) return;
    setActionLoading(true);
    try {
      if (verifyForm.action === 'approve') {
        await trainerService.approve(trainer.id, verifyForm.notes);
        addToast('success', 'Trainer approved');
      } else {
        if (!verifyForm.notes) { addToast('error', 'Notes required for rejection'); setActionLoading(false); return; }
        await trainerService.reject(trainer.id, verifyForm.notes);
        addToast('success', 'Trainer rejected');
      }
      setVerifyOpen(false);
      setVerifyForm({ action: 'approve', notes: '' });
      fetchTrainer();
    } catch {
      addToast('error', 'Failed to update verification');
    } finally {
      setActionLoading(false);
    }
  };

  // Suspend/Activate handler
  const handleSuspendActivate = async () => {
    if (!trainer) return;
    setActionLoading(true);
    try {
      if (trainer.user?.status === 'SUSPENDED') {
        await userService.activate(trainer.userId);
        addToast('success', `${trainer.user?.firstName} activated`);
      } else {
        await userService.suspend(trainer.userId);
        addToast('success', `${trainer.user?.firstName} suspended`);
      }
      setSuspendDialog(false);
      fetchTrainer();
    } catch {
      addToast('error', 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  // Approve withdrawal handler — finds the REQUESTED payout and approves it
  const handleApproveWithdrawal = async () => {
    const pending = payouts.find((p: any) => p.status === 'REQUESTED');
    if (!pending) { addToast('error', 'No pending withdrawal request found'); return; }
    setActionLoading(true);
    try {
      await financialService.approvePayout(pending.id);
      addToast('success', 'Withdrawal approved — go to Payments → Payouts to send the money');
      fetchTrainer();
    } catch {
      addToast('error', 'Failed to approve withdrawal');
    } finally {
      setActionLoading(false);
    }
  };

  // Fund wallet handler
  const handleFund = async () => {
    if (!trainer || fundForm.amount <= 0) { addToast('error', 'Enter a valid amount'); return; }
    setActionLoading(true);
    try {
      await walletService.adminFund(trainer.userId, fundForm.amount, fundForm.description);
      addToast('success', `Funded wallet with KES ${fundForm.amount.toLocaleString()}`);
      setFundOpen(false);
      setFundForm({ amount: 0, description: '' });
    } catch {
      addToast('error', 'Failed to fund wallet');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!trainer) return;
    setActionLoading(true);
    try {
      await userService.delete(trainer.userId);
      addToast('success', 'Trainer deleted');
      router.push('/dashboard/trainers');
    } catch {
      addToast('error', 'Failed to delete trainer');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse h-12 bg-card rounded-xl border border-border" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="animate-pulse h-80 bg-card rounded-xl border border-border" />
          <div className="lg:col-span-2 animate-pulse h-80 bg-card rounded-xl border border-border" />
        </div>
      </div>
    );
  }

  if (!trainer) return null;

  const user = trainer.user;
  const sessionTypes: string[] = [];
  if (trainer.availableForOnline) sessionTypes.push('Virtual');
  if (trainer.availableForPhysical) sessionTypes.push('Physical');
  if (trainer.availableForHybrid) sessionTypes.push('Hybrid');

  return (
    <div>
      <PageHeader
        title="Trainer Details"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Trainers', href: '/dashboard/trainers' },
          { label: `${user?.firstName} ${user?.lastName}` },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={openEdit} className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors">
              Edit Profile
            </button>
            {(trainer.verificationStatus === 'PENDING' || trainer.verificationStatus === 'UNDER_REVIEW') && (
              <>
                <button onClick={() => { setVerifyForm({ action: 'approve', notes: '' }); setVerifyOpen(true); }} className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors">
                  Approve
                </button>
                <button onClick={() => { setVerifyForm({ action: 'reject', notes: '' }); setVerifyOpen(true); }} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors">
                  Reject
                </button>
              </>
            )}
            <button
              onClick={() => setSuspendDialog(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                user?.status === 'SUSPENDED'
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {user?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
            </button>
            <button onClick={() => { setFundForm({ amount: 0, description: '' }); setFundOpen(true); }} className="px-4 py-2 rounded-lg 0 text-white text-sm font-medium hover:bg-blue-600 transition-colors">
              Fund Wallet
            </button>
            <button onClick={() => setDeleteDialog(true)} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-colors">
              Delete
            </button>
            <button onClick={() => router.push('/dashboard/trainers')} className="px-4 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors">
              Back
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ==================== PROFILE CARD ==================== */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <div className="w-20 h-20 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              {getInitials(user?.firstName, user?.lastName)}
            </div>
            <h2 className="text-lg font-semibold">{user?.firstName} {user?.lastName}</h2>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            {user?.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}
            <div className="flex justify-center gap-2 mt-3">
              <StatusBadge status={trainer.verificationStatus} />
              <StatusBadge status={user?.status || 'ACTIVE'} />
            </div>
            <div className="mt-4">
              <RatingStars rating={Number(trainer.averageRating || 0)} />
              <p className="text-xs text-muted-foreground mt-1">{trainer.totalReviews} reviews</p>
            </div>
            <div className="mt-4 space-y-2 text-sm text-left">
              {[
                ['Role', user?.role || '-'],
                ['Rate', formatCurrency(Number(trainer.hourlyRate))],
                ['Experience', `${trainer.experience} years`],
                ['Specialization', trainer.specialization || '-'],
                ['Location', trainer.location || '-'],
                ['County', trainer.county || '-'],
                ['Joined', formatDate(trainer.createdAt)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium text-right max-w-[60%] truncate">{v}</span>
                </div>
              ))}
            </div>

            {/* Languages */}
            {trainer.languages && trainer.languages.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border text-left">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Languages</p>
                <div className="flex flex-wrap gap-1">
                  {trainer.languages.map(lang => (
                    <span key={lang} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{lang}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Session Types */}
            {sessionTypes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border text-left">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Session Types</p>
                <div className="flex flex-wrap gap-1">
                  {sessionTypes.map(st => (
                    <span key={st} className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500">{st}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Links */}
            {(trainer.portfolioUrl || trainer.linkedinUrl || trainer.websiteUrl) && (
              <div className="mt-4 pt-4 border-t border-border text-left space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Links</p>
                {trainer.portfolioUrl && (
                  <a href={trainer.portfolioUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Portfolio
                  </a>
                )}
                {trainer.linkedinUrl && (
                  <a href={trainer.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    LinkedIn
                  </a>
                )}
                {trainer.websiteUrl && (
                  <a href={trainer.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                    Website
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ==================== MAIN CONTENT ==================== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Navigation */}
          <div className="flex border-b border-border">
            {(['overview', 'bookings', 'reviews', 'earnings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-muted-foreground hover:text-card-foreground'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'bookings' && bookings.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{bookings.length}</span>
                )}
                {tab === 'reviews' && reviews.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{reviews.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ==================== OVERVIEW TAB ==================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Bio */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-3">Bio</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{trainer.bio || 'No bio provided'}</p>
              </div>

              {/* Skills */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-3">Skills</h3>
                {trainer.skills?.length ? (
                  <div className="flex flex-wrap gap-2">
                    {trainer.skills.map((skill: any) => (
                      <span key={skill.id} className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary-500/10 text-primary-500">
                        {skill.skill?.name || skill.name}
                      </span>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No skills listed</p>}
              </div>

              {/* Certifications */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-3">Certifications</h3>
                {trainer.certifications?.length ? (
                  <div className="space-y-3">
                    {trainer.certifications.map(cert => (
                      <div key={cert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{cert.name}</p>
                            {cert.verified && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Verified</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {cert.issuer || 'Unknown issuer'}
                            {cert.yearObtained ? ` - ${cert.yearObtained}` : cert.issuedDate ? ` - ${formatDate(cert.issuedDate)}` : ''}
                          </p>
                          {cert.expiryDate && <p className="text-xs text-muted-foreground">Expires {formatDate(cert.expiryDate)}</p>}
                        </div>
                        {cert.documentUrl && (
                          <a href={cert.documentUrl} target="_blank" rel="noopener noreferrer" className="px-2 py-1 text-xs rounded 0/10 text-blue-600 hover:0/20 transition-colors">
                            View Doc
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No certifications</p>}
              </div>

              {/* Availability */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-3">Availability Schedule</h3>
                {trainer.availabilitySlots?.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {DAY_NAMES.map((day, idx) => {
                      const slots = trainer.availabilitySlots?.filter(s => s.dayOfWeek === idx && s.isActive) || [];
                      return (
                        <div key={day} className={`flex items-center justify-between p-2.5 rounded-lg ${slots.length > 0 ? 'bg-green-50 dark:bg-green-900/10' : 'bg-muted/30'}`}>
                          <span className="text-sm font-medium">{day}</span>
                          {slots.length > 0 ? (
                            <div className="flex flex-col items-end gap-0.5">
                              {slots.map(slot => (
                                <span key={slot.id} className="text-xs text-green-600 dark:text-green-400">
                                  {slot.startTime} - {slot.endTime}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Unavailable</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No availability set</p>}
              </div>
            </div>
          )}

          {/* ==================== BOOKINGS TAB ==================== */}
          {activeTab === 'bookings' && (
            <div className="bg-card rounded-xl border border-border">
              {bookings.length > 0 ? (
                <div className="divide-y divide-border">
                  {bookings.map(booking => (
                    <div
                      key={booking.id}
                      className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center text-xs font-bold">
                            {getInitials(booking.client?.firstName, booking.client?.lastName)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{booking.client?.firstName} {booking.client?.lastName}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(booking.scheduledAt)} - {booking.duration}min - {booking.sessionType}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-medium">{formatCurrency(Number(booking.amount))}</span>
                          <StatusBadge status={booking.status} />
                        </div>
                      </div>
                      {booking.notes && (
                        <p className="text-xs text-muted-foreground mt-2 ml-12 truncate">{booking.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="w-12 h-12 text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="text-sm text-muted-foreground">No bookings found</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== EARNINGS TAB ==================== */}
          {activeTab === 'earnings' && (
            <div className="space-y-6">
              {earningsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Stat cards */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Total Earnings', value: formatCurrency(earningsSummary?.totalEarnings ?? 0), color: 'text-card-foreground' },
                      { label: 'Commission Paid', value: formatCurrency(earningsSummary?.commissionPaid ?? 0), color: 'text-amber-600 dark:text-amber-400' },
                      { label: 'Net Earnings', value: formatCurrency(earningsSummary?.netEarnings ?? 0), color: 'text-green-600 dark:text-green-400' },
                      { label: 'Pending Withdrawal', value: formatCurrency(earningsSummary?.pendingWithdrawal ?? 0), color: 'text-[#192C67] dark:text-blue-300' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-card rounded-xl border border-border p-4">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Approve Withdrawal button */}
                  {(earningsSummary?.pendingWithdrawal ?? 0) > 0 && (
                    <div className="flex items-center justify-between p-4 rounded-xl  border border-blue-200 dark:border-blue-800">
                      <div>
                        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Pending Withdrawal</p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                          {formatCurrency(earningsSummary?.pendingWithdrawal ?? 0)} awaiting approval
                        </p>
                      </div>
                      <button
                        onClick={handleApproveWithdrawal}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                      >
                        {actionLoading ? 'Approving…' : 'Approve Withdrawal'}
                      </button>
                    </div>
                  )}

                  {/* Monthly earnings mini chart */}
                  {monthlyEarnings.length > 0 && (
                    <div className="bg-card rounded-xl border border-border p-5">
                      <h3 className="font-semibold mb-4 text-card-foreground">Monthly Earnings (last 6 months)</h3>
                      <div className="flex items-end gap-2 h-28">
                        {(() => {
                          const maxAmt = Math.max(...monthlyEarnings.map((m) => m.amount), 1);
                          return monthlyEarnings.map((m) => (
                            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className="w-full rounded-t-sm"
                                style={{
                                  height: `${Math.max((m.amount / maxAmt) * 96, m.amount > 0 ? 4 : 2)}px`,
                                  background: m.amount > 0 ? '#F77B0F' : '#e5e7eb',
                                }}
                              />
                              <span className="text-[10px] text-muted-foreground leading-none">{m.month}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Payout history table */}
                  <div className="bg-card rounded-xl border border-border overflow-hidden">
                    <div className="px-5 py-4 border-b border-border">
                      <h3 className="font-semibold text-card-foreground">Payout History</h3>
                    </div>
                    {payouts.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted">
                              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Amount</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Reference</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {payouts.map((p: any) => (
                              <tr key={p.id} className="hover:bg-muted/50 transition-colors">
                                <td className="px-4 py-3 text-muted-foreground text-xs">
                                  {formatDate(p.createdAt ?? p.processedAt ?? '')}
                                </td>
                                <td className="px-4 py-3 text-right font-medium text-green-600 dark:text-green-400">
                                  {formatCurrency(Number(p.trainerAmount ?? p.netAmount ?? p.amount ?? 0))}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                    p.status === 'COMPLETED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                    p.status === 'PENDING' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                    p.status === 'FAILED' ? 'bg-red-100 text-red-700' :
                                    'bg-muted text-muted-foreground'
                                  }`}>
                                    {p.status ?? 'UNKNOWN'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                                  {(p.reference ?? p.mpesaCode ?? p.id ?? '-').toString().slice(0, 16)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10">
                        <svg className="w-10 h-10 text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        <p className="text-sm text-muted-foreground">No payout history found</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ==================== REVIEWS TAB ==================== */}
          {activeTab === 'reviews' && (
            <div className="bg-card rounded-xl border border-border">
              {reviews.length > 0 ? (
                <div className="divide-y divide-border">
                  {reviews.map(review => (
                    <div key={review.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center text-xs font-bold">
                            {getInitials(review.reviewer?.firstName, review.reviewer?.lastName)}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{review.reviewer?.firstName} {review.reviewer?.lastName}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</p>
                          </div>
                        </div>
                        <RatingStars rating={Number(review.rating)} size="sm" />
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground mt-2 ml-12">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="w-12 h-12 text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                  <p className="text-sm text-muted-foreground">No reviews yet</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== EDIT TRAINER MODAL ==================== */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Trainer Profile" size="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Bio</label>
            <textarea value={editForm.bio} onChange={e => setEditForm({ ...editForm, bio: e.target.value })} rows={3} placeholder="Trainer bio..." className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Specialization</label>
              <input value={editForm.specialization} onChange={e => setEditForm({ ...editForm, specialization: e.target.value })} placeholder="e.g. Fitness" className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Hourly Rate (KES)</label>
              <input type="number" min="0" value={editForm.hourlyRate} onChange={e => setEditForm({ ...editForm, hourlyRate: e.target.value })} placeholder="0" className={ic} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Experience (years)</label>
              <input type="number" min="0" value={editForm.experience} onChange={e => setEditForm({ ...editForm, experience: e.target.value })} placeholder="0" className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Location</label>
              <input value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} placeholder="e.g. Nairobi CBD" className={ic} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">County</label>
              <select value={editForm.county} onChange={e => setEditForm({ ...editForm, county: e.target.value })} className={ic}>
                <option value="">Select County</option>
                {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Languages (comma separated)</label>
              <input value={editForm.languages} onChange={e => setEditForm({ ...editForm, languages: e.target.value })} placeholder="English, Swahili" className={ic} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Session Types</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editForm.availableForOnline} onChange={e => setEditForm({ ...editForm, availableForOnline: e.target.checked })} className="rounded border-border" />
                Virtual
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editForm.availableForPhysical} onChange={e => setEditForm({ ...editForm, availableForPhysical: e.target.checked })} className="rounded border-border" />
                Physical
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editForm.availableForHybrid} onChange={e => setEditForm({ ...editForm, availableForHybrid: e.target.checked })} className="rounded border-border" />
                Hybrid
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Portfolio URL</label>
              <input value={editForm.portfolioUrl} onChange={e => setEditForm({ ...editForm, portfolioUrl: e.target.value })} placeholder="https://..." className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">LinkedIn URL</label>
              <input value={editForm.linkedinUrl} onChange={e => setEditForm({ ...editForm, linkedinUrl: e.target.value })} placeholder="https://..." className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Website URL</label>
              <input value={editForm.websiteUrl} onChange={e => setEditForm({ ...editForm, websiteUrl: e.target.value })} placeholder="https://..." className={ic} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={actionLoading} className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors">
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== VERIFY TRAINER MODAL ==================== */}
      <Modal isOpen={verifyOpen} onClose={() => setVerifyOpen(false)} title="Verify Trainer" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-sm font-bold">
              {getInitials(user?.firstName, user?.lastName)}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">Current: <StatusBadge status={trainer.verificationStatus} /></p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Action</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setVerifyForm({ ...verifyForm, action: 'approve' })}
                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  verifyForm.action === 'approve'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => setVerifyForm({ ...verifyForm, action: 'reject' })}
                className={`flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                  verifyForm.action === 'reject'
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : 'border-border text-muted-foreground hover:bg-muted/50'
                }`}
              >
                Reject
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Notes {verifyForm.action === 'reject' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={verifyForm.notes}
              onChange={e => setVerifyForm({ ...verifyForm, notes: e.target.value })}
              rows={3}
              placeholder={verifyForm.action === 'approve' ? 'Optional notes...' : 'Reason for rejection (required)'}
              className={ic}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => setVerifyOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={handleVerify}
              disabled={actionLoading || (verifyForm.action === 'reject' && !verifyForm.notes)}
              className={`px-5 py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors ${
                verifyForm.action === 'approve' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
              }`}
            >
              {actionLoading ? 'Processing...' : verifyForm.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== FUND WALLET MODAL ==================== */}
      <Modal isOpen={fundOpen} onClose={() => setFundOpen(false)} title="Fund Trainer Wallet" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-sm font-bold">
              {getInitials(user?.firstName, user?.lastName)}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Amount (KES) *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">KES</span>
              <input
                type="number"
                min="1"
                value={fundForm.amount || ''}
                onChange={e => setFundForm({ ...fundForm, amount: Number(e.target.value) })}
                placeholder="0"
                className={`${ic} pl-12 text-lg font-semibold`}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input
              value={fundForm.description}
              onChange={e => setFundForm({ ...fundForm, description: e.target.value })}
              placeholder="Reason for funding (optional)"
              className={ic}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => setFundOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={handleFund}
              disabled={actionLoading || fundForm.amount <= 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              {actionLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  Funding...
                </>
              ) : 'Fund Wallet'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== SUSPEND/ACTIVATE CONFIRMATION ==================== */}
      <ConfirmDialog
        isOpen={suspendDialog}
        onClose={() => setSuspendDialog(false)}
        onConfirm={handleSuspendActivate}
        title={user?.status === 'SUSPENDED' ? 'Activate Trainer' : 'Suspend Trainer'}
        message={
          user?.status === 'SUSPENDED'
            ? `Are you sure you want to activate ${user?.firstName} ${user?.lastName}? They will be able to accept bookings again.`
            : `Are you sure you want to suspend ${user?.firstName} ${user?.lastName}? They will not be able to accept new bookings while suspended.`
        }
        confirmLabel={user?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
        confirmVariant={user?.status === 'SUSPENDED' ? 'primary' : 'danger'}
        loading={actionLoading}
      />

      {/* ==================== DELETE CONFIRMATION ==================== */}
      <ConfirmDialog
        isOpen={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Trainer"
        message={`Are you sure you want to delete ${user?.firstName} ${user?.lastName}? This action cannot be undone. All associated data (bookings, reviews, wallet, etc.) will be permanently removed.`}
        confirmLabel="Delete Trainer"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
