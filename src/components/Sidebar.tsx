'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';

const NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { label: 'Command Centre', href: '/dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z' },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { label: 'Courses', href: '/dashboard/courses', icon: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z' },
      { label: 'Skill Tree', href: '/dashboard/skills', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' },
      { label: 'KYC & Verification', href: '/dashboard/verifications', icon: 'M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2' },
      { label: 'Moderation', href: '/dashboard/moderation', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z' },
    ],
  },
  {
    label: 'Community',
    items: [
      { label: 'Clients', href: '/dashboard/users', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { label: 'Org & Individual Instructors', href: '/dashboard/trainers', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' },
    ],
  },
  {
    label: 'Sessions',
    items: [
      { label: 'Bookings', href: '/dashboard/bookings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { label: 'Escrow Hold', href: '/dashboard/escrow', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { label: 'Ratings & Reviews', href: '/dashboard/reviews', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
      { label: 'Disputes', href: '/dashboard/disputes', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
      { label: 'SLA Management', href: '/dashboard/sla', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Wallets', href: '/dashboard/wallets', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
      { label: 'Ledger', href: '/dashboard/transactions', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { label: 'Payments', href: '/dashboard/payments', icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
      { label: 'Commissions', href: '/dashboard/commissions', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { label: 'Plans & Billing', href: '/dashboard/subscriptions', icon: 'M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z' },
      { label: 'Reconciliation', href: '/dashboard/reconciliation', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
      { label: 'Financials', href: '/dashboard/financials', icon: 'M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z' },
      { label: 'Invoices', href: '/dashboard/invoices', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
  {
    label: 'Recruitment',
    items: [
      { label: 'Jobs', href: '/dashboard/jobs', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { label: 'Companies', href: '/dashboard/companies', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
      { label: 'Applications', href: '/dashboard/applications', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Broadcasts', href: '/dashboard/notifications', icon: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z' },
      { label: 'Activity Log', href: '/dashboard/audit-logs', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
      { label: 'Insights', href: '/dashboard/analytics', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
      { label: 'Platform Health', href: '/dashboard/system', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
      { label: 'AI Engine', href: '/dashboard/ai-control', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
      { label: 'Access Control', href: '/dashboard/roles', icon: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' },
    ],
  },
];

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const userRole = user?.role ?? 'ADMIN';

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(href);

  const allItems = NAV_GROUPS.flatMap(g => g.items);
  const filteredGroups = NAV_GROUPS.map(g => ({
    ...g,
    items: g.items.filter(item => canAccess(userRole, item.href)),
  })).filter(g => g.items.length > 0);

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-30 p-2 rounded-lg border border-white/20 text-white lg:hidden"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>

      <aside className={`fixed top-0 left-0 h-full bg-white dark:bg-[#0D1942] border-r border-gray-100 dark:border-white/10 z-50 flex flex-col transition-all duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${collapsed ? 'w-16' : 'w-64'}`}>

        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100 dark:border-white/10 shrink-0">
          {!collapsed && (
            <Link href="/dashboard">
              <img src="/skillsasa-logo.png" alt="SkillSasa" className="h-7 w-auto object-contain dark:hidden" />
              <img src="/logo-white.png" alt="SkillSasa" className="hidden h-7 w-auto object-contain dark:block" />
            </Link>
          )}
          {collapsed && (
            <Link href="/dashboard">
              <img src="/skillsasa-logo.png" alt="SkillSasa" className="h-6 w-6 object-contain object-left dark:hidden" />
              <img src="/logo-white.png" alt="SkillSasa" className="hidden h-6 w-6 object-contain object-left dark:block" />
            </Link>
          )}
          <button onClick={onToggle} className="p-1.5 text-gray-300 dark:text-white/30 hover:text-gray-600 dark:hover:text-white transition-colors hidden lg:block">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={collapsed ? 'M13 5l7 7-7 7' : 'M11 19l-7-7 7-7'} /></svg>
          </button>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 text-gray-300 dark:text-white/30 hover:text-gray-600 dark:hover:text-white transition-colors lg:hidden">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-5 space-y-5 px-3">
          {filteredGroups.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <div className="mb-1.5 px-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 dark:text-white/25">{group.label}</div>
              )}
              <ul className="space-y-0.5">
                {group.items.map(item => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          active
                            ? 'bg-[#F77B0F]/10 dark:bg-[#F77B0F]/20 text-gray-900 dark:text-white font-semibold'
                            : 'text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          active ? 'bg-[#F77B0F] shadow-sm' : 'bg-[#F77B0F]/10 dark:bg-[#F77B0F]/15'
                        }`}>
                          <svg className={`w-4 h-4 ${active ? 'text-white' : 'text-[#F77B0F]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={item.icon} />
                          </svg>
                        </div>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-white/10 text-[10px] text-gray-300 dark:text-white/20 tracking-widest uppercase shrink-0">SkillSasa v2.0</div>
        )}
      </aside>
    </>
  );
}
