'use client';
import React from 'react';

export function StatsCard({ label, value, icon, trend, subtitle }: { label: string; value: string | number; icon: React.ReactNode; trend?: { value: number; isUp: boolean }; subtitle?: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 text-card-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          {trend && <p className={`text-sm mt-2 ${trend.isUp ? 'text-green-500' : 'text-red-500'}`}>{trend.isUp ? '+' : ''}{trend.value}%</p>}
        </div>
        <div className="p-3 rounded-lg bg-primary-500/10 text-primary-500">{icon}</div>
      </div>
    </div>
  );
}
