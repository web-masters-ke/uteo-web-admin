'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: string; type: ToastType; message: string; }
interface ToastContextType { toasts: Toast[]; addToast: (type: ToastType, message: string) => void; removeToast: (id: string) => void; }

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const removeToast = useCallback((id: string) => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, []);
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => removeToast(id), 4000);
  }, [removeToast]);

  const colorMap: Record<ToastType, string> = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-amber-500', info: 'bg-blue-500' };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => (
            <div key={toast.id} className={`${colorMap[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
              <span className="text-sm flex-1">{toast.message}</span>
              <button onClick={() => removeToast(toast.id)} className="text-white/80 hover:text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
}
