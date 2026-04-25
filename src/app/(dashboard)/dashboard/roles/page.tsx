'use client';
import { useState } from 'react';

const ROLES = [
  { name: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Full access to everything', color: 'text-red-500', count: 1 },
  { name: 'ADMIN', label: 'Admin', desc: 'Manage users, trainers, content and operations', color: 'text-orange-500', count: 3 },
  { name: 'FINANCE_ADMIN', label: 'Finance Admin', desc: 'Wallets, payments, reconciliation, escrow', color: 'text-blue-500', count: 2 },
  { name: 'SUPPORT', label: 'Support', desc: 'View users, bookings, reviews and disputes', color: 'text-green-500', count: 5 },
  { name: 'ANALYST', label: 'Analyst', desc: 'Read-only access to analytics and reports', color: 'text-purple-500', count: 2 },
];

const PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ['All permissions'],
  ADMIN: ['Manage users', 'Manage trainers', 'Manage courses', 'Manage bookings', 'Manage disputes', 'Manage skills', 'Manage verifications', 'Send notifications', 'Moderation'],
  FINANCE_ADMIN: ['View wallets', 'Process payments', 'View transactions', 'Reconciliation', 'View escrow', 'View commissions', 'View subscriptions'],
  SUPPORT: ['View users', 'View trainers', 'View bookings', 'View disputes', 'View reviews', 'View notifications'],
  ANALYST: ['View analytics', 'View reports', 'Export data'],
};

export default function RolesPage() {
  const [selected, setSelected] = useState('SUPER_ADMIN');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 dark:text-white">Access Control</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage roles and what each role can access across the platform.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role list */}
        <div className="space-y-2">
          {ROLES.map(role => (
            <button
              key={role.name}
              onClick={() => setSelected(role.name)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                selected === role.name
                  ? 'border-[#F77B0F] bg-orange-50 dark:bg-orange-500/10'
                  : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-sm font-bold ${selected === role.name ? 'text-[#F77B0F]' : 'text-gray-700 dark:text-gray-300'}`}>{role.label}</span>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-white/10 px-2 py-0.5 rounded-full">{role.count}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate">{role.desc}</p>
            </button>
          ))}
        </div>

        {/* Permissions panel */}
        <div className="lg:col-span-2 border border-gray-200 dark:border-white/10 rounded-xl p-6">
          {(() => {
            const role = ROLES.find(r => r.name === selected)!;
            return (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                    <svg className={`w-5 h-5 ${role.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-gray-900 dark:text-white">{role.label}</h2>
                    <p className="text-sm text-gray-400">{role.desc}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {PERMISSIONS[selected].map(perm => (
                    <div key={perm} className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                      <svg className="w-4 h-4 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{perm}</span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
