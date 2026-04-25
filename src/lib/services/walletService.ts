import api, { unwrap } from '../api';
import { Wallet, Transaction } from '../types';

export const walletService = {
  getAll: async (): Promise<Wallet[]> => {
    const res = await api.get('/wallet/admin/all'); return unwrap<Wallet[]>(res);
  },
  getByUser: async (userId: string): Promise<Wallet> => {
    const res = await api.get(`/wallet/${userId}`); return unwrap<Wallet>(res);
  },
  adminFund: async (userId: string, amount: number, description?: string): Promise<any> => {
    const res = await api.post('/wallet/admin/fund', { userId, amount, description }); return unwrap(res);
  },
  getTransactions: async (): Promise<Transaction[]> => {
    const res = await api.get('/wallet/admin/transactions'); return unwrap<Transaction[]>(res);
  },
};
