'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { canAccess } from '@/lib/rbac';
import { Sidebar } from '@/components/Sidebar';
import { TopBar } from '@/components/TopBar';

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v.01M12 9v2m0 8a9 9 0 100-18 9 9 0 000 18z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm">You don&apos;t have permission to view this page. Contact your administrator for access.</p>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { if (!loading && !isAuthenticated) router.replace('/login'); }, [loading, isAuthenticated, router]);
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="w-8 h-8 border-4 border-[#F77B0F] border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return null;

  const userRole = user?.role ?? 'ADMIN';
  const hasAccess = canAccess(userRole, pathname);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`transition-all duration-300 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        <TopBar />
        <main className="p-4 lg:p-6">{hasAccess ? children : <AccessDenied />}</main>
      </div>
    </div>
  );
}
