'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatsCard } from '@/components/StatsCard';
import { StatusBadge } from '@/components/StatusBadge';
import { RatingStars } from '@/components/RatingStars';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { trainerService } from '@/lib/services/trainerService';
import { userService } from '@/lib/services/userService';
import { walletService } from '@/lib/services/walletService';
import api, { unwrap } from '@/lib/api';
import { Trainer } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatDate, getInitials } from '@/lib/utils';

const KENYAN_COUNTIES = [
  'Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay',
  'Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii',
  'Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit',
  'Meru','Migori','Mombasa','Murang\'a','Nairobi','Nakuru','Nandi','Narok','Nyamira',
  'Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi',
  'Trans-Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot',
];

interface CreateTrainerForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  specialization: string;
  hourlyRate: string;
  experience: string;
  location: string;
  county: string;
  trainerType: string;
  trainerMode: 'independent' | 'firm' | 'inhouse';
  firmTrainerId: string;
  departmentId: string;
  teamRole: string;
}

const INITIAL_CREATE_FORM: CreateTrainerForm = {
  firstName: '', lastName: '', email: '', phone: '', password: '',
  specialization: '', hourlyRate: '', experience: '', location: '', county: '',
  trainerType: 'PROFESSIONAL', trainerMode: 'independent', firmTrainerId: '',
  departmentId: '', teamRole: 'CONSULTANT',
};

interface EditTrainerForm {
  bio: string;
  specialization: string;
  hourlyRate: string;
  experience: string;
  location: string;
  county: string;
  availableForOnline: boolean;
  availableForPhysical: boolean;
  availableForHybrid: boolean;
}

interface VerifyForm {
  action: 'approve' | 'reject';
  notes: string;
}

