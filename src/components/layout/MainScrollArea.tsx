'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function ScrollResetter() {
  const pathname = usePathname();
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main.content-scroll');
    main?.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
