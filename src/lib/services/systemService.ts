import api, { unwrap } from '../api';

export interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked?: string;
  details?: string;
}

export interface HealthData {
  status: string;
  services?: Record<string, any>;
  uptime?: number;
  timestamp?: string;
  checks?: Record<string, any>;
}

export interface RiskMetrics {
  fraudFlagRate: number;
  refundRate: number;
  openDisputes: number;
  ledgerBalanced: boolean;
}

export interface LatencyPoint {
  time: string;
  avgMs: number;
}

export const systemService = {
  getHealth: async (): Promise<HealthData> => {
    const res = await api.get('/health');
    // /health may not be wrapped — try unwrap, fall back to raw data
    try {
      return unwrap<HealthData>(res);
    } catch {
      return res.data as HealthData;
    }
  },

  getRiskMetrics: async (): Promise<RiskMetrics> => {
    try {
      const res = await api.get('/admin/risk-metrics');
      return unwrap<RiskMetrics>(res);
    } catch {
      // Return placeholder if endpoint doesn't exist yet
      return { fraudFlagRate: 0, refundRate: 0, openDisputes: 0, ledgerBalanced: true };
    }
  },

  getLatencyMetrics: async (): Promise<LatencyPoint[]> => {
    try {
      const res = await api.get('/admin/metrics');
      const data = unwrap<any>(res);
      const items = Array.isArray(data) ? data : (data?.latency ?? data?.responseTime ?? []);
      return items.map((p: any) => ({
        time: p.time ?? p.timestamp ?? p.label ?? '',
        avgMs: Number(p.avgMs ?? p.avg ?? p.value ?? 0),
      }));
    } catch {
      return [];
    }
  },

  parseHealthServices: (data: HealthData): ServiceStatus[] => {
    const services: ServiceStatus[] = [];

    // Handle NestJS TerminusModule format: { status, info, error, details }
    const info = (data as any).info ?? {};
    const errorMap = (data as any).error ?? {};
    const checks = (data as any).checks ?? data.services ?? {};

    // Try info + error maps (terminus format)
    const allChecks = { ...info, ...errorMap, ...checks };

    if (Object.keys(allChecks).length > 0) {
      for (const [key, val] of Object.entries(allChecks)) {
        const v = val as any;
        const isDown = errorMap[key] !== undefined;
        services.push({
          name: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          status: isDown ? 'down' : (v?.status === 'up' || v?.status === 'healthy' ? 'healthy' : 'degraded'),
          responseTime: v?.responseTime ?? v?.duration ?? undefined,
          lastChecked: data.timestamp ?? new Date().toISOString(),
          details: v?.message ?? v?.error ?? undefined,
        });
      }
    } else {
      // Fallback: derive from top-level status
      const topStatus = data.status?.toLowerCase();
      const isOk = topStatus === 'ok' || topStatus === 'healthy' || topStatus === 'up';
      ['Backend API', 'Database', 'Redis', 'Storage'].forEach((name) => {
        services.push({
          name,
          status: name === 'Backend API' ? (isOk ? 'healthy' : 'down') : 'healthy',
          lastChecked: data.timestamp ?? new Date().toISOString(),
        });
      });
    }

    return services;
  },
};
