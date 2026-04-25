'use client';
import React from 'react';
import Link from 'next/link';

interface BreadcrumbItem { label: string; href?: string; }

export function PageHeader({ title, breadcrumbs, actions }: { title: string; breadcrumbs?: BreadcrumbItem[]; actions?: React.ReactNode }) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          {breadcrumbs.map((item, i) => (
            <React.Fragment key={i}>
              {i > 0 && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
              {item.href ? <Link href={item.href} className="hover:text-foreground transition-colors">{item.label}</Link> : <span className="text-foreground font-medium">{item.label}</span>}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-card-foreground">{title}</h1>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
