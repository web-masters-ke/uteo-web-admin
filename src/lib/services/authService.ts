import api, { unwrap } from '../api';
import { LoginRequest, LoginResponse, ChangePasswordRequest, User } from '../types';

export const authService = {
  login: async (data: LoginRequest): Promise<LoginResponse> => { const res = await api.post('/auth/login', data); return unwrap<LoginResponse>(res); },
  me: async (): Promise<User> => { const res = await api.get('/auth/me'); return unwrap<User>(res); },
  changePassword: async (data: ChangePasswordRequest): Promise<void> => { await api.post('/auth/change-password', data); },
  logout: async (): Promise<void> => { try { await api.post('/auth/logout'); } catch { /* ignore */ } },
};
