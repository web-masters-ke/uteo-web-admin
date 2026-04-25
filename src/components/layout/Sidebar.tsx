'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';

function Icon({ path, className }: { path: string; className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cn('h-4 w-4 shrink-0', className)}>
      <path d={path} />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={cn('h-4 w-4 shrink-0', className)}>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

interface NavItem { href: string; label: string; iconPath?: string; customIcon?: 'settings'; }
interface NavGroup { label: string; items: NavItem[]; }

const ICONS = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  analytics: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  companies: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  jobs: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  applications: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  reports: 'M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9',
  auditLogs: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  notifications: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  roles: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { href: '/dashboard', label: 'Dashboard', iconPath: ICONS.dashboard },
      { href: '/dashboard/analytics', label: 'Analytics', iconPath: ICONS.analytics },
    ],
  },
  {
    label: 'Recruitment',
    items: [
      { href: '/dashboard/users', label: 'Users', iconPath: ICONS.users },
      { href: '/dashboard/companies', label: 'Companies', iconPath: ICONS.companies },
      { href: '/dashboard/jobs', label: 'Jobs', iconPath: ICONS.jobs },
      { href: '/dashboard/applications', label: 'Applications', iconPath: ICONS.applications },
    ],
  },
  {
    label: 'Moderation',
    items: [
      { href: '/dashboard/reports', label: 'Reports', iconPath: ICONS.reports },
      { href: '/dashboard/audit-logs', label: 'Audit Logs', iconPath: ICONS.auditLogs },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/dashboard/notifications', label: 'Notifications', iconPath: ICONS.notifications },
      { href: '/dashboard/settings', label: 'Settings', customIcon: 'settings' },
      { href: '/dashboard/roles', label: 'Roles', iconPath: ICONS.roles },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const userRole = user?.role ?? 'ADMIN';

  const filteredGroups = NAV_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => canAccess(userRole, item.href)),
  })).filter(group => group.items.length > 0);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#0D1942]">
      <div className="flex h-14 items-center px-5 border-b border-white/10">
        <img src="/logo-white.png" alt="Uteo" className="h-7 w-auto object-contain" />
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        {filteredGroups.map(group => (
          <div key={group.label}>
            <div className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/25 px-1">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2.5 px-2 py-1.5 text-sm transition-colors border-l-2 rounded-r-md',
                      active
                        ? 'border-[#F77B0F] text-white font-semibold'
                        : 'border-transparent text-white/50 hover:text-white/90'
                    )}
                  >
                    {item.customIcon === 'settings'
                      ? <SettingsIcon className={cn('shrink-0', active ? 'text-[#F77B0F]' : 'text-white/30')} />
                      : item.iconPath
                        ? <Icon path={item.iconPath} className={cn(active ? 'text-[#F77B0F]' : 'text-white/30')} />
                        : null}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-3 text-[10px] text-white/20 tracking-widest uppercase">Uteo v1.0</div>
    </aside>
  );
}
