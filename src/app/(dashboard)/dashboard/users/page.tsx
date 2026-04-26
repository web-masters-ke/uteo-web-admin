'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { userService } from '@/lib/services/userService';
import api, { unwrap } from '@/lib/api';
import { User } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatDate, getInitials } from '@/lib/utils';

const ROLE_LABEL: Record<string, string> = {
  CLIENT: 'Job Seeker',
  TRAINER: 'Recruiter',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
  FINANCE_ADMIN: 'Finance Admin',
  SUPPORT: 'Support',
};

const ROLE_BADGE: Record<string, string> = {
  CLIENT: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  TRAINER: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  ADMIN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  SUPER_ADMIN: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FINANCE_ADMIN: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SUPPORT: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

const ic = 'w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F77B0F]/50 focus:border-[#F77B0F] transition-colors';

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
  const [actionLoading, setActionLoading] = useState(false);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ firstName: '', lastName: '', phone: '', role: '', status: '' });

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '',
    role: 'CLIENT' as 'CLIENT' | 'TRAINER' | 'ADMIN' | 'SUPPORT',
    status: 'ACTIVE' as 'ACTIVE' | 'PENDING',
  });
  const [showPw, setShowPw] = useState(false);

  // Delete dialog
  const [delDialog, setDelDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const d = await userService.getAll({ page, limit: 10, search, role: roleFilter, status: statusFilter });
      setUsers(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch { addToast('error', 'Failed to load users'); }
    finally { setLoading(false); }
  }, [page, search, roleFilter, statusFilter, addToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openEdit = (u: User) => {
    setEditUser(u);
    setEditForm({ firstName: u.firstName, lastName: u.lastName, phone: u.phone || '', role: u.role, status: u.status });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setActionLoading(true);
    try {
      await userService.update(editUser.id, {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        phone: editForm.phone || undefined,
        role: editForm.role,
        status: editForm.status,
      });
      addToast('success', 'User updated');
      setEditOpen(false);
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      addToast('error', err?.response?.data?.error?.message ?? 'Failed to update user');
    } finally { setActionLoading(false); }
  };

  const handleCreate = async () => {
    if (!createForm.firstName.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      addToast('error', 'First name, email and password are required');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/auth/register', {
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim() || undefined,
        email: createForm.email.trim().toLowerCase(),
        phone: createForm.phone.trim() || undefined,
        password: createForm.password,
        role: createForm.role,
      });
      addToast('success', `${ROLE_LABEL[createForm.role]} created`);
      setCreateOpen(false);
      setCreateForm({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'CLIENT', status: 'ACTIVE' });
      fetchUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Failed to create user';
      addToast('error', typeof msg === 'string' ? msg : 'Failed to create user');
    } finally { setActionLoading(false); }
  };

  const handleSuspendActivate = async (u: User) => {
    setActionLoading(true);
    try {
      if (u.status === 'SUSPENDED') {
        await userService.activate(u.id);
        addToast('success', `${u.firstName} activated`);
      } else {
        await userService.suspend(u.id);
        addToast('success', `${u.firstName} suspended`);
      }
      fetchUsers();
    } catch { addToast('error', 'Failed to update status'); }
    finally { setActionLoading(false); }
  };

  const handleDelete = async () => {
    if (!delDialog.user) return;
    setActionLoading(true);
    try {
      await userService.delete(delDialog.user.id);
      addToast('success', 'User deleted');
      setDelDialog({ open: false, user: null });
      fetchUsers();
    } catch { addToast('error', 'Failed to delete user'); }
    finally { setActionLoading(false); }
  };

  const cols: Column<User>[] = [
    {
      key: 'avatar',
      label: '',
      className: 'w-12',
      render: u => (
        <div className="w-9 h-9 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] flex items-center justify-center text-xs font-bold">
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
          <p className="font-semibold text-gray-900 dark:text-white">{u.firstName} {u.lastName}</p>
          <p className="text-xs text-gray-400">{u.email}</p>
        </div>
      ),
    },
    { key: 'phone', label: 'Phone', render: u => <span className="text-sm text-gray-500 dark:text-gray-400">{u.phone || '—'}</span> },
    {
      key: 'role',
      label: 'Role',
      render: u => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[u.role] || 'bg-gray-100 text-gray-600'}`}>
          {ROLE_LABEL[u.role] ?? u.role.replace(/_/g, ' ')}
        </span>
      ),
    },
    { key: 'status', label: 'Status', render: u => <StatusBadge status={u.status} /> },
    {
      key: 'createdAt',
      label: 'Joined',
      sortable: true,
      render: u => <span className="text-xs text-gray-400">{formatDate(u.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: '',
      render: u => (
        <div className="flex items-center gap-0.5">
          <button
            onClick={e => { e.stopPropagation(); openEdit(u); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-[#F77B0F] transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); handleSuspendActivate(u); }}
            className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${u.status === 'SUSPENDED' ? 'text-green-500 hover:text-green-600' : 'text-amber-500 hover:text-amber-600'}`}
            title={u.status === 'SUSPENDED' ? 'Activate' : 'Suspend'}
          >
            {u.status === 'SUSPENDED'
              ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            }
          </button>
          <button
            onClick={e => { e.stopPropagation(); setDelDialog({ open: true, user: u }); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-red-400 hover:text-red-600 transition-colors"
            title="Delete"
          >
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
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline transition-opacity"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Add User
          </button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search users..."
            className={`${ic} w-64 pl-9`}
          />
        </div>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }} className={`${ic} w-44`}>
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className={`${ic} w-36`}>
          <option value="">All Statuses</option>
          {['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING'].map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        {(search || roleFilter || statusFilter) && (
          <button onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 self-center">
            Clear
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

      {/* ── EDIT MODAL ─────────────────────────────────────────────── */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditUser(null); }} title="Edit User" size="md">
        <div className="space-y-4">
          {editUser && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="w-10 h-10 rounded-full bg-[#F77B0F]/10 text-[#F77B0F] flex items-center justify-center text-sm font-bold">
                {getInitials(editUser.firstName, editUser.lastName)}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{editUser.firstName} {editUser.lastName}</p>
                <p className="text-xs text-gray-400">{editUser.email}</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">First Name</label>
              <input value={editForm.firstName} onChange={e => setEditForm({ ...editForm, firstName: e.target.value })} className={ic} placeholder="First name" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Last Name</label>
              <input value={editForm.lastName} onChange={e => setEditForm({ ...editForm, lastName: e.target.value })} className={ic} placeholder="Last name" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
            <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className={ic} placeholder="+254 7XX XXX XXX" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Role</label>
              <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })} className={ic}>
                {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className={ic}>
                {['ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'PENDING'].map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => { setEditOpen(false); setEditUser(null); }} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Cancel</button>
            <button onClick={handleEdit} disabled={actionLoading} className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-40 transition-opacity">
              {actionLoading ? <><span className="w-3.5 h-3.5 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" />Saving…</> : 'Save Changes →'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── CREATE USER MODAL ──────────────────────────────────────── */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Add User" size="md">
        <div className="space-y-4">
          {/* Role picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {([['CLIENT', 'Job Seeker', 'Looking for jobs on the platform'], ['TRAINER', 'Recruiter', 'Posts jobs and reviews applications'], ['ADMIN', 'Admin', 'Full platform administration'], ['SUPPORT', 'Support', 'Customer support access']] as const).map(([v, l, desc]) => (
                <button key={v} type="button" onClick={() => setCreateForm(f => ({ ...f, role: v }))}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${createForm.role === v ? 'border-[#F77B0F] bg-[#F77B0F]/5' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                  <p className={`text-sm font-semibold ${createForm.role === v ? 'text-[#F77B0F]' : 'text-gray-900 dark:text-white'}`}>{l}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Personal details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">First Name <span className="text-red-500">*</span></label>
              <input value={createForm.firstName} onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))} className={ic} placeholder="Jane" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Last Name</label>
              <input value={createForm.lastName} onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))} className={ic} placeholder="Doe" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Email <span className="text-red-500">*</span></label>
            <input type="email" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} className={ic} placeholder="jane@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Phone</label>
              <input value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} className={ic} placeholder="+254 700 000 000" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Password <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={createForm.password} onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))} className={ic + ' pr-10'} placeholder="Min 8 chars" />
                <button type="button" onClick={() => setShowPw(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPw
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  }
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <button onClick={() => setCreateOpen(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Cancel</button>
            <button onClick={handleCreate} disabled={actionLoading || !createForm.firstName.trim() || !createForm.email.trim() || !createForm.password.trim()}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-40 transition-opacity">
              {actionLoading ? <><span className="w-3.5 h-3.5 border-2 border-[#F77B0F] border-t-transparent rounded-full animate-spin" />Creating…</> : `Create ${ROLE_LABEL[createForm.role]} →`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── DELETE CONFIRM ─────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={delDialog.open}
        onClose={() => setDelDialog({ open: false, user: null })}
        onConfirm={handleDelete}
        title="Delete User"
        message={`Are you sure you want to delete ${delDialog.user?.firstName} ${delDialog.user?.lastName}? This cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
