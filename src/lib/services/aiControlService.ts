import api, { unwrap } from '../api';

export interface RankingWeights {
  skill_match: number;
  rating: number;
  experience: number;
  completion_rate: number;
  availability: number;
  price: number;
}

export interface FraudFlag {
  id: string;
  user: string;
  userId: string;
  riskScore: number;
  flagReason: string;
  date: string;
  status: 'pending' | 'reviewed' | 'dismissed' | 'frozen';
}

export interface AiModuleConfig {
  rankingEngine: boolean;
  fraudDetection: boolean;
  reviewModeration: boolean;
  chatModeration: boolean;
  sessionTranscription: boolean;
}

export const DEFAULT_WEIGHTS: RankingWeights = {
  skill_match: 0.30,
  rating: 0.25,
  experience: 0.15,
  completion_rate: 0.15,
  availability: 0.10,
  price: 0.05,
};

export const DEFAULT_AI_CONFIG: AiModuleConfig = {
  rankingEngine: false,
  fraudDetection: false,
  reviewModeration: false,
  chatModeration: false,
  sessionTranscription: false,
};

export const aiControlService = {
  getRankingWeights: async (): Promise<RankingWeights> => {
    try {
      const res = await api.get('/admin/ai/ranking-weights');
      return unwrap<RankingWeights>(res);
    } catch {
      return { ...DEFAULT_WEIGHTS };
    }
  },

  saveRankingWeights: async (weights: RankingWeights): Promise<void> => {
    await api.post('/admin/ai/ranking-weights', weights);
  },

  getFraudFlags: async (): Promise<FraudFlag[]> => {
    try {
      const res = await api.get('/admin/ai/fraud-flags');
      const data = unwrap<any>(res);
      const items = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
      return items.map((f: any) => ({
        id: f.id,
        user: f.user ? `${f.user.firstName} ${f.user.lastName}` : (f.userName ?? f.userId ?? '-'),
        userId: f.userId ?? f.user?.id ?? '',
        riskScore: Number(f.riskScore ?? f.score ?? 0),
        flagReason: f.flagReason ?? f.reason ?? '-',
        date: f.createdAt ?? f.date ?? '',
        status: f.status ?? 'pending',
      }));
    } catch {
      return [];
    }
  },

  dismissFraudFlag: async (id: string): Promise<void> => {
    await api.patch(`/admin/ai/fraud-flags/${id}/dismiss`);
  },

  reviewFraudFlag: async (id: string): Promise<void> => {
    await api.patch(`/admin/ai/fraud-flags/${id}/review`);
  },

  freezeWallet: async (userId: string): Promise<void> => {
    await api.patch(`/admin/ai/fraud-flags/freeze-wallet`, { userId });
  },

  getAiConfig: async (): Promise<AiModuleConfig> => {
    try {
      const res = await api.get('/admin/ai/config');
      return unwrap<AiModuleConfig>(res);
    } catch {
      return { ...DEFAULT_AI_CONFIG };
    }
  },

  saveAiConfig: async (config: AiModuleConfig): Promise<void> => {
    await api.post('/admin/ai/config', config);
  },
};
