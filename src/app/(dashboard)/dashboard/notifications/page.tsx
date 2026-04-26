'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { StatusBadge } from '@/components/StatusBadge';
import { Modal } from '@/components/Modal';
import { notificationService } from '@/lib/services/notificationService';
import { userService } from '@/lib/services/userService';
import { Notification, User } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatDateTime } from '@/lib/utils';

const CHANNELS = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] as const;
const ROLES = [
  { value: 'CLIENT', label: 'Job Seekers' },
  { value: 'TRAINER', label: 'Recruiters' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'SUPER_ADMIN', label: 'Super Admins' },
  { value: 'SUPPORT', label: 'Support Team' },
] as const;

type SendMode = 'single' | 'bulk';

export default function NotificationsPage() {
  const { addToast } = useToast();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [channelFilter, setChannelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Compose modal
  const [composeOpen, setComposeOpen] = useState(false);
  const [sendMode, setSendMode] = useState<SendMode>('single');
  const [actionLoading, setActionLoading] = useState(false);

  // Single notification form
  const [form, setForm] = useState({ userId: '', channel: '', title: '', message: '' });

  // Bulk notification form
  const [bulkForm, setBulkForm] = useState({ role: '', channel: '', title: '', message: '' });

  // User search
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const d = await notificationService.getAll({
        page,
        limit: 10,
        channel: channelFilter || undefined,
        status: statusFilter || undefined,
      });
      setNotifs(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch {
      addToast('error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, channelFilter, statusFilter, addToast]);

  useEffect(() => {
    fetchNotifs();
  }, [fetchNotifs]);

  // Debounced user search — loads all on focus, filters on type
  useEffect(() => {
    if (selectedUser) { setShowDropdown(false); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params: any = { limit: 10 };
        if (userSearch && userSearch.length >= 1) params.search = userSearch;
        const d = await userService.getAll(params);
        setUserResults(d.items || []);
        setShowDropdown(true);
      } catch {
        setUserResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [userSearch, selectedUser]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectUser = (user: User) => {
    setSelectedUser(user);
    setForm((prev) => ({ ...prev, userId: user.id }));
    setUserSearch(`${user.firstName} ${user.lastName} (${user.email})`);
    setShowDropdown(false);
  };

  const clearSelectedUser = () => {
    setSelectedUser(null);
    setForm((prev) => ({ ...prev, userId: '' }));
    setUserSearch('');
  };

  const resetAndClose = () => {
    setComposeOpen(false);
    setSendMode('single');
    setForm({ userId: '', channel: '', title: '', message: '' });
    setBulkForm({ role: '', channel: '', title: '', message: '' });
    setSelectedUser(null);
    setUserSearch('');
    setShowDropdown(false);
  };

  const handleSend = async () => {
    if (sendMode === 'single') {
      if (!selectedUser) {
        addToast('error', 'Please select a recipient from the dropdown');
        return;
      }
      if (!form.channel || !form.title || !form.message) {
        addToast('error', 'Fill all required fields');
        return;
      }
    } else {
      if (!bulkForm.role || !bulkForm.channel || !bulkForm.title || !bulkForm.message) {
        addToast('error', 'Fill all required fields');
        return;
      }
    }

    setActionLoading(true);
    try {
      if (sendMode === 'single') {
        await notificationService.send({
          userId: form.userId || undefined,
          channel: form.channel,
          title: form.title,
          message: form.message,
        });
        addToast('success', 'Notification sent');
      } else {
        const result = await notificationService.sendBulk({
          role: bulkForm.role,
          channel: bulkForm.channel,
          title: bulkForm.title,
          message: bulkForm.message,
        });
        addToast('success', `Notification sent to ${result.count ?? 'all'} users`);
      }
      resetAndClose();
      fetchNotifs();
    } catch (err: any) {
      const errData = err?.response?.data?.error || err?.response?.data;
      const details = errData?.details;
      const msg = Array.isArray(details) ? details.join(', ') : errData?.message || 'Failed to send notification';
      addToast('error', typeof msg === 'string' ? msg : 'Failed to send notification');
    } finally {
      setActionLoading(false);
    }
  };

  const ic =
    'w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';

  const cols: Column<Notification>[] = [
    {
      key: 'user',
      label: 'Recipient',
      render: (n) =>
        n.user ? (
          <span className="font-medium">{n.user.firstName} {n.user.lastName}</span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'channel',
      label: 'Channel',
      render: (n) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">{n.channel}</span>
      ),
    },
    {
      key: 'title',
      label: 'Title',
      render: (n) => <span className="font-medium">{n.title}</span>,
    },
    {
      key: 'message',
      label: 'Message',
      render: (n) => (
        <span className="text-xs text-muted-foreground" title={n.message}>
          {n.message?.length > 50 ? `${n.message.slice(0, 50)}...` : n.message}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (n) => <StatusBadge status={n.status} />,
    },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (n) => (
        <span className="text-muted-foreground text-xs">
          {formatDateTime(n.sentAt || n.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Notifications"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Notifications' }]}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/notifications/compose"
              className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
            >
              Compose
            </Link>
            <button
              onClick={() => {
                resetAndClose();
                setComposeOpen(true);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10"
            >
              Send Notification
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={channelFilter}
          onChange={(e) => { setChannelFilter(e.target.value); setPage(1); }}
          className={`${ic} w-40`}
        >
          <option value="">All Channels</option>
          {CHANNELS.map((c) => (
            <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className={`${ic} w-40`}
        >
          <option value="">All Statuses</option>
          {['PENDING', 'SENT', 'DELIVERED', 'FAILED'].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(channelFilter || statusFilter) && (
          <button
            onClick={() => { setChannelFilter(''); setStatusFilter(''); setPage(1); }}
            className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted"
          >
            Clear
          </button>
        )}
      </div>

      <DataTable
        columns={cols}
        data={notifs}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={(n) => n.id}
        emptyMessage="No notifications"
      />

      {/* Compose Modal */}
      <Modal isOpen={composeOpen} onClose={resetAndClose} title="Send Notification" size="md">
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setSendMode('single')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                sendMode === 'single'
                  ? 'border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent'
                  : 'bg-card text-card-foreground hover:bg-muted'
              }`}
            >
              Single User
            </button>
            <button
              onClick={() => setSendMode('bulk')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                sendMode === 'bulk'
                  ? 'border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent'
                  : 'bg-card text-card-foreground hover:bg-muted'
              }`}
            >
              Bulk (by Role)
            </button>
          </div>

          {sendMode === 'single' ? (
            <>
              {/* User search */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Recipient (search by name or email)
                </label>
                <div className="relative" ref={dropdownRef}>
                  {selectedUser ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50">
                      <span className="text-sm flex-1">
                        {selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})
                      </span>
                      <button onClick={clearSelectedUser} className="p-0.5 rounded hover:bg-muted">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      onFocus={() => { if (userResults.length > 0) setShowDropdown(true); }}
                      placeholder="Click to search users..."
                      className={ic}
                    />
                  )}
                  {showDropdown && !selectedUser && (
                    <div className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                      {searchLoading ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Searching...</div>
                      ) : (
                        userResults.map((user) => (
                          <button
                            key={user.id}
                            onClick={() => selectUser(user)}
                            className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm"
                          >
                            <p className="font-medium">{user.firstName} {user.lastName}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Channel*</label>
                <select
                  value={form.channel}
                  onChange={(e) => setForm({ ...form, channel: e.target.value })}
                  className={ic}
                >
                  <option value="">Select channel...</option>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Title*</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Notification title"
                  className={ic}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message*</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  rows={4}
                  placeholder="Type your message..."
                  className={ic}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Send to Role*</label>
                <select
                  value={bulkForm.role}
                  onChange={(e) => setBulkForm({ ...bulkForm, role: e.target.value })}
                  className={ic}
                >
                  <option value="">Select role...</option>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Channel*</label>
                <select
                  value={bulkForm.channel}
                  onChange={(e) => setBulkForm({ ...bulkForm, channel: e.target.value })}
                  className={ic}
                >
                  <option value="">Select channel...</option>
                  {CHANNELS.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Title*</label>
                <input
                  value={bulkForm.title}
                  onChange={(e) => setBulkForm({ ...bulkForm, title: e.target.value })}
                  placeholder="Notification title"
                  className={ic}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Message*</label>
                <textarea
                  value={bulkForm.message}
                  onChange={(e) => setBulkForm({ ...bulkForm, message: e.target.value })}
                  rows={4}
                  placeholder="Type your message..."
                  className={ic}
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  This will send a notification to all users with the selected role. This action cannot be undone.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={resetAndClose} className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-white/10"
            >
              {actionLoading ? 'Sending...' : sendMode === 'bulk' ? 'Send to All' : 'Send'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
