'use client';
import React from 'react';

export interface Column<T> { key: string; label: string; sortable?: boolean; render?: (item: T) => React.ReactNode; className?: string; }

interface Props<T> { columns: Column<T>[]; data: T[]; loading?: boolean; page?: number; totalPages?: number; total?: number; onPageChange?: (p: number) => void; onRowClick?: (item: T) => void; keyExtractor?: (item: T) => string; emptyMessage?: string; }

export function DataTable<T>({ columns, data, loading, page = 1, totalPages = 1, total = 0, onPageChange, onRowClick, keyExtractor, emptyMessage = 'No data found' }: Props<T>) {
  if (loading) {
    return (
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full"><thead><tr className="bg-muted">{columns.map((c) => <th key={c.key} className="px-4 py-3"><div className="h-4 bg-muted-foreground/20 rounded w-20 animate-pulse" /></th>)}</tr></thead>
        <tbody>{Array.from({ length: 5 }, (_, i) => <tr key={i} className="bg-card border-t border-border">{columns.map((c) => <td key={c.key} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>)}</tr>)}</tbody></table>
      </div>
    );
  }
  if (data.length === 0) {
    return <div className="flex flex-col items-center justify-center py-16"><svg className="w-16 h-16 text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg><p className="text-muted-foreground text-sm">{emptyMessage}</p></div>;
  }
  return (
    <div className="w-full">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead><tr className="bg-muted">{columns.map((col) => <th key={col.key} className={`px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap ${col.className || ''}`}>{col.label}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">
            {data.map((item) => (
              <tr key={keyExtractor ? keyExtractor(item) : String((item as any).id ?? Math.random())} className={`bg-card hover:bg-muted/50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`} onClick={onRowClick ? () => onRowClick(item) : undefined}>
                {columns.map((col) => <td key={col.key} className={`px-4 py-3 whitespace-nowrap ${col.className || ''}`}>{col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">Page {page} of {totalPages} ({total} total)</span>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} className="px-3 py-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">Prev</button>
            <button disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)} className="px-3 py-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
