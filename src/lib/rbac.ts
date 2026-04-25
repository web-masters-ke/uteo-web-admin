export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT';

export const PAGE_ROLES: Record<string, AdminRole[]> = {
  '/dashboard': ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SUPPORT'],
  '/dashboard/revenue': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/financials': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/payouts': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/invoices': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/commissions': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/escrow': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/transactions': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/payments': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/subscription-plans': ['SUPER_ADMIN', 'ADMIN'],
  '/dashboard/analytics': ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'SUPPORT'],
  '/dashboard/users': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/trainers': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/credentials': ['SUPER_ADMIN', 'ADMIN'],
  '/dashboard/verifications': ['SUPER_ADMIN', 'ADMIN'],
  '/dashboard/bookings': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/disputes': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/courses': ['SUPER_ADMIN', 'ADMIN'],
  '/dashboard/skills': ['SUPER_ADMIN', 'ADMIN'],
  '/dashboard/subscriptions': ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/reviews': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/notifications': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/audit-logs': ['SUPER_ADMIN'],
  '/dashboard/settings': ['SUPER_ADMIN'],
  '/dashboard/reconciliation': ['SUPER_ADMIN', 'FINANCE_ADMIN'],
  '/dashboard/moderation': ['SUPER_ADMIN', 'ADMIN'],
  '/dashboard/notifications/compose': ['SUPER_ADMIN', 'ADMIN'],
  '/dashboard/system': ['SUPER_ADMIN', 'ADMIN'],
  '/dashboard/ai-control': ['SUPER_ADMIN'],
  '/dashboard/roles': ['SUPER_ADMIN'],
  // Uteo recruitment
  '/dashboard/jobs': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/companies': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/applications': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/reports': ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'],
  '/dashboard/analytics/jobs': ['SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN'],
};

export function canAccess(role: string, path: string): boolean {
  const key = Object.keys(PAGE_ROLES).find(k => path === k || path.startsWith(k + '/'));
  if (!key) return true; // unknown pages default to accessible
  return PAGE_ROLES[key].includes(role as AdminRole);
}

export function getAccessiblePaths(role: string): string[] {
  return Object.entries(PAGE_ROLES)
    .filter(([, roles]) => roles.includes(role as AdminRole))
    .map(([path]) => path);
}
