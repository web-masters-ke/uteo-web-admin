'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import { Modal } from '@/components/Modal';
import { auditService } from '@/lib/services/auditService';
import { AuditLog } from '@/lib/types';
import { useToast } from '@/lib/toast';
import { formatDateTime } from '@/lib/utils';

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'text-green-600 dark:text-green-400',
  UPDATE: 'text-blue-600 dark:text-blue-400',
  DELETE: 'text-red-600 dark:text-red-400',
  LOGIN: 'text-purple-600 dark:text-purple-400',
  LOGOUT: 'text-gray-600 dark:text-gray-400',
  APPROVE: 'text-green-600 dark:text-green-400',
  REJECT: 'text-red-600 dark:text-red-400',
  RESOLVE: 'text-amber-600 dark:text-amber-400',
};

const SEVERITY_BADGES: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  WARN: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  WARNING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  CRITICAL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  ERROR: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function getSeverity(log: AuditLog): string {
  // Derive severity from action if not explicitly present
  const meta = log.metadata as Record<string, any> | undefined;
  if (meta?.severity) return String(meta.severity).toUpperCase();
  if (['DELETE', 'REJECT'].includes(log.action)) return 'WARN';
  if (['LOGIN', 'LOGOUT'].includes(log.action)) return 'INFO';
  return 'INFO';
}

export default function AuditLogsPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const d = await auditService.getAll({
        page,
        limit: 20,
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
        search: debouncedSearch || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setLogs(d.items);
      setTotalPages(d.totalPages);
      setTotal(d.total);
    } catch {
      addToast('error', 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, resourceFilter, debouncedSearch, startDate, endDate, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const ic =
    'px-3 py-2 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#192C67]/30';

  const hasFilters = search || actionFilter || resourceFilter || startDate || endDate;

  const clearFilters = () => {
    setSearch('');
    setActionFilter('');
    setResourceFilter('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const cols: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      label: 'Timestamp',
      sortable: true,
      render: (l) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDateTime(l.createdAt)}
        </span>
      ),
    },
    {
      key: 'user',
      label: 'User',
      render: (l) => {
        if (l.user) {
          return (
            <div>
              <p className="text-sm font-medium">{l.user.firstName} {l.user.lastName}</p>
              <p className="text-xs text-muted-foreground">{l.user.email}</p>
            </div>
          );
        }
        return (
          <span className="text-xs font-mono text-muted-foreground">
            {l.userId?.slice(0, 8) || 'System'}
          </span>
        );
      },
    },
    {
      key: 'action',
      label: 'Action',
      render: (l) => (
        <span className={`text-xs font-semibold ${ACTION_COLORS[l.action] || 'text-foreground'}`}>
          {l.action}
        </span>
      ),
    },
    {
      key: 'resource',
      label: 'Resource',
      render: (l) => (
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted">
          {l.resource}
        </span>
      ),
    },
    {
      key: 'severity',
      label: 'Severity',
      render: (l) => {
        const sev = getSeverity(l);
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERITY_BADGES[sev] || SEVERITY_BADGES.INFO}`}>
            {sev}
          </span>
        );
      },
    },
    {
      key: 'resourceId',
      label: 'Resource ID',
      render: (l) =>
        l.resourceId ? (
          <span className="text-xs font-mono text-muted-foreground">
            {l.resourceId.slice(0, 8)}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      key: 'details',
      label: 'Details',
      render: (l) => {
        const meta = l.metadata as Record<string, any> | undefined;
        if (!meta || Object.keys(meta).length === 0) {
          return <span className="text-muted-foreground text-xs">-</span>;
        }
        const isExpanded = expandedId === l.id;
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(isExpanded ? null : l.id);
            }}
            className="text-xs text-[#192C67] dark:text-[#F77B0F] hover:underline"
          >
            {isExpanded ? 'Hide' : 'View'}
          </button>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Audit Logs' }]}
        actions={
          <span className="text-sm text-muted-foreground">
            Track all system actions and changes
          </span>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Search by action or user name */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by action or user..."
            className={`${ic} pl-9 w-64`}
          />
        </div>

        {/* Action filter */}
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className={`${ic} w-40`}
        >
          <option value="">All Actions</option>
          {['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'APPROVE', 'REJECT', 'RESOLVE'].map(
            (a) => (
              <option key={a} value={a}>{a}</option>
            )
          )}
        </select>

        {/* Resource filter */}
        <select
          value={resourceFilter}
          onChange={(e) => {
            setResourceFilter(e.target.value);
            setPage(1);
          }}
          className={`${ic} w-40`}
        >
          <option value="">All Resources</option>
          {['USER', 'BOOKING', 'PAYMENT', 'ESCROW', 'DISPUTE', 'TRAINER', 'REVIEW', 'SUBSCRIPTION', 'COMMISSION', 'COURSE', 'SETTINGS'].map(
            (r) => (
              <option key={r} value={r}>{r}</option>
            )
          )}
        </select>

        {/* Date range */}
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className={ic}
          title="Start date"
        />
        <span className="text-muted-foreground text-sm">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className={ic}
          title="End date"
        />

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-xs rounded-lg border border-border hover:bg-muted transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Results summary */}
      {total > 0 && !loading && (
        <p className="text-xs text-muted-foreground mb-3">
          Showing {logs.length} of {total} audit log entries
        </p>
      )}

      {/* Expanded metadata display */}
      {expandedId && (
        <div className="mb-4 bg-muted/50 rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-card-foreground">Metadata Details</p>
            <button
              onClick={() => setExpandedId(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
          <pre className="text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(
              logs.find((l) => l.id === expandedId)?.metadata || {},
              null,
              2
            )}
          </pre>
        </div>
      )}

      <DataTable
        columns={cols}
        data={logs}
        loading={loading}
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={setPage}
        keyExtractor={(l) => l.id}
        onRowClick={(l) => setSelectedLog(l)}
        emptyMessage="No audit logs found"
      />

      {/* Detail Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Audit Log Detail" size="md">
        {selectedLog && (() => {
          const meta = selectedLog.metadata as Record<string, any> | undefined;
          const sev = getSeverity(selectedLog);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Action</p>
                  <p className={`text-sm font-bold ${ACTION_COLORS[selectedLog.action.split('_')[0]] || 'text-card-foreground'}`}>{selectedLog.action.replace(/_/g, ' ')}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Severity</p>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEVERITY_BADGES[sev] || SEVERITY_BADGES.INFO}`}>{sev}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Timestamp</p>
                  <p className="text-sm font-medium">{formatDateTime(selectedLog.createdAt)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">User</p>
                  <p className="text-sm font-medium">{selectedLog.user ? `${(selectedLog.user as any).firstName} ${(selectedLog.user as any).lastName}` : '-'}</p>
                  <p className="text-xs text-muted-foreground">{(selectedLog.user as any)?.email || ''}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Resource</p>
                  <p className="text-sm font-medium">{selectedLog.resource || '-'}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Resource ID</p>
                  <p className="text-sm font-mono text-xs">{selectedLog.resourceId || '-'}</p>
                </div>
              </div>
              {selectedLog.ipAddress && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">IP Address</p>
                  <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
                </div>
              )}
              {meta && Object.keys(meta).length > 0 && (
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Details</p>
                  {meta.description && <p className="text-sm font-medium text-card-foreground mb-2">{meta.description}</p>}
                  <div className="space-y-1">
                    {Object.entries(meta).filter(([k]) => k !== 'description').map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{k}</span>
                        <span className="font-medium text-card-foreground">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Log ID</p>
                <p className="text-xs font-mono text-muted-foreground">{selectedLog.id}</p>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
