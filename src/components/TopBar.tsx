'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { ThemeToggle } from './ThemeToggle';

export function TopBar() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }, []);

  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6">
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg><span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" /></button>
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen(!open)} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-muted">
            <div className="w-8 h-8 rounded-full bg-[#F77B0F] dark:bg-white/10 flex items-center justify-center text-white text-sm font-medium">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
            <div className="hidden md:block text-left"><p className="text-sm font-medium text-card-foreground leading-none">{user?.firstName} {user?.lastName}</p><p className="text-xs text-muted-foreground mt-0.5">{user?.role}</p></div>
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-48 bg-card rounded-lg border border-border shadow-lg py-1 z-50">
              <a href="/dashboard/settings" className="block px-4 py-2 text-sm text-card-foreground hover:bg-muted">Profile Settings</a>
              <hr className="my-1 border-border" />
              <button onClick={logout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-muted">Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
