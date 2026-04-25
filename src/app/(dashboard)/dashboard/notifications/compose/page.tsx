'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { notificationService } from '@/lib/services/notificationService';
import { userService } from '@/lib/services/userService';
import { User, Notification } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatDateTime } from '@/lib/utils';

type RecipientMode = 'ALL_USERS' | 'ALL_TRAINERS' | 'ALL_CLIENTS' | 'SPECIFIC_USER';

const CHANNELS = ['EMAIL', 'SMS', 'PUSH', 'IN_APP'] as const;
type Channel = typeof CHANNELS[number];

const NOTIFICATION_TYPES = [
  // Uteo Recruitment types
  'NEW_JOB_MATCH',
  'APPLICATION_STATUS_UPDATE',
  'NEW_APPLICANT',
  'SYSTEM_ANNOUNCEMENT',
  // General types
  'BOOKING_REMINDER',
  'SYSTEM_ALERT',
  'ANNOUNCEMENT',
  'PAYMENT_RECEIVED',
  'ACCOUNT_UPDATE',
  'PROMOTIONAL',
  'VERIFICATION_UPDATE',
] as const;

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  NEW_JOB_MATCH: 'New Job Match (to job seekers)',
  APPLICATION_STATUS_UPDATE: 'Application Status Update (to applicants)',
  NEW_APPLICANT: 'New Applicant (to recruiters)',
  SYSTEM_ANNOUNCEMENT: 'System Announcement (to all users)',
  BOOKING_REMINDER: 'Booking Reminder',
  SYSTEM_ALERT: 'System Alert',
  ANNOUNCEMENT: 'Announcement',
  PAYMENT_RECEIVED: 'Payment Received',
  ACCOUNT_UPDATE: 'Account Update',
  PROMOTIONAL: 'Promotional',
  VERIFICATION_UPDATE: 'Verification Update',
};

const ic =
  'w-full px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50';

function channelLabel(c: string) {
  return c.replace(/_/g, ' ');
}

