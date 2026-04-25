'use client';
import React from 'react';

export function RatingStars({ rating, size = 'md' }: { rating: number | string | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const r = Number(rating || 0);
  const s = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6' };
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => <svg key={i} className={`${s[size]} ${i < Math.floor(r) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} fill={i < Math.floor(r) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>)}
      <span className="ml-1 text-sm text-muted-foreground">{r.toFixed(1)}</span>
    </div>
  );
}