export default function TrainersPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // List state
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countyFilter, setCountyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [tierFilter, setTierFilter] = useState('');

  // Stats
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, avgRating: 0 });

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTrainer, setEditTrainer] = useState<Trainer | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyTrainer, setVerifyTrainer] = useState<Trainer | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundTrainer, setFundTrainer] = useState<Trainer | null>(null);
  const [suspendDialog, setSuspendDialog] = useState<{ open: boolean; trainer: Trainer | null }>({ open: false, trainer: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Trainer firms for org dropdown
  const [trainerFirms, setTrainerFirms] = useState<Trainer[]>([]);
  const [firmsLoading, setFirmsLoading] = useState(false);
  const [trainerSearch, setTrainerSearch] = useState('');

  // Departments for selected org
  const [orgDepartments, setOrgDepartments] = useState<{ id: string; name: string }[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  // Skills and credentials for create form
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [credentials, setCredentials] = useState<{ type: string; name: string; issuer: string; year: string; documentUrl: string; uploading: boolean }[]>([]);

  // Forms
  const [createForm, setCreateForm] = useState<CreateTrainerForm>({ ...INITIAL_CREATE_FORM });
  const [editForm, setEditForm] = useState<EditTrainerForm>({
    bio: '', specialization: '', hourlyRate: '', experience: '', location: '', county: '',
    availableForOnline: false, availableForPhysical: false, availableForHybrid: false,
  });
  const [verifyForm, setVerifyForm] = useState<VerifyForm>({ action: 'approve', notes: '' });
  const [fundForm, setFundForm] = useState({ amount: 0, description: '' });

  // Fetch trainers list
  const fetchTrainers = useCallback(async () => {
    setLoading(true);
    try {
      const filters: Record<string, any> = {
        page, limit: 10, search,
        verificationStatus: statusFilter,
        county: countyFilter,
      };
      if (typeFilter) filters.trainerType = typeFilter;
      if (tierFilter) filters.tier = tierFilter;
      const d = await trainerService.getAll(filters);
      setTrainers(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch {
      addToast('error', 'Failed to load trainers');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, countyFilter, typeFilter, tierFilter, addToast]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    const s = await trainerService.getStats();
    setStats(s);
  }, []);

  useEffect(() => { fetchTrainers(); }, [fetchTrainers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Load trainer firms when create modal opens
  useEffect(() => {
    if (createOpen) {
      setFirmsLoading(true);
      trainerService.getAll({ limit: 100 })
        .then(result => setTrainerFirms(result.items || []))
        .catch(() => setTrainerFirms([]))
        .finally(() => setFirmsLoading(false));
    }
  }, [createOpen]);

  // Load departments when a firm is selected
  useEffect(() => {
    if (!createForm.firmTrainerId) { setOrgDepartments([]); return; }
    setDeptsLoading(true);
    api.get(`/departments?firmId=${createForm.firmTrainerId}`)
      .then((res: any) => {
        const data = unwrap(res);
        const items = Array.isArray(data) ? data : (data as any)?.items ?? [];
        setOrgDepartments(items);
      })
      .catch(() => setOrgDepartments([]))
      .finally(() => setDeptsLoading(false));
  }, [createForm.firmTrainerId]);

  // Create trainer
  const handleCreate = async () => {
    if (!createForm.firstName || !createForm.email || !createForm.password) {
      addToast('error', 'Fill all required fields (first name, email, password)');
      return;
    }
    setActionLoading(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        email: createForm.email,
        phone: createForm.phone || undefined,
        password: createForm.password,
        role: 'TRAINER',
        trainerType: createForm.trainerType || 'PROFESSIONAL',
        specialization: createForm.specialization || undefined,
        hourlyRate: createForm.hourlyRate ? Number(createForm.hourlyRate) : undefined,
        experience: createForm.experience ? Number(createForm.experience) : undefined,
        location: createForm.location || undefined,
        county: createForm.county || undefined,
      };

      // Org assignment
      if (createForm.trainerMode === 'firm' && createForm.firmTrainerId) {
        payload.firmId = createForm.firmTrainerId;
        payload.departmentId = createForm.departmentId || undefined;
        payload.teamRole = createForm.teamRole || 'CONSULTANT';
      } else if (createForm.trainerMode === 'inhouse') {
        payload.isInHouse = true;
      }

      // Skills and credentials
      if (skills.length > 0 || credentials.length > 0) {
        payload.skills = skills;
        payload.credentials = credentials.filter(c => c.name.trim());
      }

      const res = await api.post('/auth/register', payload);
      unwrap(res);
      addToast('success', 'Trainer created successfully');
      setCreateOpen(false);
      setCreateForm({ ...INITIAL_CREATE_FORM });
      setSkills([]);
      setSkillInput('');
      setCredentials([]);
      setPage(1);
      setSearch('');
      setStatusFilter('');
      fetchStats();
    } catch (err: any) {
      const errData = err?.response?.data?.error || err?.response?.data;
      const details = errData?.details;
      const message = Array.isArray(details) ? details.join(', ') : errData?.message || err?.response?.data?.message || 'Failed to create trainer';
      addToast('error', typeof message === 'string' ? message : 'Failed to create trainer');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit trainer
  const handleEdit = async () => {
    if (!editTrainer) return;
    setActionLoading(true);
    try {
      await trainerService.update(editTrainer.id, {
        bio: editForm.bio || undefined,
        specialization: editForm.specialization || undefined,
        hourlyRate: editForm.hourlyRate ? Number(editForm.hourlyRate) : undefined,
        experience: editForm.experience ? Number(editForm.experience) : undefined,
        location: editForm.location || undefined,
        county: editForm.county || undefined,
        availableForOnline: editForm.availableForOnline,
        availableForPhysical: editForm.availableForPhysical,
        availableForHybrid: editForm.availableForHybrid,
      });
      addToast('success', 'Trainer updated');
      setEditOpen(false);
      setEditTrainer(null);
      fetchTrainers();
    } catch {
      addToast('error', 'Failed to update trainer');
    } finally {
      setActionLoading(false);
    }
  };

  // Verify trainer
  const handleVerify = async () => {
    if (!verifyTrainer) return;
    setActionLoading(true);
    try {
      if (verifyForm.action === 'approve') {
        await trainerService.approve(verifyTrainer.id, verifyForm.notes);
        addToast('success', 'Trainer approved');
      } else {
        if (!verifyForm.notes) { addToast('error', 'Notes are required for rejection'); setActionLoading(false); return; }
        await trainerService.reject(verifyTrainer.id, verifyForm.notes);
        addToast('success', 'Trainer rejected');
      }
      setVerifyOpen(false);
      setVerifyTrainer(null);
      setVerifyForm({ action: 'approve', notes: '' });
      fetchTrainers();
      fetchStats();
    } catch {
      addToast('error', 'Failed to update verification');
    } finally {
      setActionLoading(false);
    }
  };

  // Suspend/Activate
  const handleSuspendActivate = async () => {
    const t = suspendDialog.trainer;
    if (!t) return;
    setActionLoading(true);
    try {
      if (t.user?.status === 'SUSPENDED') {
        await userService.activate(t.userId);
        addToast('success', `${t.user?.firstName} activated`);
      } else {
        await userService.suspend(t.userId);
        addToast('success', `${t.user?.firstName} suspended`);
      }
      setSuspendDialog({ open: false, trainer: null });
      fetchTrainers();
    } catch {
      addToast('error', 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  // Fund wallet
  const handleFund = async () => {
    if (!fundTrainer || fundForm.amount <= 0) { addToast('error', 'Enter a valid amount'); return; }
    setActionLoading(true);
    try {
      await walletService.adminFund(fundTrainer.userId, fundForm.amount, fundForm.description);
      addToast('success', `Funded ${fundTrainer.user?.firstName}'s wallet with KES ${fundForm.amount.toLocaleString()}`);
      setFundOpen(false);
      setFundTrainer(null);
      setFundForm({ amount: 0, description: '' });
    } catch {
      addToast('error', 'Failed to fund wallet');
    } finally {
      setActionLoading(false);
    }
  };

  // Open edit modal
  const openEdit = (t: Trainer) => {
    setEditTrainer(t);
    setEditForm({
      bio: t.bio || '',
      specialization: t.specialization || '',
      hourlyRate: String(t.hourlyRate || ''),
      experience: String(t.experience || ''),
      location: t.location || '',
      county: t.county || '',
      availableForOnline: t.availableForOnline || false,
      availableForPhysical: t.availableForPhysical || false,
      availableForHybrid: t.availableForHybrid || false,
    });
    setEditOpen(true);
  };

  // Open verify modal
  const openVerify = (t: Trainer) => {
    setVerifyTrainer(t);
    setVerifyForm({ action: 'approve', notes: '' });
    setVerifyOpen(true);
  };

  // Open fund modal
  const openFund = (t: Trainer) => {
    setFundTrainer(t);
    setFundForm({ amount: 0, description: '' });
    setFundOpen(true);
  };

  const ic = "w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors";

  // Table columns
  const cols: Column<Trainer>[] = [
    {
      key: 'avatar',
      label: '',
      className: 'w-12',
      render: t => (
        <div className="w-9 h-9 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-xs font-bold">
          {getInitials(t.user?.firstName, t.user?.lastName)}
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: t => (
        <div>
          <span className="font-medium text-card-foreground">{t.user?.firstName} {t.user?.lastName}</span>
          <p className="text-xs text-muted-foreground">{t.user?.email}</p>
        </div>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: t => <span className="text-muted-foreground">{t.user?.phone || '-'}</span>,
    },
    {
      key: 'specialization',
      label: 'Specialization',
      render: t => <span className="text-sm">{t.specialization || '-'}</span>,
    },
    {
      key: 'trainerType',
      label: 'Type',
      render: t => {
        const tt = (t as any).trainerType;
        if (!tt) return <span className="text-muted-foreground text-xs">-</span>;
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            tt === 'PROFESSIONAL' ? 'bg-[#192C67]/10 text-[#192C67] dark:bg-[#192C67]/30 dark:text-[#5b8bc7]' :
            tt === 'VOCATIONAL' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
            'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
          }`}>
            {tt === 'PROFESSIONAL' ? 'Professional' : tt === 'VOCATIONAL' ? 'Vocational' : 'Both'}
          </span>
        );
      },
    },
    {
      key: 'tier',
      label: 'Tier',
      render: t => {
        const tier = (t as any).tier;
        if (!tier) return <span className="text-muted-foreground text-xs">-</span>;
        const cfg: Record<string, { label: string; cls: string }> = {
          CERTIFIED: { label: 'Certified', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
          EXPERIENCED: { label: 'Experienced', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
          ENTRY_LEVEL: { label: 'Entry Level', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
        };
        const c = cfg[tier] || cfg.ENTRY_LEVEL;
        return (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${c.cls}`}>
            {c.label}
          </span>
        );
      },
    },
    {
      key: 'hourlyRate',
      label: 'Rate',
      sortable: true,
      render: t => <span className="font-medium">{formatCurrency(Number(t.hourlyRate))}</span>,
    },
    {
      key: 'rating',
      label: 'Rating',
      render: t => <RatingStars rating={Number(t.averageRating || 0)} size="sm" />,
    },
    {
      key: 'verification',
      label: 'Verification',
      render: t => <StatusBadge status={t.verificationStatus} />,
    },
    {
      key: 'status',
      label: 'Account',
      render: t => <StatusBadge status={t.user?.status || 'ACTIVE'} />,
    },
    {
      key: 'actions',
      label: '',
      render: t => (
        <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
          {/* View */}
          <button onClick={() => router.push(`/dashboard/trainers/${t.id}`)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="View">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
          {/* Edit */}
          <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          {/* Verify */}
          {(t.verificationStatus === 'PENDING' || t.verificationStatus === 'UNDER_REVIEW') && (
            <button onClick={() => openVerify(t)} className="p-1.5 rounded-lg hover:bg-muted text-blue-500 hover:text-blue-600 transition-colors" title="Verify">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            </button>
          )}
          {/* Suspend/Activate */}
          <button onClick={() => setSuspendDialog({ open: true, trainer: t })} className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${t.user?.status === 'SUSPENDED' ? 'text-green-500 hover:text-green-600' : 'text-amber-500 hover:text-amber-600'}`} title={t.user?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}>
            {t.user?.status === 'SUSPENDED'
              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            }
          </button>
          {/* Fund Wallet */}
          <button onClick={() => openFund(t)} className="p-1.5 rounded-lg hover:bg-muted text-green-500 hover:text-green-600 transition-colors" title="Fund Wallet">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Trainers"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Trainers' }]}
        actions={
          <button
            onClick={() => { setCreateForm({ ...INITIAL_CREATE_FORM }); setSkills([]); setSkillInput(''); setCredentials([]); setTrainerSearch(''); setNewDeptName(''); setCreateOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Trainer
          </button>
        }
      />

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="Total Trainers"
          value={stats.total}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
        />
        <StatsCard
          label="Verified"
          value={stats.verified}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
          subtitle={stats.total > 0 ? `${Math.round((stats.verified / stats.total) * 100)}% of total` : undefined}
        />
        <StatsCard
          label="Pending Verification"
          value={stats.pending}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
        />
        <StatsCard
          label="Average Rating"
          value={stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '-'}
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search trainers..."
            className={`${ic} w-64 pl-9`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className={`${ic} w-48`}
        >
          <option value="">All Statuses</option>
          {['PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={countyFilter}
          onChange={e => { setCountyFilter(e.target.value); setPage(1); }}
          className={`${ic} w-48`}
        >
          <option value="">All Counties</option>
          {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
          className={`${ic} w-48`}
        >
          <option value="">All Types</option>
          <option value="PROFESSIONAL">Professional</option>
          <option value="VOCATIONAL">Vocational</option>
          <option value="BOTH">Both</option>
        </select>
        <select
          value={tierFilter}
          onChange={e => { setTierFilter(e.target.value); setPage(1); }}
          className={`${ic} w-48`}
        >
          <option value="">All Tiers</option>
          <option value="CERTIFIED">Certified</option>
          <option value="EXPERIENCED">Experienced</option>
          <option value="ENTRY_LEVEL">Entry Level</option>
        </select>
        {(search || statusFilter || countyFilter || typeFilter || tierFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setCountyFilter(''); setTypeFilter(''); setTierFilter(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <DataTable
        columns={cols}
        data={trainers}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={t => t.id}
        onRowClick={t => router.push(`/dashboard/trainers/${t.id}`)}
        emptyMessage="No trainers found"
      />

      {/* ==================== ADD TRAINER MODAL ==================== */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add New Trainer" size="lg">
        <div className="space-y-6">
          {/* Trainer Type: White Collar / Blue Collar */}
          <div>
            <label className="block text-sm font-medium mb-3">Trainer Type</label>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                onClick={() => setCreateForm({ ...createForm, trainerType: 'PROFESSIONAL' })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${createForm.trainerType === 'PROFESSIONAL' ? 'border-blue-500 ' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <span className="text-sm font-semibold">Professional</span>
                <p className="text-xs text-gray-500">Corporate, consulting, coaching</p>
              </button>
              <button type="button"
                onClick={() => setCreateForm({ ...createForm, trainerType: 'VOCATIONAL' })}
                className={`p-3 rounded-xl border-2 text-left transition-all ${createForm.trainerType === 'VOCATIONAL' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <span className="text-sm font-semibold">Vocational</span>
                <p className="text-xs text-gray-500">Trades, crafts, practical skills</p>
              </button>
            </div>
          </div>

          {/* Assignment: Independent / Attach to Org / In-House */}
          <div>
            <label className="block text-sm font-medium mb-3">Assignment</label>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => setCreateForm({ ...createForm, trainerMode: 'independent', firmTrainerId: '' })}
                className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${createForm.trainerMode === 'independent' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
              >Independent</button>
              <button type="button"
                onClick={() => setCreateForm({ ...createForm, trainerMode: 'firm', firmTrainerId: '' })}
                className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${createForm.trainerMode === 'firm' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
              >Attach to Org</button>
              <button type="button"
                onClick={() => setCreateForm({ ...createForm, trainerMode: 'inhouse', firmTrainerId: '' })}
                className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${createForm.trainerMode === 'inhouse' ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
              >In-House (SkillSasa)</button>
            </div>

            {createForm.trainerMode === 'inhouse' && (
              <div className="mt-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                <p className="text-xs text-teal-700 dark:text-teal-300">This trainer will be added as a SkillSasa in-house trainer under the platform&apos;s main office.</p>
              </div>
            )}

            {createForm.trainerMode === 'firm' && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Organization / Firm *</label>
                  <div className="relative">
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      <input
                        type="text"
                        value={trainerSearch}
                        onChange={e => setTrainerSearch(e.target.value)}
                        placeholder="Search organization by name..."
                        className={ic + ' pl-10'}
                      />
                    </div>
                    {createForm.firmTrainerId && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
                        <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                          {(() => { const f = trainerFirms.find(t => (t.user?.id || t.id) === createForm.firmTrainerId) as any; return f?.isOrganization && f?.firmName ? f.firmName : `${f?.user?.firstName || ''} ${f?.user?.lastName || ''}`; })()}
                        </span>
                        <button type="button" onClick={() => setCreateForm({ ...createForm, firmTrainerId: '' })} className="ml-auto text-xs text-red-500 hover:text-red-700">Remove</button>
                      </div>
                    )}
                    {!createForm.firmTrainerId && !firmsLoading && (
                      <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-white dark:bg-gray-800">
                        {trainerFirms.filter(t => {
                          if (!trainerSearch) return true;
                          const name = `${t.user?.firstName || ''} ${t.user?.lastName || ''} ${t.specialization || ''} ${t.location || ''}`.toLowerCase();
                          return name.includes(trainerSearch.toLowerCase());
                        }).map(t => (
                          <button key={t.id} type="button"
                            onClick={() => { setCreateForm({ ...createForm, firmTrainerId: t.user?.id || t.id }); setTrainerSearch(''); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 text-sm border-b border-border last:border-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-xs font-bold text-primary-600">
                              {(t.user?.firstName?.[0] || '')}{(t.user?.lastName?.[0] || '')}
                            </div>
                            <div>
                              <p className="font-medium">{(t as any).isOrganization && (t as any).firmName ? (t as any).firmName : `${t.user?.firstName || ''} ${t.user?.lastName || ''}`}</p>
                              <p className="text-xs text-muted-foreground">{t.specialization || 'Trainer'} {t.location ? `- ${t.location}` : ''} {(t as any).isOrganization ? '[Org]' : '[Individual]'}</p>
                            </div>
                          </button>
                        ))}
                        {trainerFirms.filter(t => { if (!trainerSearch) return true; const n = `${t.user?.firstName||''} ${t.user?.lastName||''} ${t.specialization||''}`.toLowerCase(); return n.includes(trainerSearch.toLowerCase()); }).length === 0 && (
                          <p className="px-3 py-3 text-xs text-muted-foreground">No organizations found</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Team Role</label>
                    <select value={createForm.teamRole} onChange={e => setCreateForm({ ...createForm, teamRole: e.target.value })} className={ic}>
                      <option value="CONSULTANT">Consultant</option>
                      <option value="ASSOCIATE">Associate</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Department</label>
                    {deptsLoading ? (
                      <div className="py-2 text-xs text-muted-foreground">Loading departments...</div>
                    ) : (
                      <>
                        <select value={createForm.departmentId} onChange={e => { setCreateForm({ ...createForm, departmentId: e.target.value }); setNewDeptName(''); }} className={ic}>
                          <option value="">No department</option>
                          {orgDepartments.map(d => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                          <option value="__new__">+ Create new department</option>
                        </select>
                        {createForm.departmentId === '__new__' && (
                          <div className="mt-2 flex gap-2">
                            <input value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="New department name" className={ic + ' flex-1'} />
                            <button type="button" disabled={!newDeptName.trim() || !createForm.firmTrainerId} onClick={async () => {
                              if (!newDeptName.trim() || !createForm.firmTrainerId) return;
                              try {
                                const res = await api.post('/departments', { firmId: createForm.firmTrainerId, name: newDeptName.trim() });
                                const newDept = unwrap(res) as any;
                                setOrgDepartments([...orgDepartments, { id: newDept.id, name: newDept.name }]);
                                setCreateForm({ ...createForm, departmentId: newDept.id });
                                setNewDeptName('');
                              } catch { /* ignore */ }
                            }} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50">Create</button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Personal Details */}
          <div>
            <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs flex items-center justify-center font-bold">1</span>
              Personal Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">First Name *</label>
                <input value={createForm.firstName} onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })} placeholder="John" className={ic} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Last Name *</label>
                <input value={createForm.lastName} onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })} placeholder="Doe" className={ic} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1.5">Email *</label>
              <input type="email" value={createForm.email} onChange={e => setCreateForm({ ...createForm, email: e.target.value })} placeholder="john@example.com" className={ic} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone</label>
                <input value={createForm.phone} onChange={e => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+254 7XX XXX XXX" className={ic} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={createForm.password}
                    onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Min 8 characters"
                    className={ic + ' pr-10'}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw
                      ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Details */}
          <div>
            <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs flex items-center justify-center font-bold">2</span>
              Professional Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Specialization</label>
                <input value={createForm.specialization} onChange={e => setCreateForm({ ...createForm, specialization: e.target.value })} placeholder="e.g. Leadership, Welding" className={ic} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Hourly Rate (KES)</label>
                <input type="number" min="0" value={createForm.hourlyRate} onChange={e => setCreateForm({ ...createForm, hourlyRate: e.target.value })} placeholder="0" className={ic} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Experience (years)</label>
                <input type="number" min="0" value={createForm.experience} onChange={e => setCreateForm({ ...createForm, experience: e.target.value })} placeholder="0" className={ic} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Location</label>
                <input value={createForm.location} onChange={e => setCreateForm({ ...createForm, location: e.target.value })} placeholder="e.g. Nairobi CBD" className={ic} />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-sm font-medium mb-1.5">County</label>
              <select value={createForm.county} onChange={e => setCreateForm({ ...createForm, county: e.target.value })} className={ic}>
                <option value="">Select County</option>
                {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Skills */}
          <div>
            <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs flex items-center justify-center font-bold">3</span>
              Skills
            </h4>
            <div className="flex gap-2 mb-2">
              <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (skillInput.trim() && !skills.includes(skillInput.trim())) { setSkills([...skills, skillInput.trim()]); setSkillInput(''); } } }} placeholder="Type a skill and press Enter" className={ic + ' flex-1'} />
              <button type="button" onClick={() => { if (skillInput.trim() && !skills.includes(skillInput.trim())) { setSkills([...skills, skillInput.trim()]); setSkillInput(''); } }} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs font-medium hover:bg-gray-50 dark:hover:bg-white/10">Add</button>
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-xs font-medium text-primary-700 dark:text-primary-300">
                    {s}
                    <button type="button" onClick={() => setSkills(skills.filter((_, j) => j !== i))} className="text-primary-400 hover:text-red-500">x</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Credentials & Certifications */}
          <div>
            <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs flex items-center justify-center font-bold">4</span>
              Credentials &amp; Certifications
            </h4>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">Attach certifications, licenses, or qualifications.</p>
              <button type="button" onClick={() => setCredentials([...credentials, { type: 'CERTIFICATE', name: '', issuer: '', year: '', documentUrl: '', uploading: false }])} className="text-xs font-medium text-primary-500 hover:text-primary-600">+ Add Credential</button>
            </div>
            {credentials.length === 0 && (
              <p className="text-xs text-gray-400 italic">No credentials added yet.</p>
            )}
            {credentials.map((cred, idx) => (
              <div key={idx} className="mt-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500">Credential #{idx + 1}</span>
                  <button type="button" onClick={() => setCredentials(credentials.filter((_, i) => i !== idx))} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select value={cred.type} onChange={e => { const c = [...credentials]; c[idx].type = e.target.value; setCredentials(c); }} className={ic}>
                    <option value="DEGREE">Degree</option>
                    <option value="DIPLOMA">Diploma</option>
                    <option value="CERTIFICATE">Certificate</option>
                    <option value="LICENSE">License</option>
                    <option value="PROFESSIONAL_MEMBERSHIP">Professional Membership</option>
                    <option value="TRADE_CERTIFICATE">Trade Certificate</option>
                    <option value="APPRENTICESHIP">Apprenticeship</option>
                    <option value="PORTFOLIO">Portfolio</option>
                  </select>
                  <input value={cred.name} onChange={e => { const c = [...credentials]; c[idx].name = e.target.value; setCredentials(c); }} placeholder="Credential name" className={ic} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={cred.issuer} onChange={e => { const c = [...credentials]; c[idx].issuer = e.target.value; setCredentials(c); }} placeholder="Issuing institution" className={ic} />
                  <input value={cred.year} onChange={e => { const c = [...credentials]; c[idx].year = e.target.value; setCredentials(c); }} placeholder="Year obtained" className={ic} />
                </div>
                {cred.documentUrl ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="text-xs text-green-700 dark:text-green-300 truncate flex-1">Document uploaded</span>
                    <button type="button" onClick={() => { const c = [...credentials]; c[idx].documentUrl = ''; setCredentials(c); }} className="text-xs text-red-500">Remove</button>
                  </div>
                ) : (
                  <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${cred.uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {cred.uploading ? (
                      <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    )}
                    <span className="text-xs text-gray-500">{cred.uploading ? 'Uploading...' : 'Upload document (PDF, image)'}</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const c = [...credentials]; c[idx].uploading = true; setCredentials(c);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const res = await api.post('/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                        const url = (res.data as any)?.data?.url || (res.data as any)?.url || '';
                        const c2 = [...credentials]; c2[idx].documentUrl = url; c2[idx].uploading = false; setCredentials(c2);
                      } catch { const c2 = [...credentials]; c2[idx].uploading = false; setCredentials(c2); addToast('error', 'Upload failed'); }
                    }} />
                  </label>
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={actionLoading || !createForm.firstName || !createForm.email || !createForm.password}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                  Creating...
                </>
              ) : 'Create Trainer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== EDIT TRAINER MODAL ==================== */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditTrainer(null); }} title="Edit Trainer" size="lg">
        <div className="space-y-4">
          {editTrainer && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-sm font-bold">
                {getInitials(editTrainer.user?.firstName, editTrainer.user?.lastName)}
              </div>
              <div>
                <p className="text-sm font-medium">{editTrainer.user?.firstName} {editTrainer.user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{editTrainer.user?.email}</p>
              </div>
            </div>
          )}
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
          <div>
            <label className="block text-sm font-medium mb-1.5">County</label>
            <select value={editForm.county} onChange={e => setEditForm({ ...editForm, county: e.target.value })} className={ic}>
              <option value="">Select County</option>
              {KENYAN_COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
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
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => { setEditOpen(false); setEditTrainer(null); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={actionLoading} className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors">
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== VERIFY TRAINER MODAL ==================== */}
      <Modal isOpen={verifyOpen} onClose={() => { setVerifyOpen(false); setVerifyTrainer(null); }} title="Verify Trainer" size="sm">
        <div className="space-y-4">
          {verifyTrainer && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-secondary-500/10 text-secondary-500 flex items-center justify-center text-sm font-bold">
                {getInitials(verifyTrainer.user?.firstName, verifyTrainer.user?.lastName)}
              </div>
              <div>
                <p className="text-sm font-medium">{verifyTrainer.user?.firstName} {verifyTrainer.user?.lastName}</p>
                <p className="text-xs text-muted-foreground">Current: <StatusBadge status={verifyTrainer.verificationStatus} /></p>
              </div>
            </div>
          )}
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
            <button onClick={() => { setVerifyOpen(false); setVerifyTrainer(null); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
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
      <Modal isOpen={fundOpen} onClose={() => { setFundOpen(false); setFundTrainer(null); }} title="Fund Trainer Wallet" size="sm">
        <div className="space-y-4">
          {fundTrainer && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-sm font-bold">
                {getInitials(fundTrainer.user?.firstName, fundTrainer.user?.lastName)}
              </div>
              <div>
                <p className="text-sm font-medium">{fundTrainer.user?.firstName} {fundTrainer.user?.lastName}</p>
                <p className="text-xs text-muted-foreground">{fundTrainer.user?.email}</p>
              </div>
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
            <button onClick={() => { setFundOpen(false); setFundTrainer(null); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
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
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
                  Fund Wallet
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== SUSPEND/ACTIVATE CONFIRMATION ==================== */}
      <ConfirmDialog
        isOpen={suspendDialog.open}
        onClose={() => setSuspendDialog({ open: false, trainer: null })}
        onConfirm={handleSuspendActivate}
        title={suspendDialog.trainer?.user?.status === 'SUSPENDED' ? 'Activate Trainer' : 'Suspend Trainer'}
        message={
          suspendDialog.trainer?.user?.status === 'SUSPENDED'
            ? `Are you sure you want to activate ${suspendDialog.trainer?.user?.firstName} ${suspendDialog.trainer?.user?.lastName}? They will be able to accept bookings again.`
            : `Are you sure you want to suspend ${suspendDialog.trainer?.user?.firstName} ${suspendDialog.trainer?.user?.lastName}? They will not be able to accept new bookings while suspended.`
        }
        confirmLabel={suspendDialog.trainer?.user?.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
        confirmVariant={suspendDialog.trainer?.user?.status === 'SUSPENDED' ? 'primary' : 'danger'}
        loading={actionLoading}
      />
    </div>
  );
}
