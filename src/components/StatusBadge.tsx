'use client';
import React from 'react';

const colors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  APPROVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SUCCESS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  RELEASED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  SENT: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  DELIVERED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  RESOLVED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  PENDING: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PROCESSING: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FUNDED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  INACTIVE: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  PAUSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  EXPIRED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  SUSPENDED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  DISPUTED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  REFUNDED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  FROZEN: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  OPEN: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  CLOSED: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  RESOLVED_RELEASE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  RESOLVED_REFUND: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>{status.replace(/_/g, ' ')}</span>;
}
