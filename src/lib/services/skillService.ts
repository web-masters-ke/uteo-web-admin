import api, { unwrap } from '../api';
import { Skill, SkillLevel, SkillDemand, TrainerType } from '../types';

export interface SkillData {
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  categoryId?: string;
  trainerType?: TrainerType;
  level?: SkillLevel;
  demand?: SkillDemand;
  tags?: string[];
  isActive?: boolean;
}

export const skillService = {
  getAll: async (): Promise<Skill[]> => {
    const res = await api.get('/skills');
    const data = unwrap<Skill[] | { items: Skill[]; total: number }>(res);
    if (Array.isArray(data)) return data;
    return data.items;
  },
  create: async (data: SkillData): Promise<Skill> => { const res = await api.post('/skills', data); return unwrap<Skill>(res); },
  update: async (id: string, data: Partial<SkillData>): Promise<Skill> => { const res = await api.patch(`/skills/${id}`, data); return unwrap<Skill>(res); },
  delete: async (id: string): Promise<void> => { await api.delete(`/skills/${id}`); },
  toggleActive: async (id: string, isActive: boolean): Promise<Skill> => {
    const res = await api.patch(`/skills/${id}`, { isActive });
    return unwrap<Skill>(res);
  },
};
