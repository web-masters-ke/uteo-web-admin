import api, { unwrap } from '../api';
import { PlatformSettings, User } from '../types';

const DEFAULT_SETTINGS: PlatformSettings = {
  appName: 'SkillSasa',
  supportEmail: 'support@skillsasa.co.ke',
  defaultCommissionRate: 10,
  currency: 'KES',
  maintenanceMode: false,
};

export const settingsService = {
  getSettings: async (): Promise<PlatformSettings> => {
    try {
      const res = await api.get('/admin/settings');
      return unwrap<PlatformSettings>(res);
    } catch {
      // Endpoint may not exist yet -- return defaults
      return DEFAULT_SETTINGS;
    }
  },
  updateSettings: async (data: Partial<PlatformSettings>): Promise<PlatformSettings> => {
    const res = await api.patch('/admin/settings', data);
    return unwrap<PlatformSettings>(res);
  },
  updateProfile: async (data: { firstName?: string; lastName?: string; email?: string; phone?: string }): Promise<User> => {
    const res = await api.patch('/users/me', data);
    return unwrap<User>(res);
  },
};
