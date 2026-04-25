'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, Column } from '@/components/DataTable';
import {
  aiControlService,
  RankingWeights,
  FraudFlag,
  AiModuleConfig,
  DEFAULT_WEIGHTS,
  DEFAULT_AI_CONFIG,
} from '@/lib/services/aiControlService';
import { useToast } from '@/lib/toast';
import { formatDateTime } from '@/lib/utils';

const WEIGHT_LABELS: Record<keyof RankingWeights, string> = {
  skill_match: 'Skill Match',
  rating: 'Rating',
  experience: 'Experience',
  completion_rate: 'Completion Rate',
  availability: 'Availability',
  price: 'Price',
};

const MODULE_LABELS: Record<keyof AiModuleConfig, string> = {
  rankingEngine: 'Ranking Engine',
  fraudDetection: 'Fraud Detection',
  reviewModeration: 'Review Moderation',
  chatModeration: 'Chat Moderation',
  sessionTranscription: 'Session Transcription',
};

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-[#F77B0F]' : 'bg-gray-300 dark:bg-gray-600'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function AiControlPage() {
  const { addToast } = useToast();

  // Weights
  const [weights, setWeights] = useState<RankingWeights>({ ...DEFAULT_WEIGHTS });
  const [weightsLoading, setWeightsLoading] = useState(true);
  const [weightsSaving, setWeightsSaving] = useState(false);

  // Fraud flags
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // AI module config
  const [aiConfig, setAiConfig] = useState<AiModuleConfig>({ ...DEFAULT_AI_CONFIG });
  const [configLoading, setConfigLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setWeightsLoading(true);
    setFlagsLoading(true);
    setConfigLoading(true);

    const [w, flags, cfg] = await Promise.all([
      aiControlService.getRankingWeights().catch(() => ({ ...DEFAULT_WEIGHTS })),
      aiControlService.getFraudFlags().catch(() => []),
      aiControlService.getAiConfig().catch(() => ({ ...DEFAULT_AI_CONFIG })),
    ]);

    setWeights(w);
    setWeightsLoading(false);
    setFraudFlags(flags);
    setFlagsLoading(false);
    setAiConfig(cfg);
    setConfigLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Weights ─────────────────────────────────────────────────────────────────
  const weightSum = Object.values(weights).reduce((s, v) => s + v, 0);
  const weightSumOk = Math.abs(weightSum - 1.0) < 0.005;

  const handleWeightChange = (key: keyof RankingWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: Math.round(value * 100) / 100 }));
  };

  const handleSaveWeights = async () => {
    if (!weightSumOk) {
      addToast('error', `Weights must sum to 1.0 (currently ${weightSum.toFixed(2)})`);
      return;
    }
    setWeightsSaving(true);
    try {
      await aiControlService.saveRankingWeights(weights);
      addToast('success', 'Ranking weights saved');
    } catch {
      addToast('error', 'Failed to save ranking weights');
    } finally {
      setWeightsSaving(false);
    }
  };

  // ── Fraud flags ─────────────────────────────────────────────────────────────
  const handleDismissFlag = async (flag: FraudFlag) => {
    setActionLoading(true);
    try {
      await aiControlService.dismissFraudFlag(flag.id);
      addToast('success', 'Flag dismissed');
      fetchAll();
    } catch {
      addToast('error', 'Failed to dismiss flag');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReviewFlag = async (flag: FraudFlag) => {
    setActionLoading(true);
    try {
      await aiControlService.reviewFraudFlag(flag.id);
      addToast('success', 'Flag marked as reviewed');
      fetchAll();
    } catch {
      addToast('error', 'Failed to review flag');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFreezeWallet = async (flag: FraudFlag) => {
    if (!flag.userId) { addToast('error', 'Cannot identify user'); return; }
    setActionLoading(true);
    try {
      await aiControlService.freezeWallet(flag.userId);
      addToast('success', `Wallet frozen for ${flag.user}`);
    } catch {
      addToast('error', 'Failed to freeze wallet');
    } finally {
      setActionLoading(false);
    }
  };

  const flagCols: Column<FraudFlag>[] = [
    { key: 'user', label: 'User', render: (f) => <span className="font-medium">{f.user}</span> },
    {
      key: 'riskScore',
      label: 'Risk Score',
      render: (f) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
          f.riskScore >= 80 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
          f.riskScore >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
          'bg-muted text-muted-foreground'
        }`}>
          {f.riskScore}
        </span>
      ),
    },
    { key: 'flagReason', label: 'Flag Reason', render: (f) => f.flagReason },
    {
      key: 'date',
      label: 'Date',
      render: (f) => <span className="text-xs text-muted-foreground">{formatDateTime(f.date)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (f) => (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          f.status === 'frozen' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
          f.status === 'reviewed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
          f.status === 'dismissed' ? 'bg-muted text-muted-foreground' :
          'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        }`}>
          {f.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (f) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); handleReviewFlag(f); }}
            disabled={actionLoading}
            className="px-2 py-1 text-xs rounded 0/10 text-blue-600 hover:0/20 transition-colors disabled:opacity-50"
          >
            Review
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleDismissFlag(f); }}
            disabled={actionLoading}
            className="px-2 py-1 text-xs rounded bg-muted hover:bg-muted/70 transition-colors text-muted-foreground disabled:opacity-50"
          >
            Dismiss
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleFreezeWallet(f); }}
            disabled={actionLoading}
            className="px-2 py-1 text-xs rounded bg-red-500/10 text-red-600 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            Freeze Wallet
          </button>
        </div>
      ),
    },
  ];

  // ── AI config ────────────────────────────────────────────────────────────────
  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await aiControlService.saveAiConfig(aiConfig);
      addToast('success', 'AI module configuration saved');
    } catch {
      addToast('error', 'Failed to save AI configuration');
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="AI Control Panel"
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'AI Control Panel' },
        ]}
      />

      {/* Info Banner */}
      <div className="flex items-start gap-3 mb-6 px-4 py-3 rounded-xl  border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400">
        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">
          AI services not yet active — configuration ready for when AI microservices are deployed. Settings saved here will be picked up automatically once the services come online.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* ── Ranking Weights ──────────────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-semibold text-card-foreground">Ranking Weights</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Values must sum to 1.0</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              weightSumOk ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              Sum: {weightSum.toFixed(2)}
            </span>
          </div>

          {weightsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(weights) as (keyof RankingWeights)[]).map((key) => (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-card-foreground">{WEIGHT_LABELS[key]}</span>
                    <span className="font-semibold text-[#F77B0F]">{(weights[key] * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights[key]}
                    onChange={(e) => handleWeightChange(key, parseFloat(e.target.value))}
                    className="w-full h-2 accent-[#F77B0F] cursor-pointer"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-border">
            <button
              onClick={handleSaveWeights}
              disabled={weightsSaving || weightsLoading || !weightSumOk}
              className="w-full py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              {weightsSaving ? 'Saving…' : 'Save Weights'}
            </button>
          </div>
        </div>

        {/* ── AI Module Toggles ─────────────────────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="mb-5">
            <h2 className="font-semibold text-card-foreground">AI Module Toggles</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Enable or disable individual AI services</p>
          </div>

          {configLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {(Object.keys(aiConfig) as (keyof AiModuleConfig)[]).map((key) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{MODULE_LABELS[key]}</p>
                    <p className="text-xs text-muted-foreground">
                      {aiConfig[key] ? 'Active' : 'Inactive — will activate when microservice is deployed'}
                    </p>
                  </div>
                  <Toggle
                    checked={aiConfig[key]}
                    onChange={(v) => setAiConfig((prev) => ({ ...prev, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 pt-4 border-t border-border">
            <button
              onClick={handleSaveConfig}
              disabled={configSaving || configLoading}
              className="w-full py-2 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
            >
              {configSaving ? 'Saving…' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Fraud Flags Table ─────────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-bold text-card-foreground mb-4">Fraud Flags</h2>
        <DataTable
          columns={flagCols}
          data={fraudFlags}
          loading={flagsLoading}
          keyExtractor={(f) => f.id}
          emptyMessage="No fraud flags detected"
        />
      </div>
    </div>
  );
}
