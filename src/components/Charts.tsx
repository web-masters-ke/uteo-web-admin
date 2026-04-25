'use client';
import React from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';

const COLORS = ['#7C3AED', '#F43F5E', '#F59E0B', '#10B981', '#06B6D4', '#8B5CF6', '#FB923C', '#34D399'];
const tooltipStyle = {
  backgroundColor: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  color: 'var(--card-foreground)',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  padding: '8px 12px',
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

/* ---------- LineTrend (Area chart with gradient fill) ---------- */
interface LineTrendProps {
  title: string;
  subtitle?: string;
  data: { date: string; value: number }[];
  color?: string;
  name?: string;
  height?: number;
  className?: string;
}

export function LineTrend({ title, subtitle, data, color = '#192C67', name = 'Value', height = 300, className }: LineTrendProps) {
  if (!data.length) return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
    </ChartCard>
  );
  const gradientId = `gradient-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            fill={`url(#${gradientId})`}
            name={name}
            dot={false}
            activeDot={{ r: 5, stroke: color, strokeWidth: 2, fill: 'var(--card)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---------- BarTrend (bar chart variant for single-series trends) ---------- */
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
  if (!data.length) return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
    </ChartCard>
  );
  const gradientId = `bar-trend-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
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
          <Tooltip
            contentStyle={tooltipStyle}
            cursor={{ fill: 'var(--muted)', opacity: 0.25 }}
          />
          <Bar dataKey="value" fill={`url(#${gradientId})`} radius={[5, 5, 0, 0]} name={name} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---------- LineSeries (multi-line) ---------- */
interface LineSeriesItem {
  key: string;
  name: string;
  color: string;
}

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
          {series.map((s) => (
            <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} name={s.name} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---------- BarCompare (bar chart with gradient fill) ---------- */
interface BarCompareProps {
  title: string;
  subtitle?: string;
  data: { date: string; value: number }[];
  color?: string;
  name?: string;
  height?: number;
  className?: string;
}

export function BarCompare({ title, subtitle, data, color = '#F77B0F', name = 'Value', height = 300, className }: BarCompareProps) {
  if (!data.length) return null;
  const gradientId = `bar-gradient-${title.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.9} />
              <stop offset="95%" stopColor={color} stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.3 }} />
          <Bar dataKey="value" fill={`url(#${gradientId})`} radius={[6, 6, 0, 0]} name={name} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ---------- DonutBreakdown (pie/donut chart) ---------- */
interface DonutBreakdownProps {
  title: string;
  subtitle?: string;
  data: { name: string; value: number }[];
  colors?: string[];
  height?: number;
  className?: string;
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number; name: string;
}) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function DonutBreakdown({ title, subtitle, data, colors = COLORS, height = 300, className }: DonutBreakdownProps) {
  const filtered = data.filter(d => d.value > 0);
  if (!filtered.length) return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>No data yet</div>
    </ChartCard>
  );
  return (
    <ChartCard title={title} subtitle={subtitle} className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
            label={renderCustomLabel}
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
    </ChartCard>
  );
}

export { COLORS };
