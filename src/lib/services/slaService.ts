import api, { unwrap } from '../api';

export type EscalationRole = 'SUPPORT' | 'ADMIN' | 'FINANCE_ADMIN' | 'SUPER_ADMIN';

export interface SlaPolicy {
  id: string;
  name: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  firstResponseHours: number;
  resolutionHours: number;
  warningPercent: number;
  autoEscalate: boolean;
  isActive: boolean;
  warningNotifyRole: EscalationRole;
  firstResponseEscalateTo: EscalationRole;
  resolutionEscalateTo: EscalationRole;
  createdAt: string;
  createdBy?: { id: string; firstName: string; lastName: string };
  _count?: { assignments: number };
}

export interface SlaAssignment {
  id: string;
  disputeId: string;
  policyId: string;
  status: 'ACTIVE' | 'WARNING' | 'BREACHED' | 'MET' | 'PAUSED';
  firstResponseDue: string;
  resolutionDue: string;
  firstResponseAt?: string;
  firstResponseBreached: boolean;
  resolutionBreached: boolean;
  resolvedAt?: string;
  pausedAt?: string;
  pausedDurationMins: number;
  warningSentAt?: string;
  createdAt: string;
  policy?: SlaPolicy;
  dispute?: {
    id: string;
    reason: string;
    status: string;
    createdAt: string;
    raisedBy?: { id: string; firstName: string; lastName: string };
    against?: { id: string; firstName: string; lastName: string };
  };
  escalations?: SlaEscalation[];
  statusSnapshot?: SlaStatusSnapshot;
}

export interface SlaEscalation {
  id: string;
  assignmentId: string;
  reason: string;
  escalatedTo: string;
  createdAt: string;
}

export interface SlaStatusSnapshot {
  status: string;
  firstResponsePercent: number;
  resolutionPercent: number;
  firstResponseBreached?: boolean;
  resolutionBreached?: boolean;
  firstResponseOverdueByMins?: number;
  resolutionOverdueByMins?: number;
  minutesRemaining?: number;
  isBreached: boolean;
}

export interface SlaDashboard {
  active: number;
  breached: number;
  met: number;
  warning: number;
  paused: number;
  total: number;
  complianceRate: number | null;
}

export interface SlaReport {
  summary: {
    total: number;
    met: number;
    breached: number;
    active: number;
    paused: number;
    complianceRate: number | null;
  };
  byPolicy: Array<{ id: string; name: string; priority: string; count: number }>;
  from: string | null;
  to: string | null;
}

export interface AssignmentsResponse {
  items: SlaAssignment[];
  total: number;
  page: number;
  totalPages: number;
}

const BASE = '/sla';

export const slaService = {
  // Policies
  getPolicies: () => api.get(`${BASE}/policies`).then(r => unwrap<SlaPolicy[]>(r)),
  getPolicy: (id: string) => api.get(`${BASE}/policies/${id}`).then(r => unwrap<SlaPolicy>(r)),
  createPolicy: (dto: Partial<SlaPolicy>) => api.post(`${BASE}/policies`, dto).then(r => unwrap<SlaPolicy>(r)),
  updatePolicy: (id: string, dto: Partial<SlaPolicy>) => api.patch(`${BASE}/policies/${id}`, dto).then(r => unwrap<SlaPolicy>(r)),
  deletePolicy: (id: string) => api.delete(`${BASE}/policies/${id}`).then(r => unwrap<SlaPolicy>(r)),

  // Assignments
  getAssignments: (page = 1, limit = 20, status?: string) => {
    const params: any = { page, limit };
    if (status) params.status = status;
    return api.get(`${BASE}/assignments`, { params }).then(r => unwrap<AssignmentsResponse>(r));
  },
  assignToDispute: (disputeId: string, policyId: string) =>
    api.post(`${BASE}/assignments`, { disputeId, policyId }).then(r => unwrap<SlaAssignment>(r)),
  pauseAssignment: (id: string) => api.post(`${BASE}/assignments/${id}/pause`).then(r => unwrap<SlaAssignment>(r)),
  resumeAssignment: (id: string) => api.post(`${BASE}/assignments/${id}/resume`).then(r => unwrap<SlaAssignment>(r)),

  // Dashboard & Reports
  getDashboard: () => api.get(`${BASE}/dashboard`).then(r => unwrap<SlaDashboard>(r)),
  getReport: (from?: string, to?: string) => {
    const params: any = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return api.get(`${BASE}/reports`, { params }).then(r => unwrap<SlaReport>(r));
  },
};
