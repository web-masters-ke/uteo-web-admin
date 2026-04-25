'use client';

import React from 'react';
import { ThemeProvider } from '@/lib/theme';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/lib/toast';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
