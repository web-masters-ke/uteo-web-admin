'use client';
import React, { useEffect, useRef } from 'react';

export function Modal({ isOpen, onClose, title, children, size = 'md' }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!isOpen) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', h); document.body.style.overflow = 'hidden'; return () => { document.removeEventListener('keydown', h); document.body.style.overflow = ''; }; }, [isOpen, onClose]);
  if (!isOpen) return null;
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === overlayRef.current && onClose()}>
      <div className={`w-full ${sizes[size]} bg-card rounded-xl shadow-2xl border border-border max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-card-foreground">{title}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
}
