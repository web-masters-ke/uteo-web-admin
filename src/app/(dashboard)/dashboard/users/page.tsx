'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { userService } from '@/lib/services/userService';
import { trainerService } from '@/lib/services/trainerService';
import { walletService } from '@/lib/services/walletService';
import api, { unwrap } from '@/lib/api';
import { User, Trainer } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatDate, getInitials } from '@/lib/utils';

// Role badge color mapping
const ROLE_BADGE: Record<string, string> = {
  CLIENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  TRAINER: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  FINANCE_ADMIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  SUPPORT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

interface CreateFormState {
  role: 'CLIENT' | 'TRAINER' | '';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  status: 'ACTIVE' | 'PENDING';
  // Trainer fields
  trainerMode: 'independent' | 'firm' | 'inhouse';
  firmTrainerId: string;
  departmentId: string;
  teamRole: string;
  trainerType: string;
  categoryId: string;
  specialization: string;
  // Client fields
  assignedTrainerId: string;
}

const INITIAL_CREATE_FORM: CreateFormState = {
  role: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  status: 'ACTIVE',
  trainerMode: 'independent',
  firmTrainerId: '',
  departmentId: '',
  teamRole: 'CONSULTANT',
  trainerType: 'PROFESSIONAL',
  categoryId: '',
  specialization: '',
  assignedTrainerId: '',
};

export default function UsersPage() {
  const router = useRouter();
  const { addToast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Trainer firms for dropdown
  const [trainerFirms, setTrainerFirms] = useState<Trainer[]>([]);
  const [firmsLoading, setFirmsLoading] = useState(false);
  const [trainerSearch, setTrainerSearch] = useState('');

  // Credentials for trainer creation
  const [credentials, setCredentials] = useState<{ type: string; name: string; issuer: string; year: string; documentUrl: string; uploading: boolean }[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');

  // Departments for selected org
  const [orgDepartments, setOrgDepartments] = useState<{ id: string; name: string }[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [fundOpen, setFundOpen] = useState(false);
  const [fundUser, setFundUser] = useState<User | null>(null);
  const [delDialog, setDelDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [actionLoading, setActionLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState<CreateFormState>({ ...INITIAL_CREATE_FORM });
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: '', status: '' });
  const [fundForm, setFundForm] = useState({ amount: 0, description: '' });

  // Fetch users list
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const d = await userService.getAll({ page, limit: 10, search, role: roleFilter, status: statusFilter });
      setUsers(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch {
      addToast('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter, statusFilter, addToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Fetch trainer firms when create modal opens with TRAINER role
  const fetchTrainerFirms = useCallback(async () => {
    setFirmsLoading(true);
    try {
      const result = await trainerService.getAll({ limit: 100 });
      setTrainerFirms(result.items || []);
    } catch {
      setTrainerFirms([]);
    } finally {
      setFirmsLoading(false);
    }
  }, []);

  // When opening create modal or switching to TRAINER role, load firms
  useEffect(() => {
    if (createOpen && (createForm.role === 'TRAINER' || createForm.role === 'CLIENT')) {
      fetchTrainerFirms();
    }
  }, [createOpen, createForm.role, fetchTrainerFirms]);

  // When a firm is selected, load its departments
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

  // Create user via POST /auth/register
  const handleCreate = async () => {
    if (!createForm.role) { addToast('error', 'Please select a role'); return; }
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
        role: createForm.role,
      };

      // Trainer assignment
      if (createForm.role === 'TRAINER') {
        payload.trainerType = createForm.trainerType || 'PROFESSIONAL';
        payload.categoryId = createForm.categoryId || undefined;
        payload.specialization = createForm.specialization || undefined;

        if (createForm.trainerMode === 'firm' && createForm.firmTrainerId) {
          payload.firmId = createForm.firmTrainerId;
          payload.departmentId = createForm.departmentId || undefined;
          payload.teamRole = createForm.teamRole || 'CONSULTANT';
        } else if (createForm.trainerMode === 'inhouse') {
          payload.isInHouse = true;
        }
      }

      // Client assignment
      if (createForm.role === 'CLIENT' && createForm.assignedTrainerId) {
        payload.assignedTrainerId = createForm.assignedTrainerId;
      }

      // Skills and credentials (sent separately after user creation)
      if (createForm.role === 'TRAINER' && (skills.length > 0 || credentials.length > 0)) {
        payload.skills = skills;
        payload.credentials = credentials.filter(c => c.name.trim());
      }

      const res = await api.post('/auth/register', payload);
      unwrap(res);

      addToast('success', `${createForm.role === 'TRAINER' ? 'Trainer' : 'Client'} created successfully`);
      setCreateOpen(false);
      setCreateForm({ ...INITIAL_CREATE_FORM });
      fetchUsers();
    } catch (err: any) {
      const errData = err?.response?.data?.error || err?.response?.data;
      const details = errData?.details;
      const message = Array.isArray(details) ? details.join(', ') : errData?.message || err?.response?.data?.message || 'Failed to create user';
      addToast('error', typeof message === 'string' ? message : 'Failed to create user');
    } finally {
      setActionLoading(false);
    }
  };

  // Edit user
  const handleEdit = async () => {
    if (!editUser) return;
    setActionLoading(true);
    try {
      await userService.update(editUser.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone,
        role: editForm.role,
        status: editForm.status,
      });
      addToast('success', 'User updated');
      setEditOpen(false);
      setEditUser(null);
      fetchUsers();
    } catch {
      addToast('error', 'Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete user
  const handleDelete = async () => {
    if (!delDialog.user) return;
    setActionLoading(true);
    try {
      await userService.delete(delDialog.user.id);
      addToast('success', 'User deleted');
      setDelDialog({ open: false, user: null });
      fetchUsers();
    } catch {
      addToast('error', 'Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  // Suspend/Activate toggle
  const handleSuspendActivate = async (user: User) => {
    setActionLoading(true);
    try {
      if (user.status === 'SUSPENDED') {
        await userService.activate(user.id);
        addToast('success', `${user.firstName} activated`);
      } else {
        await userService.suspend(user.id);
        addToast('success', `${user.firstName} suspended`);
      }
      fetchUsers();
    } catch {
      addToast('error', 'Failed to update status');
    } finally {
      setActionLoading(false);
    }
  };

  // Fund wallet
  const handleFund = async () => {
    if (!fundUser || fundForm.amount <= 0) { addToast('error', 'Enter a valid amount'); return; }
    setActionLoading(true);
    try {
      await walletService.adminFund(fundUser.id, fundForm.amount, fundForm.description);
      addToast('success', `Funded ${fundUser.firstName}'s wallet with KES ${fundForm.amount.toLocaleString()}`);
      setFundOpen(false);
      setFundUser(null);
      setFundForm({ amount: 0, description: '' });
    } catch {
      addToast('error', 'Failed to fund wallet');
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone || '', role: u.role, status: u.status });
    setEditOpen(true);
  };

  const openFund = (u: User) => {
    setFundUser(u);
    setFundForm({ amount: 0, description: '' });
    setFundOpen(true);
  };

  const openCreate = () => {
    setCreateForm({ ...INITIAL_CREATE_FORM, role: 'CLIENT' });
    setCreateOpen(true);
  };

  const ic = "w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors";

  // Table columns
  const cols: Column<User>[] = [
    {
      key: 'avatar',
      label: '',
      className: 'w-12',
      render: u => (
        <div className="w-9 h-9 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center text-xs font-bold">
          {getInitials(u.firstName, u.lastName)}
        </div>
      ),
    },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: u => (
        <div>
          <span className="font-medium text-card-foreground">{u.firstName} {u.lastName}</span>
        </div>
      ),
    },
    { key: 'email', label: 'Email', sortable: true },
    { key: 'phone', label: 'Phone', render: u => <span className="text-muted-foreground">{u.phone || '-'}</span> },
    {
      key: 'role',
      label: 'Role',
      render: u => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-700'}`}>
          {u.role.replace(/_/g, ' ')}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: u => <StatusBadge status={u.status} /> },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: u => <span className="text-muted-foreground text-sm">{formatDate(u.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: u => (
        <div className="flex items-center gap-0.5">
          {/* Edit */}
          <button onClick={e => { e.stopPropagation(); openEdit(u); }} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-card-foreground transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          {/* Suspend/Activate */}
          <button onClick={e => { e.stopPropagation(); handleSuspendActivate(u); }} className={`p-1.5 rounded-lg hover:bg-muted transition-colors ${u.status === 'SUSPENDED' ? 'text-green-500 hover:text-green-600' : 'text-amber-500 hover:text-amber-600'}`} title={u.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}>
            {u.status === 'SUSPENDED'
              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            }
          </button>
          {/* Fund Wallet */}
          <button onClick={e => { e.stopPropagation(); openFund(u); }} className="p-1.5 rounded-lg hover:bg-muted text-green-500 hover:text-green-600 transition-colors" title="Fund Wallet">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>
          </button>
          {/* Delete */}
          <button onClick={e => { e.stopPropagation(); setDelDialog({ open: true, user: u }); }} className="p-1.5 rounded-lg hover:bg-muted text-red-500 hover:text-red-600 transition-colors" title="Delete">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Users' }]}
        actions={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Client
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search users..."
            className={`${ic} w-64 pl-9`}
          />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className={`${ic} w-40`}>
          <option value="">All Roles</option>
          {['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT', 'CLIENT', 'TRAINER'].map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-40`}>
          <option value="">All Statuses</option>
          {['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {(search || roleFilter || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}
            className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-card-foreground hover:bg-muted transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={cols}
        data={users}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={u => u.id}
        onRowClick={u => router.push(`/dashboard/users/${u.id}`)}
        emptyMessage="No users found"
      />

      {/* ==================== CREATE USER MODAL ==================== */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add Client" size="lg">
        <div className="space-y-6">
          {/* Only show the rest after role is selected */}
          {createForm.role && (
            <>
              {/* Step 2: Personal Details */}
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs flex items-center justify-center font-bold">1</span>
                  Personal Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">First Name *</label>
                    <input
                      value={createForm.firstName}
                      onChange={e => setCreateForm({ ...createForm, firstName: e.target.value })}
                      placeholder="John"
                      className={ic}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Last Name *</label>
                    <input
                      value={createForm.lastName}
                      onChange={e => setCreateForm({ ...createForm, lastName: e.target.value })}
                      placeholder="Doe"
                      className={ic}
                    />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-sm font-medium mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={e => setCreateForm({ ...createForm, email: e.target.value })}
                    placeholder="john@example.com"
                    className={ic}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Phone</label>
                    <input
                      value={createForm.phone}
                      onChange={e => setCreateForm({ ...createForm, phone: e.target.value })}
                      placeholder="+254 7XX XXX XXX"
                      className={ic}
                    />
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
                        {showPw ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Trainer-specific — Assignment + Profile */}
              {createForm.role === 'TRAINER' && (
                <div>
                  <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs flex items-center justify-center font-bold">2</span>
                    Trainer Setup
                  </h4>
                  <div className="space-y-4">
                    {/* Trainer Type */}
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button"
                        onClick={() => setCreateForm({ ...createForm, trainerType: 'PROFESSIONAL' })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${createForm.trainerType === 'PROFESSIONAL' ? 'border-blue-500 ' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                        <span className="text-sm font-semibold">White Collar</span>
                        <p className="text-xs text-gray-500">Corporate, consulting, coaching</p>
                      </button>
                      <button type="button"
                        onClick={() => setCreateForm({ ...createForm, trainerType: 'VOCATIONAL' })}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${createForm.trainerType === 'VOCATIONAL' ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                      >
                        <span className="text-sm font-semibold">Blue Collar</span>
                        <p className="text-xs text-gray-500">Trades, crafts, practical skills</p>
                      </button>
                    </div>

                    {/* Assignment: Independent / Firm / In-house */}
                    <div className="flex gap-2">
                      {[
                        { v: 'independent', label: 'Independent' },
                        { v: 'firm', label: 'Attach to Org' },
                        { v: 'inhouse', label: 'In-House (Uteo)' },
                      ].map(m => (
                        <button key={m.v} type="button"
                          onClick={() => setCreateForm({ ...createForm, trainerMode: m.v as any, firmTrainerId: '' })}
                          className={`flex-1 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${createForm.trainerMode === m.v ? 'border-primary-500 bg-primary-500/10 text-primary-500' : 'border-border text-muted-foreground hover:bg-muted/50'}`}
                        >{m.label}</button>
                      ))}
                    </div>

                    {createForm.trainerMode === 'inhouse' && (
                      <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800">
                        <p className="text-xs text-teal-700 dark:text-teal-300">This trainer will be added as a Uteo in-house trainer under the platform&apos;s main office.</p>
                      </div>
                    )}

                    {createForm.trainerMode === 'firm' && (
                      <div className="space-y-3">
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
                                <button type="button" onClick={() => setCreateForm({ ...createForm, firmTrainerId: '' })} className="ml-auto text-xs text-red-500 hover:text-red-700">✕ Remove</button>
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
                                      <p className="text-xs text-muted-foreground">{t.specialization || 'Trainer'} {t.location ? `· ${t.location}` : ''} {(t as any).isOrganization ? `🏢 Org (${(t as any).teamSize} members)` : '👤 Individual'}</p>
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

                    {/* Specialization */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Specialization</label>
                      <input value={createForm.specialization} onChange={e => setCreateForm({ ...createForm, specialization: e.target.value })} placeholder="e.g. Leadership & Management, Welding" className={ic} />
                    </div>

                    {/* Skills */}
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Skills</label>
                      <div className="flex gap-2 mb-2">
                        <input value={skillInput} onChange={e => setSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (skillInput.trim() && !skills.includes(skillInput.trim())) { setSkills([...skills, skillInput.trim()]); setSkillInput(''); } } }} placeholder="Type a skill and press Enter" className={ic + ' flex-1'} />
                        <button type="button" onClick={() => { if (skillInput.trim() && !skills.includes(skillInput.trim())) { setSkills([...skills, skillInput.trim()]); setSkillInput(''); } }} className="px-3 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs font-medium hover:bg-gray-50 dark:hover:bg-white/10">Add</button>
                      </div>
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {skills.map((s, i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-xs font-medium text-primary-700 dark:text-primary-300">
                              {s}
                              <button type="button" onClick={() => setSkills(skills.filter((_, j) => j !== i))} className="text-primary-400 hover:text-red-500">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Credentials / Certifications */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Credentials &amp; Certifications</label>
                        <button type="button" onClick={() => setCredentials([...credentials, { type: 'CERTIFICATE', name: '', issuer: '', year: '', documentUrl: '', uploading: false }])} className="text-xs font-medium text-primary-500 hover:text-primary-600">+ Add Credential</button>
                      </div>
                      {credentials.length === 0 && (
                        <p className="text-xs text-gray-400 italic">No credentials added. Click &quot;+ Add Credential&quot; to attach certifications, licenses, or qualifications.</p>
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
                  </div>
                </div>
              )}

              {/* Step 3 (Client): Assign to Trainer */}
              {createForm.role === 'CLIENT' && (
                <div>
                  <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs flex items-center justify-center font-bold">2</span>
                    Assign to Trainer <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  </h4>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Trainer / Organization</label>
                    <div className="relative">
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      <input
                        type="text"
                        value={trainerSearch}
                        onChange={e => setTrainerSearch(e.target.value)}
                        placeholder="Search trainer by name, specialization..."
                        className={ic + ' pl-10'}
                      />
                    </div>
                    {createForm.assignedTrainerId && (
                      <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                        <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-xs font-bold text-green-600">
                          {(trainerFirms.find(t => (t.user?.id || t.id) === createForm.assignedTrainerId)?.user?.firstName?.[0] || '')}{(trainerFirms.find(t => (t.user?.id || t.id) === createForm.assignedTrainerId)?.user?.lastName?.[0] || '')}
                        </div>
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          {trainerFirms.find(t => (t.user?.id || t.id) === createForm.assignedTrainerId)?.user?.firstName} {trainerFirms.find(t => (t.user?.id || t.id) === createForm.assignedTrainerId)?.user?.lastName}
                        </span>
                        <button type="button" onClick={() => setCreateForm({ ...createForm, assignedTrainerId: '' })} className="ml-auto text-xs text-red-500 hover:text-red-700">✕ Remove</button>
                      </div>
                    )}
                    {!createForm.assignedTrainerId && !firmsLoading && (
                      <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-white dark:bg-gray-800">
                        <button type="button"
                          onClick={() => setCreateForm({ ...createForm, assignedTrainerId: '' })}
                          className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/50 border-b border-border"
                        >No assignment (client browses freely)</button>
                        {trainerFirms.filter(t => {
                          if (!trainerSearch) return true;
                          const name = `${t.user?.firstName || ''} ${t.user?.lastName || ''} ${t.specialization || ''} ${t.location || ''}`.toLowerCase();
                          return name.includes(trainerSearch.toLowerCase());
                        }).map(t => (
                          <button key={t.id} type="button"
                            onClick={() => { setCreateForm({ ...createForm, assignedTrainerId: t.user?.id || t.id }); setTrainerSearch(''); }}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 text-sm border-b border-border last:border-0"
                          >
                            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-xs font-bold text-green-600">
                              {(t.user?.firstName?.[0] || '')}{(t.user?.lastName?.[0] || '')}
                            </div>
                            <div>
                              <p className="font-medium">{(t as any).isOrganization && (t as any).firmName ? (t as any).firmName : `${t.user?.firstName || ''} ${t.user?.lastName || ''}`}</p>
                              <p className="text-xs text-muted-foreground">{t.specialization || 'Trainer'} {t.location ? `· ${t.location}` : ''} {(t as any).isOrganization ? `🏢 Org (${(t as any).teamSize} members)` : '👤 Individual'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">Assigned clients get a direct chat with their trainer and show in the trainer&apos;s client list.</p>
                  </div>
                </div>
              )}

              {/* Step 4: Status */}
              <div>
                <h4 className="text-sm font-semibold text-card-foreground mb-3 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-xs flex items-center justify-center font-bold">
                    {createForm.role === 'TRAINER' ? '3' : '2'}
                  </span>
                  Status
                </h4>
                <div className="flex gap-3">
                  <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${
                    createForm.status === 'ACTIVE'
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                      : 'border-border hover:bg-muted/50'
                  }`}>
                    <input
                      type="radio"
                      name="create-status"
                      value="ACTIVE"
                      checked={createForm.status === 'ACTIVE'}
                      onChange={() => setCreateForm({ ...createForm, status: 'ACTIVE' })}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      createForm.status === 'ACTIVE' ? 'border-green-500' : 'border-border'
                    }`}>
                      {createForm.status === 'ACTIVE' && <div className="w-2 h-2 rounded-full bg-green-500" />}
                    </div>
                    <div>
                      <span className="text-sm font-medium">Active</span>
                      <p className="text-xs text-muted-foreground">User can access the platform immediately</p>
                    </div>
                  </label>
                  <label className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg border cursor-pointer transition-all ${
                    createForm.status === 'PENDING'
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                      : 'border-border hover:bg-muted/50'
                  }`}>
                    <input
                      type="radio"
                      name="create-status"
                      value="PENDING"
                      checked={createForm.status === 'PENDING'}
                      onChange={() => setCreateForm({ ...createForm, status: 'PENDING' })}
                      className="sr-only"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      createForm.status === 'PENDING' ? 'border-amber-500' : 'border-border'
                    }`}>
                      {createForm.status === 'PENDING' && <div className="w-2 h-2 rounded-full bg-amber-500" />}
                    </div>
                    <div>
                      <span className="text-sm font-medium">Pending</span>
                      <p className="text-xs text-muted-foreground">Requires admin approval before access</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
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
                  ) : (
                    <>Create {createForm.role === 'TRAINER' ? 'Trainer' : 'Client'}</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* ==================== EDIT USER MODAL ==================== */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditUser(null); }} title="Edit User" size="md">
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
            <input type="email" value={editForm.email} disabled className={`${ic} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Phone</label>
            <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className={ic} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Role</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={ic}>
                {['ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'SUPPORT', 'CLIENT', 'TRAINER'].map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Status</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={ic}>
                {['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button onClick={() => { setEditOpen(false); setEditUser(null); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={actionLoading} className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors">
              {actionLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ==================== FUND WALLET MODAL ==================== */}
      <Modal isOpen={fundOpen} onClose={() => { setFundOpen(false); setFundUser(null); }} title={`Fund Wallet`} size="sm">
        <div className="space-y-4">
          {fundUser && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-sm font-bold">
                {getInitials(fundUser.firstName, fundUser.lastName)}
              </div>
              <div>
                <p className="text-sm font-medium">{fundUser.firstName} {fundUser.lastName}</p>
                <p className="text-xs text-muted-foreground">{fundUser.email}</p>
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
            <button onClick={() => { setFundOpen(false); setFundUser(null); }} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
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

      {/* ==================== DELETE CONFIRMATION ==================== */}
      <ConfirmDialog
        isOpen={delDialog.open}
        onClose={() => setDelDialog({ open: false, user: null })}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${delDialog.user?.firstName} ${delDialog.user?.lastName}? This action cannot be undone. All associated data (bookings, wallet, etc.) will be permanently removed.`}
        confirmLabel="Delete User"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
