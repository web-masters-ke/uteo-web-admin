'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { systemService, ServiceStatus, RiskMetrics, LatencyPoint } from '@/lib/services/systemService';
import { useToast } from '@/lib/toast';
import { formatNumber } from '@/lib/utils';

const BRAND = { navy: '#F77B0F', orange: '#F77B0F', green: '#22c55e', red: '#ef4444', amber: '#f59e0b', sky: '#0ea5e9' };

// ── Inline mini line chart ────────────────────────────────────────────────────
function MiniLineChart({ data, color = BRAND.orange }: { data: LatencyPoint[]; color?: string }) {
  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
        Insufficient data
      </div>
    );
  }
  const values = data.map((p) => p.avgMs);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const W = 400;
  const H = 80;
  const points = data.map((p, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((p.avgMs - min) / range) * H;
    return `${x},${y}`;
  });
  const polyline = points.join(' ');
  const areaClose = `${W},${H} 0,${H}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={`${polyline} ${areaClose}`} fill="url(#chartGrad)" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ── Service Card ──────────────────────────────────────────────────────────────
function ServiceCard({ svc }: { svc: ServiceStatus }) {
  const isHealthy = svc.status === 'healthy';
  const isDegraded = svc.status === 'degraded';
  const dotColor = isHealthy ? BRAND.green : isDegraded ? BRAND.amber : BRAND.red;
  const label = isHealthy ? 'Healthy' : isDegraded ? 'Degraded' : 'Down';
  return (
    <div className={`bg-card rounded-xl border p-5 ${!isHealthy ? 'border-red-200 dark:border-red-800' : 'border-border'}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="font-semibold text-card-foreground text-sm">{svc.name}</p>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ background: `${dotColor}18`, color: dotColor }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full"
            style={{ background: dotColor, boxShadow: `0 0 0 3px ${dotColor}25` }}
          />
          {label}
        </span>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        {svc.responseTime !== undefined && (
          <p>Response time: <span className="font-medium text-card-foreground">{svc.responseTime}ms</span></p>
        )}
        {svc.lastChecked && (
          <p>Checked: <span className="font-medium text-card-foreground">{new Date(svc.lastChecked).toLocaleTimeString()}</span></p>
        )}
        {svc.details && <p className="text-red-500 dark:text-red-400 truncate" title={svc.details}>{svc.details}</p>}
      </div>
    </div>
  );
}

// ── Risk Stat Card ────────────────────────────────────────────────────────────
function RiskCard({ label, value, unit = '', highlight = false }: { label: string; value: string | number; unit?: string; highlight?: boolean }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold ${highlight ? 'text-red-500' : 'text-card-foreground'}`}>
        {value}{unit}
      </p>
    </div>
  );
}

export default function SystemHealthPage() {
  const { addToast } = useToast();
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [latency, setLatency] = useState<LatencyPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [healthData, risk, lat] = await Promise.all([
        systemService.getHealth().catch(() => ({ status: 'down' })),
        systemService.getRiskMetrics().catch(() => null),
        systemService.getLatencyMetrics().catch(() => []),
      ]);
      const parsedServices = systemService.parseHealthServices(healthData as any);
      setServices(parsedServices);
      setRiskMetrics(risk as RiskMetrics | null);
      setLatency(Array.isArray(lat) ? lat : []);
      setLastRefresh(new Date());
    } catch {
      addToast('error', 'Failed to load system health data');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Initial fetch
  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => { fetchAll(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const allHealthy = services.length > 0 && services.every((s) => s.status === 'healthy');
  const anyDown = services.some((s) => s.status === 'down');

  return (
    <div>
      <PageHeader
        title="Platform Health"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Platform Health' },
        ]}
        actions={
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted-foreground">
              {lastRefresh.toLocaleTimeString()} · auto every 30s
            </span>
            <button
              onClick={fetchAll}
              disabled={loading}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#F77B0F] hover:underline disabled:opacity-40 transition-opacity"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        }
      />

      {/* Overall status banner */}
      {!loading && (
        <div className={`flex items-center gap-3 mb-6 px-4 py-3 rounded-xl border text-sm font-medium ${
          anyDown
            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
            : allHealthy
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
        }`}>
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${anyDown ? 'bg-red-500' : allHealthy ? 'bg-green-500' : 'bg-amber-500'}`} />
          {anyDown ? 'One or more services are down.' : allHealthy ? 'All systems operational.' : 'Some services are degraded.'}
        </div>
      )}

      {/* Service Status Grid */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-card-foreground mb-4">Service Status</h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="bg-card rounded-xl border border-border p-5 h-28 animate-pulse" />
            ))}
          </div>
        ) : services.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {services.map((svc) => (
              <ServiceCard key={svc.name} svc={svc} />
            ))}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-muted-foreground text-sm">Could not load service status. Check backend connectivity.</p>
          </div>
        )}
      </section>

      {/* Platform Metrics */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-card-foreground mb-4">Platform Metrics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {riskMetrics ? (
            <>
              <RiskCard
                label="Pending Verifications"
                value={formatNumber(riskMetrics.pendingVerifications)}
                highlight={riskMetrics.pendingVerifications > 0}
              />
              <RiskCard
                label="Failed Notifications"
                value={formatNumber(riskMetrics.failedNotifications)}
                highlight={riskMetrics.failedNotifications > 0}
              />
              <RiskCard
                label="Open Applications"
                value={formatNumber(riskMetrics.openApplications)}
              />
              <RiskCard
                label="Active Jobs"
                value={formatNumber(riskMetrics.activeJobs)}
              />
            </>
          ) : (
            <>
              {['Pending Verifications', 'Failed Notifications', 'Open Applications', 'Active Jobs'].map((label) => (
                <div key={label} className="bg-card rounded-xl border border-border p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">{label}</p>
                  <p className="text-2xl font-bold text-muted-foreground">—</p>
                </div>
              ))}
            </>
          )}
        </div>
      </section>

      {/* API Latency Chart */}
      <section className="mb-8">
        <h2 className="text-base font-bold text-card-foreground mb-4">API Latency (last 24h)</h2>
        <div className="bg-card rounded-xl border border-border p-6">
          {latency.length > 1 ? (
            <>
              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                <span>{latency[0]?.time}</span>
                <span className="font-medium text-card-foreground">
                  Current: {latency[latency.length - 1]?.avgMs ?? 0}ms
                </span>
                <span>{latency[latency.length - 1]?.time}</span>
              </div>
              <MiniLineChart data={latency} color={BRAND.orange} />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Min: {Math.min(...latency.map((p) => p.avgMs))}ms</span>
                <span>Avg: {Math.round(latency.reduce((s, p) => s + p.avgMs, 0) / latency.length)}ms</span>
                <span>Max: {Math.max(...latency.map((p) => p.avgMs))}ms</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <svg className="w-10 h-10 text-muted-foreground/40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm text-muted-foreground">Latency metrics not available yet</p>
              <p className="text-xs text-muted-foreground mt-1">Will populate when <code className="font-mono bg-muted px-1 rounded">GET /admin/metrics</code> is available</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