export default function ComposeNotificationPage() {
  const { addToast } = useToast();

  // Form state
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('ALL_USERS');
  const [channels, setChannels] = useState<Channel[]>(['IN_APP']);
  const [type, setType] = useState<string>('ANNOUNCEMENT');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sendLoading, setSendLoading] = useState(false);

  // Specific user search
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Delivery logs
  const [logs, setLogs] = useState<Notification[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotalPages, setLogsTotalPages] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const d = await notificationService.getAll({ page: logsPage, limit: 10 });
      setLogs(d.items ?? []);
      setLogsTotalPages(d.totalPages ?? 1);
      setLogsTotal(d.total ?? 0);
    } catch {
      addToast('error', 'Failed to load delivery logs');
    } finally {
      setLogsLoading(false);
    }
  }, [logsPage, addToast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // User search debounce
  useEffect(() => {
    if (recipientMode !== 'SPECIFIC_USER') return;
    if (selectedUser) { setShowDropdown(false); return; }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const params: Record<string, any> = { limit: 10 };
        if (userSearch.length >= 1) params.search = userSearch;
        const d = await userService.getAll(params);
        setUserResults(d.items ?? []);
        setShowDropdown(true);
      } catch {
        setUserResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [userSearch, selectedUser, recipientMode]);

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

  const toggleChannel = (c: Channel) => {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      addToast('error', 'Title and message are required');
      return;
    }
    if (channels.length === 0) {
      addToast('error', 'Select at least one channel');
      return;
    }
    if (recipientMode === 'SPECIFIC_USER' && !selectedUser) {
      addToast('error', 'Select a specific user or change recipient mode');
      return;
    }

    setSendLoading(true);
    try {
      if (recipientMode === 'SPECIFIC_USER' && selectedUser) {
        // Send one per selected channel
        await Promise.all(
          channels.map((ch) =>
            notificationService.send({
              userId: selectedUser.id,
              channel: ch,
              title,
              message,
            })
          )
        );
        addToast('success', `Notification sent to ${selectedUser.firstName} ${selectedUser.lastName}`);
      } else {
        const roleMap: Record<RecipientMode, string> = {
          ALL_USERS: '',
          ALL_TRAINERS: 'TRAINER',
          ALL_CLIENTS: 'CLIENT',
          SPECIFIC_USER: '',
        };
        const role = roleMap[recipientMode];
        await Promise.all(
          channels.map((ch) =>
            notificationService.sendBulk({ role, channel: ch, title, message })
          )
        );
        addToast('success', 'Broadcast sent successfully');
      }

      // Reset form
      setTitle('');
      setMessage('');
      setChannels(['IN_APP']);
      setType('ANNOUNCEMENT');
      setSelectedUser(null);
      setUserSearch('');
      setRecipientMode('ALL_USERS');
      fetchLogs();
    } catch (err: any) {
      const errMsg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Failed to send notification';
      addToast('error', errMsg);
    } finally {
      setSendLoading(false);
    }
  };

  // Preview derived label
  const recipientLabel: Record<RecipientMode, string> = {
    ALL_USERS: 'All Users',
    ALL_TRAINERS: 'All Trainers',
    ALL_CLIENTS: 'All Clients',
    SPECIFIC_USER: selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : 'Specific User',
  };

  const logCols: Column<Notification>[] = [
    {
      key: 'sentAt',
      label: 'Sent At',
      render: (n) => <span className="text-xs text-muted-foreground">{formatDateTime(n.sentAt ?? n.createdAt)}</span>,
    },
    {
      key: 'title',
      label: 'Title',
      render: (n) => <span className="font-medium text-sm">{n.title}</span>,
    },
    {
      key: 'recipient',
      label: 'Recipient',
      render: (n) =>
        n.user ? (
          <span className="text-sm">{n.user.firstName} {n.user.lastName}</span>
        ) : (
          <span className="text-xs text-muted-foreground italic">Broadcast</span>
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
      key: 'status',
      label: 'Status',
      render: (n) => {
        const color = n.status === 'DELIVERED' ? 'text-green-600' : n.status === 'FAILED' ? 'text-red-600' : 'text-amber-600';
        return <span className={`text-xs font-medium ${color}`}>{n.status}</span>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Compose Notification"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Notifications', href: '/dashboard/notifications' },
          { label: 'Compose' },
        ]}
        actions={
          <Link
            href="/dashboard/notifications"
            className="px-4 py-2 rounded-lg border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          >
            View All Notifications
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-10">
        {/* ── Compose Form ──────────────────────────────────────────────────── */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border p-6 space-y-5">
          <h2 className="font-semibold text-card-foreground">New Notification</h2>

          {/* Recipients */}
          <div>
            <label className="block text-sm font-medium mb-2">Recipients</label>
            <div className="grid grid-cols-2 gap-2">
              {(['ALL_USERS', 'ALL_TRAINERS', 'ALL_CLIENTS', 'SPECIFIC_USER'] as RecipientMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setRecipientMode(mode);
                    if (mode !== 'SPECIFIC_USER') { setSelectedUser(null); setUserSearch(''); }
                  }}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    recipientMode === mode
                      ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                      : 'border-border text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  {mode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </button>
              ))}
            </div>
          </div>

          {/* User search (only when SPECIFIC_USER) */}
          {recipientMode === 'SPECIFIC_USER' && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Search User</label>
              <div className="relative" ref={dropdownRef}>
                {selectedUser ? (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-border bg-muted/50">
                    <span className="text-sm">{selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})</span>
                    <button
                      onClick={() => { setSelectedUser(null); setUserSearch(''); }}
                      className="text-muted-foreground hover:text-card-foreground"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    onFocus={() => { if (userResults.length > 0) setShowDropdown(true); }}
                    placeholder="Search by name or email..."
                    className={ic}
                  />
                )}
                {showDropdown && !selectedUser && (
                  <div className="absolute z-10 w-full mt-1 rounded-lg border border-border bg-card shadow-lg max-h-48 overflow-y-auto">
                    {searchLoading ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Searching…</div>
                    ) : userResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
                    ) : (
                      userResults.map((u) => (
                        <button
                          key={u.id}
                          onClick={() => { setSelectedUser(u); setUserSearch(''); setShowDropdown(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                        >
                          <p className="font-medium">{u.firstName} {u.lastName}</p>
                          <p className="text-xs text-muted-foreground">{u.email} · {u.role}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Channels */}
          <div>
            <label className="block text-sm font-medium mb-2">Channels</label>
            <div className="flex flex-wrap gap-3">
              {CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={channels.includes(c)}
                    onChange={() => toggleChannel(c)}
                    className="rounded border-border"
                  />
                  <span className="text-sm">{channelLabel(c)}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className={ic}>
              <optgroup label="Recruitment">
                <option value="NEW_JOB_MATCH">{NOTIFICATION_TYPE_LABELS['NEW_JOB_MATCH']}</option>
                <option value="APPLICATION_STATUS_UPDATE">{NOTIFICATION_TYPE_LABELS['APPLICATION_STATUS_UPDATE']}</option>
                <option value="NEW_APPLICANT">{NOTIFICATION_TYPE_LABELS['NEW_APPLICANT']}</option>
                <option value="SYSTEM_ANNOUNCEMENT">{NOTIFICATION_TYPE_LABELS['SYSTEM_ANNOUNCEMENT']}</option>
              </optgroup>
              <optgroup label="General">
                {(['BOOKING_REMINDER', 'SYSTEM_ALERT', 'ANNOUNCEMENT', 'PAYMENT_RECEIVED', 'ACCOUNT_UPDATE', 'PROMOTIONAL', 'VERIFICATION_UPDATE'] as const).map((t) => (
                  <option key={t} value={t}>{NOTIFICATION_TYPE_LABELS[t] || t.replace(/_/g, ' ')}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Title <span className="text-red-500">*</span></label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title"
              className={ic}
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Message <span className="text-red-500">*</span></label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Type your notification message..."
              className={ic}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sendLoading || !title.trim() || !message.trim() || channels.length === 0}
            className="w-full py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
          >
            {sendLoading ? 'Sending…' : 'Send Notification'}
          </button>
        </div>

        {/* ── Preview Panel ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-card-foreground mb-4 text-sm uppercase tracking-wide text-muted-foreground">Preview</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">To</span>
                <span className="font-medium text-card-foreground text-right">{recipientLabel[recipientMode]}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Via</span>
                <span className="font-medium text-card-foreground">{channels.length > 0 ? channels.join(', ') : '—'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium text-card-foreground">{type.replace(/_/g, ' ')}</span>
              </div>
              <div className="pt-3 border-t border-border">
                <p className="font-semibold text-card-foreground mb-1">{title || <span className="text-muted-foreground italic">No title yet</span>}</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {message || <span className="italic">No message yet</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Bulk warning */}
          {recipientMode !== 'SPECIFIC_USER' && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This will broadcast to {recipientLabel[recipientMode].toLowerCase()}. This action cannot be undone.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Delivery Logs ──────────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-card-foreground mb-4">Delivery Logs</h2>
        <DataTable
          columns={logCols}
          data={logs}
          loading={logsLoading}
          page={logsPage}
          totalPages={logsTotalPages}
          total={logsTotal}
          onPageChange={setLogsPage}
          keyExtractor={(n) => n.id}
          emptyMessage="No notifications sent yet"
        />
      </div>
    </div>
  );
}
