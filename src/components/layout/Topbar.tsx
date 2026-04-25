'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/theme';

export function Topbar() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();

  const logout = () => {
    localStorage.removeItem('uteo-admin-token');
    localStorage.removeItem('uteo-admin-user');
    router.push('/login');
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-6">
      <h1 className="text-sm font-semibold text-fg">Uteo System Admin</h1>
      <div className="flex items-center gap-2">
        <button onClick={toggleTheme} className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-sm text-fg hover:bg-surface" title="Toggle theme">{theme === 'dark' ? 'Light' : 'Dark'}</button>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-brand-fg">AD</div>
          <span className="text-xs text-fg">Uteo Admin</span>
        </div>
        <button onClick={logout} className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-fg">Sign out</button>
      </div>
    </header>
  );
}
