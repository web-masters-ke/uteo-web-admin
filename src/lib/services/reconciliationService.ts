import api, { unwrap } from '../api';

export interface ReconciliationSummary {
  totalDebits: number;
  totalCredits: number;
  netBalance: number;
  commissionEarned: number;
  totalRefunds: number;
  isBalanced: boolean;
}

export interface ReconciliationEntry {
  id: string;
  date: string;
  transactionId: string;
  type: string;
  debit: number;
  credit: number;
  runningBalance: number;
  user: string;
}

export interface ReconciliationReport {
  summary: ReconciliationSummary;
  entries: ReconciliationEntry[];
  from: string;
  to: string;
}

export const reconciliationService = {
  getReport: async (from: string, to: string): Promise<ReconciliationReport> => {
    const p = new URLSearchParams({ from, to });
    const res = await api.get(`/admin/reconciliation?${p.toString()}`);
    return unwrap<ReconciliationReport>(res);
  },
};
