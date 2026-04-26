'use client';
import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';

const COLORS = ['#F77B0F', '#10B981', '#8B5CF6', '#06B6D4', '#F43F5E', '#F59E0B', '#34D399', '#FB923C'];
const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--card-foreground)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  padding: '8px 12px',
  fontSize: 12,
};

interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

function ChartCard({ title, subtitle, children, className = '' }: ChartCardProps) {
  return (
    <div className={`bg-card rounded-xl border border-border p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="font-semibold text-card-foreground">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/* ── LineTrend (area chart) ──────────────────────────────── */
interface LineTrendProps {
  title: string;
  subtitle?: string;
  data: { date: string; value: number }[];
  color?: string;
  name?: string;
  height?: number;
  className?: string;
}
export function LineTrend({ title, subtitle, data, color = '#F77B0F', name = 'Value', height = 300, className }: LineTrendProps) {
  const gradientId = `grad-lt-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      {!data.length ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill={`url(#${gradientId})`} name={name} dot={false} activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: 'var(--card)' }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ── BarTrend (single-series vertical bar) ───────────────── */
interface BarTrendProps {
  title: string;
  subtitle?: string;
  data: { date: string; value: number }[];
  color?: string;
  name?: string;
  height?: number;
  className?: string;
}
export function BarTrend({ title, subtitle, data, color = '#F77B0F', name = 'Value', height = 300, className }: BarTrendProps) {
  const gradientId = `grad-bt-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      {!data.length ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barCategoryGap="35%">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={color} stopOpacity={0.45} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.25 }} />
            <Bar dataKey="value" fill={`url(#${gradientId})`} radius={[5, 5, 0, 0]} name={name} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ── ColorBar (single-series bar, each bar its own color) ─── */
interface ColorBarProps {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  colors?: string[];
  height?: number;
  className?: string;
}
export function ColorBar({ title, subtitle, data, colors = COLORS, height = 280, className }: ColorBarProps) {
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      {!data.length ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.2 }} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={52} name="Count">
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ── MultiBar (grouped bar — multiple series) ────────────── */
interface MultiBarSeries { key: string; name: string; color: string; }
interface MultiBarProps {
  title: string;
  subtitle?: string;
  data: Record<string, unknown>[];
  series: MultiBarSeries[];
  xKey?: string;
  height?: number;
  className?: string;
}
export function MultiBar({ title, subtitle, data, series, xKey = 'name', height = 280, className }: MultiBarProps) {
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      {!data.length ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} barCategoryGap="25%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.15 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(val: string) => <span style={{ color: 'var(--card-foreground)' }}>{val}</span>} />
            {series.map(s => (
              <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={32} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ── HorizBar (horizontal bar — funnels, rankings) ───────── */
interface HorizBarProps {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  colors?: string[];
  height?: number;
  className?: string;
}
export function HorizBar({ title, subtitle, data, colors = COLORS, height = 280, className }: HorizBarProps) {
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      {!data.length ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart layout="vertical" data={data} margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={96} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.15 }} />
            <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={24} name="Count">
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ── LineSeries (multi-line) ─────────────────────────────── */
interface LineSeriesItem { key: string; name: string; color: string; }
interface LineSeriesProps {
  title: string;
  subtitle?: string;
  data: Record<string, unknown>[];
  series: LineSeriesItem[];
  xKey?: string;
  height?: number;
  className?: string;
}
export function LineSeries({ title, subtitle, data, series, xKey = 'date', height = 300, className }: LineSeriesProps) {
  if (!data.length) return null;
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {series.map(s => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} name={s.name} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ── PieBreakdown (solid pie — no donut hole) ─────────────── */
interface PieBreakdownProps {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  colors?: string[];
  height?: number;
  className?: string;
}
export function PieBreakdown({ title, subtitle, data, colors = COLORS, height = 280, className }: PieBreakdownProps) {
  const filtered = data.filter(d => d.value > 0);
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      {!filtered.length ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={filtered}
              cx="50%"
              cy="45%"
              innerRadius={0}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              nameKey="name"
              label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
              labelLine={false}
              stroke="none"
            >
              {filtered.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value: string) => <span style={{ color: 'var(--card-foreground)' }}>{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

/* ── DonutBreakdown (kept for compatibility — now solid pie) */
export function DonutBreakdown(props: PieBreakdownProps) {
  return <PieBreakdown {...props} />;
}

/* ── BarCompare (kept for compatibility — alias for ColorBar) */
export function BarCompare(props: ColorBarProps) {
  return <ColorBar {...props} />;
}

export { COLORS };
