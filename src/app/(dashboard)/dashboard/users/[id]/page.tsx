'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { RatingStars } from '@/components/RatingStars';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { userService } from '@/lib/services/userService';
import { trainerService } from '@/lib/services/trainerService';
import { walletService } from '@/lib/services/walletService';
import { bookingService } from '@/lib/services/bookingService';
import { reviewService } from '@/lib/services/reviewService';
import { profileAdminService, JobSeekerProfile } from '@/lib/services/profileAdminService';
import { applicationAdminService, AdminApplication } from '@/lib/services/applicationAdminService';
import { User, Trainer, Wallet, Transaction, Booking, Review } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, formatDateTime, formatRelative, getInitials } from '@/lib/utils';

const ROLE_BADGE: Record<string, string> = {
  CLIENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  TRAINER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  FINANCE_ADMIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  SUPPORT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [trainer, setTrainer] = useState<Trainer | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings' | 'wallet' | 'reviews' | 'recruitment'>('overview');
  const [jobSeekerProfile, setJobSeekerProfile] = useState<JobSeekerProfile | null>(null);
  const [userApplications, setUserApplications] = useState<AdminApplication[]>([]);

  // Modals
  const [editOpen, setEditOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);
  const [suspendDialog, setSuspendDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit form
  const [editForm, setEditForm] = useState({
    firstName: '', lastName: '', phone: '', role: '', status: '',
  });

  // Fund form
  const [fundForm, setFundForm] = useState({ amount: 0, description: '' });

  const ic = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';

  const fetchUser = useCallback(async () => {
    try {
      const data = await userService.getById(params.id as string);
      setUser(data);
    } catch {
      addToast('error', 'Failed to load user');
      router.push('/dashboard/users');
    } finally {
      setLoading(false);
    }
  }, [params.id, addToast, router]);

  const fetchTrainerProfile = useCallback(async () => {
    if (!user || user.role !== 'TRAINER') return;
    try {
      // The trainer list endpoint with search should find the trainer by userId
      const result = await trainerService.getAll({ search: user.email, limit: 1 });
      if (result.items.length > 0) {
        setTrainer(result.items[0]);
      }
    } catch { /* trainer profile not found */ }
  }, [user]);

  const fetchWallet = useCallback(async () => {
    if (!user) return;
    try {
      const w = await walletService.getByUser(user.id);
      setWallet(w);
    } catch { /* no wallet */ }
  }, [user]);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    try {
      const filterKey = user.role === 'TRAINER' ? 'trainerId' : 'clientId';
      const d = await bookingService.getAll({ [filterKey]: user.id, limit: 20 });
      setBookings(d.items);
    } catch { /* ignore */ }
  }, [user]);

  const fetchReviews = useCallback(async () => {
    if (!user) return;
    try {
      if (user.role === 'TRAINER') {
        const d = await reviewService.getAll({ trainerId: user.id, limit: 20 });
        setReviews(d.items);
      }
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const fetchJobSeekerProfile = useCallback(async () => {
    if (!user) return;
    const profile = await profileAdminService.get(user.id);
    setJobSeekerProfile(profile);
  }, [user]);

  const fetchUserApplications = useCallback(async () => {
    if (!user) return;
    try {
      const result = await applicationAdminService.list({ userId: user.id, limit: 20 });
      setUserApplications((result as any).items ?? []);
    } catch { /* ignore */ }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchTrainerProfile();
      fetchWallet();
      fetchBookings();
      fetchReviews();
      fetchJobSeekerProfile();
      fetchUserApplications();
    }
  }, [user, fetchTrainerProfile, fetchWallet, fetchBookings, fetchReviews, fetchJobSeekerProfile, fetchUserApplications]);

  // Edit handler
  const openEdit = () => {
    if (!user) return;
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      role: user.role,
      status: user.status,
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      await userService.update(user.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone || undefined,
        role: editForm.role,
        status: editForm.status,
      });
      addToast('success', 'User updated');
      setEditOpen(false);
      fetchUser();
    } catch {
      addToast('error', 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  // Suspend/Activate handler
  const handleSuspendActivate = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      if (user.status === 'SUSPENDED') {
        await userService.activate(user.id);
        addToast('success', `${user.firstName} activated`);
      } else {
        await userService.suspend(user.id);
        addToast('success', `${user.firstName} suspended`);
      }
      setSuspendDialog(false);
      fetchUser();
    } catch {
      addToast('error', 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  // Fund wallet handler
  const handleFund = async () => {
    if (!user || fundForm.amount <= 0) { addToast('error', 'Enter a valid amount'); return; }
    setActionLoading(true);
    try {
      await walletService.adminFund(user.id, Number(fundForm.amount), fundForm.description);
      addToast('success', `Funded wallet with KES ${Number(fundForm.amount).toLocaleString()}`);
      setFundOpen(false);
      setFundForm({ amount: 0, description: '' });
      fetchWallet();
    } catch {
      addToast('error', 'Failed to fund wallet');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!user) return;
    setActionLoading(true);
    try {
      await userService.delete(user.id);
      addToast('success', 'User deleted');
      router.push('/dashboard/users');
    } catch {
      addToast('error', 'Failed to delete user');
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

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title="User Details"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Users', href: '/dashboard/users' },
          { label: `${user.firstName} ${user.lastName}` },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={openEdit} className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors">
              Edit
            </button>
            <button
              onClick={() => setSuspendDialog(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                user.status === 'SUSPENDED'
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {user.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
            </button>
            <button
              onClick={() => { setFundForm({ amount: 0, description: '' }); setFundOpen(true); }}
              className="px-4 py-2 rounded-lg 0 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
            >
              Fund Wallet
            </button>
            <button onClick={() => setDeleteDialog(true)} className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 text-sm font-medium hover:bg-red-500/20 transition-colors">
              Delete
            </button>
            <button onClick={() => router.push('/dashboard/users')} className="px-4 py-2 rounded-lg border border-border bg-card text-sm hover:bg-muted transition-colors">
              Back
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ==================== PROFILE CARD ==================== */}
        <div className="space-y-6">
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full mx-auto mb-4 object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                {getInitials(user.firstName, user.lastName)}
              </div>
            )}
            <h2 className="text-lg font-semibold">{user.firstName} {user.lastName}</h2>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            {user.phone && <p className="text-sm text-muted-foreground">{user.phone}</p>}

            <div className="flex justify-center gap-2 mt-3">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[user.role] || 'bg-gray-100 text-gray-700'}`}>
                {user.role.replace(/_/g, ' ')}
              </span>
              <StatusBadge status={user.status} />
            </div>

            {/* Trainer Verification Badge */}
            {user.role === 'TRAINER' && trainer && (
              <div className="mt-2">
                <StatusBadge status={trainer.verificationStatus} />
              </div>
            )}

            {/* Trainer Rating */}
            {user.role === 'TRAINER' && trainer && (
              <div className="mt-3 flex justify-center">
                <RatingStars rating={Number(trainer.averageRating || 0)} />
                <span className="ml-1 text-xs text-muted-foreground">({trainer.totalReviews} reviews)</span>
              </div>
            )}

            <div className="mt-4 space-y-2 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Joined</span>
                <span className="font-medium">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="font-medium">{formatRelative(user.updatedAt)}</span>
              </div>
              {user.role === 'TRAINER' && trainer && (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Rate</span>
                    <span className="font-medium">{formatCurrency(Number(trainer.hourlyRate))}/hr</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Experience</span>
                    <span className="font-medium">{trainer.experience} years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Specialization</span>
                    <span className="font-medium text-right max-w-[60%] truncate">{trainer.specialization || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Location</span>
                    <span className="font-medium text-right max-w-[60%] truncate">{trainer.location || trainer.county || '-'}</span>
                  </div>
                  {trainer.completedSessions !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sessions</span>
                      <span className="font-medium">{trainer.completedSessions} completed</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Wallet Card */}
          {wallet && (
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">Wallet</h3>
                <button
                  onClick={() => { setFundForm({ amount: 0, description: '' }); setFundOpen(true); }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors font-medium"
                >
                  Fund
                </button>
              </div>
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-primary-500/5 border border-primary-500/20">
                  <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                  <p className="text-2xl font-bold text-primary-500">{formatCurrency(Number(wallet.balance))}</p>
                </div>
                {Number(wallet.holdBalance) > 0 && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-muted-foreground mb-1">On Hold</p>
                    <p className="text-lg font-semibold text-amber-600">{formatCurrency(Number(wallet.holdBalance))}</p>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{wallet.currency || 'KES'}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ==================== MAIN CONTENT ==================== */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Navigation */}
          <div className="flex border-b border-border flex-wrap">
            {(['overview', 'bookings', 'wallet', 'reviews', 'recruitment'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-muted-foreground hover:text-card-foreground'
                }`}
              >
                {tab === 'recruitment' ? 'Recruitment' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'bookings' && bookings.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{bookings.length}</span>
                )}
                {tab === 'reviews' && reviews.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{reviews.length}</span>
                )}
                {tab === 'recruitment' && userApplications.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">{userApplications.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* ==================== OVERVIEW TAB ==================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* User Information */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">User Information</h3>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {[
                    ['First Name', user.firstName],
                    ['Last Name', user.lastName],
                    ['Email', user.email],
                    ['Phone', user.phone || '-'],
                    ['Role', user.role.replace(/_/g, ' ')],
                    ['Status', user.status],
                    ['Joined', formatDateTime(user.createdAt)],
                    ['Updated', formatDateTime(user.updatedAt)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium mt-0.5">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Trainer Profile Section (only for trainers) */}
              {user.role === 'TRAINER' && trainer && (
                <>
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
                    ) : (
                      <p className="text-sm text-muted-foreground">No skills listed</p>
                    )}
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
                    ) : (
                      <p className="text-sm text-muted-foreground">No certifications</p>
                    )}
                  </div>

                  {/* Session Availability */}
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold mb-3">Availability</h3>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {trainer.availableForOnline && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500">Virtual</span>
                      )}
                      {trainer.availableForPhysical && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500">Physical</span>
                      )}
                      {trainer.availableForHybrid && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500">Hybrid</span>
                      )}
                      {!trainer.availableForOnline && !trainer.availableForPhysical && !trainer.availableForHybrid && (
                        <p className="text-sm text-muted-foreground">No session types set</p>
                      )}
                    </div>
                    {trainer.languages && trainer.languages.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Languages</p>
                        <div className="flex flex-wrap gap-1">
                          {trainer.languages.map(lang => (
                            <span key={lang} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{lang}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Quick Stats for Clients */}
              {user.role === 'CLIENT' && (
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold mb-4">Activity Summary</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-card-foreground">{bookings.length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Bookings</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-green-600">{bookings.filter(b => b.status === 'COMPLETED').length}</p>
                      <p className="text-xs text-muted-foreground mt-1">Completed</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-2xl font-bold text-primary-500">{wallet ? formatCurrency(Number(wallet.balance)) : '-'}</p>
                      <p className="text-xs text-muted-foreground mt-1">Wallet Balance</p>
                    </div>
                  </div>
                </div>
              )}
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
                            {user.role === 'CLIENT'
                              ? getInitials(
                                  (booking.trainer as any)?.user?.firstName || (booking.trainer as any)?.firstName,
                                  (booking.trainer as any)?.user?.lastName || (booking.trainer as any)?.lastName
                                )
                              : getInitials(booking.client?.firstName, booking.client?.lastName)
                            }
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {user.role === 'CLIENT'
                                ? `${(booking.trainer as any)?.user?.firstName || (booking.trainer as any)?.firstName || ''} ${(booking.trainer as any)?.user?.lastName || (booking.trainer as any)?.lastName || ''}`
                                : `${booking.client?.firstName} ${booking.client?.lastName}`
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateTime(booking.scheduledAt)} - {booking.duration}min - {(booking.sessionType || '').replace(/_/g, ' ')}
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
                  <svg className="w-12 h-12 text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-muted-foreground">No bookings found</p>
                </div>
              )}
            </div>
          )}

          {/* ==================== WALLET TAB ==================== */}
          {activeTab === 'wallet' && (
            <div className="space-y-6">
              {wallet ? (
                <>
                  {/* Wallet Overview */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground">Available Balance</p>
                      <p className="text-2xl font-bold text-primary-500 mt-1">{formatCurrency(Number(wallet.balance))}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground">On Hold</p>
                      <p className="text-2xl font-bold text-amber-500 mt-1">{formatCurrency(Number(wallet.holdBalance))}</p>
                    </div>
                    <div className="bg-card rounded-xl border border-border p-5">
                      <p className="text-sm text-muted-foreground">Currency</p>
                      <p className="text-2xl font-bold mt-1">{wallet.currency || 'KES'}</p>
                    </div>
                  </div>

                  {/* Fund Action */}
                  <div className="bg-card rounded-xl border border-border p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Wallet Actions</h3>
                        <p className="text-sm text-muted-foreground mt-1">Admin wallet operations for this user</p>
                      </div>
                      <button
                        onClick={() => { setFundForm({ amount: 0, description: '' }); setFundOpen(true); }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" />
                        </svg>
                        Fund Wallet
                      </button>
                    </div>
                  </div>

                  {/* Wallet Details */}
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold mb-4">Wallet Details</h3>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Wallet ID</dt>
                        <dd className="font-mono text-xs">{wallet.id}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Created</dt>
                        <dd>{formatDateTime(wallet.createdAt)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Last Updated</dt>
                        <dd>{formatDateTime(wallet.updatedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                </>
              ) : (
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex flex-col items-center justify-center py-8">
                    <svg className="w-12 h-12 text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <p className="text-sm text-muted-foreground mb-3">No wallet found for this user</p>
                    <button
                      onClick={() => { setFundForm({ amount: 0, description: '' }); setFundOpen(true); }}
                      className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
                    >
                      Create & Fund Wallet
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================== RECRUITMENT TAB ==================== */}
          {activeTab === 'recruitment' && (
            <div className="space-y-6">
              {/* Job Seeker Profile */}
              {jobSeekerProfile ? (
                <>
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-semibold mb-4">Job Seeker Profile</h3>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <dt className="text-muted-foreground">Headline</dt>
                        <dd className="font-medium mt-0.5">{jobSeekerProfile.headline || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Location</dt>
                        <dd className="font-medium mt-0.5">{jobSeekerProfile.location || '-'}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Open to Work</dt>
                        <dd className="mt-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${jobSeekerProfile.openToWork ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                            {jobSeekerProfile.openToWork ? 'Yes' : 'No'}
                          </span>
                        </dd>
                      </div>
                      {jobSeekerProfile.linkedinUrl && (
                        <div>
                          <dt className="text-muted-foreground">LinkedIn</dt>
                          <dd className="mt-0.5">
                            <a href={jobSeekerProfile.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline text-sm truncate block">{jobSeekerProfile.linkedinUrl}</a>
                          </dd>
                        </div>
                      )}
                    </dl>
                    {jobSeekerProfile.bio && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <dt className="text-muted-foreground text-sm mb-1">Bio</dt>
                        <p className="text-sm text-card-foreground whitespace-pre-line">{jobSeekerProfile.bio}</p>
                      </div>
                    )}
                  </div>

                  {/* Skills */}
                  {jobSeekerProfile.skills && jobSeekerProfile.skills.length > 0 && (
                    <div className="bg-card rounded-xl border border-border p-6">
                      <h3 className="font-semibold mb-3">Skills</h3>
                      <div className="flex flex-wrap gap-2">
                        {jobSeekerProfile.skills.map((skill, i) => (
                          <span key={i} className="text-xs font-medium px-3 py-1.5 rounded-full bg-primary-500/10 text-primary-500">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Work Experience */}
                  {jobSeekerProfile.workExperiences && jobSeekerProfile.workExperiences.length > 0 && (
                    <div className="bg-card rounded-xl border border-border p-6">
                      <h3 className="font-semibold mb-4">Work Experience</h3>
                      <div className="space-y-4">
                        {jobSeekerProfile.workExperiences.map((exp) => (
                          <div key={exp.id} className="flex gap-4">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{exp.title}</p>
                              <p className="text-sm text-muted-foreground">{exp.company}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {exp.startDate ? formatDate(exp.startDate) : ''}{exp.endDate ? ` — ${formatDate(exp.endDate)}` : exp.current ? ' — Present' : ''}
                              </p>
                              {exp.description && <p className="text-xs text-muted-foreground mt-1">{exp.description}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {jobSeekerProfile.educations && jobSeekerProfile.educations.length > 0 && (
                    <div className="bg-card rounded-xl border border-border p-6">
                      <h3 className="font-semibold mb-4">Education</h3>
                      <div className="space-y-4">
                        {jobSeekerProfile.educations.map((edu) => (
                          <div key={edu.id} className="flex gap-4">
                            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{edu.degree} {edu.field ? `in ${edu.field}` : ''}</p>
                              <p className="text-sm text-muted-foreground">{edu.institution}</p>
                              {(edu.startYear || edu.endYear) && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {edu.startYear}{edu.endYear ? ` — ${edu.endYear}` : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex flex-col items-center justify-center py-8">
                    <svg className="w-12 h-12 text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-sm text-muted-foreground">No job seeker profile found for this user</p>
                  </div>
                </div>
              )}

              {/* Applications */}
              <div className="bg-card rounded-xl border border-border">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="font-semibold">Applications</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{userApplications.length} total applications</p>
                </div>
                {userApplications.length > 0 ? (
                  <div className="divide-y divide-border">
                    {userApplications.map(app => (
                      <div key={app.id} className="px-6 py-4 flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-card-foreground truncate">{app.job?.title}</p>
                          <p className="text-xs text-muted-foreground">{app.job?.company?.name} &middot; Applied {formatDate(app.appliedAt)}</p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          app.status === 'HIRED' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          app.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          app.status === 'SHORTLISTED' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {app.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <svg className="w-12 h-12 text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-muted-foreground">No applications found</p>
                  </div>
                )}
              </div>
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
                        <div className="flex items-center gap-2">
                          <RatingStars rating={Number(review.rating)} size="sm" />
                          {!review.isVisible && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">Hidden</span>
                          )}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground mt-2 ml-12">{review.comment}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg className="w-12 h-12 text-muted-foreground/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <p className="text-sm text-muted-foreground">
                    {user.role === 'TRAINER' ? 'No reviews yet' : 'Reviews are only shown for trainers'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================== EDIT USER MODAL ==================== */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit User" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">First Name</label>
              <input value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className={ic} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Last Name</label>
              <input value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className={ic} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Email</label>
            <input type="email" value={user.email} disabled className={`${ic} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone</label>
            <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="+254..." className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Role</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={ic}>
                {['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT', 'CLIENT', 'TRAINER'].map(r => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={ic}>
                {['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
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

      {/* ==================== FUND WALLET MODAL ==================== */}
      <Modal isOpen={fundOpen} onClose={() => setFundOpen(false)} title="Fund Wallet" size="sm">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-sm font-bold">
              {getInitials(user.firstName, user.lastName)}
            </div>
            <div>
              <p className="text-sm font-medium">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          {wallet && (
            <div className="p-3 rounded-lg bg-primary-500/5 border border-primary-500/20">
              <p className="text-xs text-muted-foreground">Current Balance</p>
              <p className="text-lg font-semibold text-primary-500">{formatCurrency(Number(wallet.balance))}</p>
            </div>
          )}
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
        title={user.status === 'SUSPENDED' ? 'Activate User' : 'Suspend User'}
        message={
          user.status === 'SUSPENDED'
            ? `Are you sure you want to activate ${user.firstName} ${user.lastName}? They will be able to access the platform again.`
            : `Are you sure you want to suspend ${user.firstName} ${user.lastName}? They will not be able to access the platform while suspended.`
        }
        confirmLabel={user.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
        confirmVariant={user.status === 'SUSPENDED' ? 'primary' : 'danger'}
        loading={actionLoading}
      />

      {/* ==================== DELETE CONFIRMATION ==================== */}
      <ConfirmDialog
        isOpen={deleteDialog}
        onClose={() => setDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone. All associated data (bookings, wallet, reviews, etc.) will be permanently removed.`}
        confirmLabel="Delete User"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
