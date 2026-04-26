'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { StatsCard } from '@/components/StatsCard';
import { settingsService } from '@/lib/services/settingsService';
import { authService } from '@/lib/services/authService';
import { analyticsService, AdminDashboardData } from '@/lib/services/analyticsService';
import { commissionService } from '@/lib/services/commissionService';
import { subscriptionService } from '@/lib/services/subscriptionService';
import { PlatformSettings, CommissionRule, SubscriptionPlan } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function SettingsPage() {
  const { user, login } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState<'profile' | 'password' | 'platform'>('profile');

  // Profile state
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  // Password state
  const [pw, setPw] = useState({ current: '', new_: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  // Platform state
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  const [platformLoading, setPlatformLoading] = useState(true);

  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors';
  const readOnlyCls = 'w-full px-3 py-2.5 rounded-lg border border-border bg-muted text-muted-foreground text-sm cursor-not-allowed';

  // Load profile from user context
  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
      });
    }
  }, [user]);

  // Load platform data
  const fetchPlatformData = useCallback(async () => {
    setPlatformLoading(true);
    try {
      const [s, dashboard] = await Promise.all([
        settingsService.getSettings().catch(() => null),
        analyticsService.getDashboard().catch(() => null),
      ]);
      setSettings(s);
      setDashboardData(dashboard);

      // Try to load commission rules
      try {
        const cResult = await commissionService.getRules();
        setCommissionRules(Array.isArray(cResult) ? cResult : []);
      } catch { setCommissionRules([]); }

      // Try to load subscription plans
      try {
        const sResult = await subscriptionService.getPlans();
        setSubscriptionPlans(Array.isArray(sResult) ? sResult : (sResult as any)?.items || []);
      } catch { setSubscriptionPlans([]); }
    } catch { /* ignore */ }
    finally { setPlatformLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'platform') {
      fetchPlatformData();
    }
  }, [tab, fetchPlatformData]);

  // Save profile
  const saveProfile = async () => {
    if (!profile.firstName.trim() || !profile.lastName.trim()) {
      addToast('error', 'Name fields are required');
      return;
    }
    setProfileSaving(true);
    try {
      const updatedUser = await settingsService.updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone || undefined,
      });
      if (user) {
        login(localStorage.getItem('uteo-admin-token')!, { ...user, ...updatedUser });
      }
      addToast('success', 'Profile updated');
    } catch {
      addToast('error', 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // Change password
  const changePassword = async () => {
    if (!pw.current || !pw.new_) {
      addToast('error', 'All password fields are required');
      return;
    }
    if (pw.new_ !== pw.confirm) {
      addToast('error', 'New passwords do not match');
      return;
    }
    if (pw.new_.length < 8) {
      addToast('error', 'Password must be at least 8 characters');
      return;
    }
    setPwSaving(true);
    try {
      await authService.changePassword({ currentPassword: pw.current, newPassword: pw.new_ });
      addToast('success', 'Password changed successfully');
      setPw({ current: '', new_: '', confirm: '' });
    } catch {
      addToast('error', 'Failed to change password. Check your current password.');
    } finally {
      setPwSaving(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password: string): { label: string; color: string; width: string } => {
    if (!password) return { label: '', color: '', width: '0%' };
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: 'Weak', color: 'bg-red-500', width: '20%' };
    if (score <= 2) return { label: 'Fair', color: 'bg-amber-500', width: '40%' };
    if (score <= 3) return { label: 'Good', color: '0', width: '60%' };
    if (score <= 4) return { label: 'Strong', color: 'bg-green-500', width: '80%' };
    return { label: 'Very Strong', color: 'bg-green-600', width: '100%' };
  };

  const pwStrength = getPasswordStrength(pw.new_);

  const EyeIcon = ({ show }: { show: boolean }) => show ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  return (
    <div>
      <PageHeader title="Settings" breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]} />

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {(['profile', 'password', 'platform'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-muted-foreground hover:text-card-foreground'
            }`}
          >
            {t === 'profile' ? 'Profile' : t === 'password' ? 'Change Password' : 'Platform'}
          </button>
        ))}
      </div>

      {/* ==================== PROFILE TAB ==================== */}
      {tab === 'profile' && (
        <div className="max-w-2xl space-y-6">
          {/* Avatar Section */}
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Your Profile</h3>
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-primary-500/10 text-primary-500 flex items-center justify-center text-2xl font-bold">
                {user ? `${(user.firstName || '')[0] || ''}${(user.lastName || '')[0] || ''}`.toUpperCase() : '?'}
              </div>
              <div>
                <p className="font-semibold text-lg">{user?.firstName} {user?.lastName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-500/10 text-primary-500 mt-1">
                  {user?.role.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">First Name *</label>
                  <input
                    value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Last Name *</label>
                  <input
                    value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <input
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Phone</label>
                <input
                  value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  className={inputCls}
                  placeholder="+254..."
                />
              </div>
              <div className="flex justify-end pt-2 border-t border-border">
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  {profileSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                      Saving...
                    </>
                  ) : 'Save Profile'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PASSWORD TAB ==================== */}
      {tab === 'password' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-2">Change Password</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your current password and choose a new one. Password must be at least 8 characters.
            </p>

            <div className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Current Password *</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={pw.current}
                    onChange={(e) => setPw({ ...pw, current: e.target.value })}
                    placeholder="Enter your current password"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon show={showCurrent} />
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5">New Password *</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={pw.new_}
                    onChange={(e) => setPw({ ...pw, new_: e.target.value })}
                    placeholder="Minimum 8 characters"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon show={showNew} />
                  </button>
                </div>
                {/* Strength Indicator */}
                {pw.new_ && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pwStrength.color}`} style={{ width: pwStrength.width }} />
                      </div>
                      <span className="text-xs text-muted-foreground">{pwStrength.label}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-sm font-medium mb-1.5">Confirm New Password *</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                    placeholder="Re-enter new password"
                    className={`${inputCls} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <EyeIcon show={showConfirm} />
                  </button>
                </div>
                {pw.confirm && pw.new_ !== pw.confirm && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
                {pw.confirm && pw.new_ === pw.confirm && pw.confirm.length >= 8 && (
                  <p className="text-xs text-green-500 mt-1">Passwords match</p>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <button
                  onClick={changePassword}
                  disabled={pwSaving || !pw.current || !pw.new_ || pw.new_ !== pw.confirm || pw.new_.length < 8}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 dark:border-white/20 text-gray-700 dark:text-white/90 bg-transparent text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  {pwSaving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                      Changing...
                    </>
                  ) : 'Change Password'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PLATFORM TAB ==================== */}
      {tab === 'platform' && (
        <div className="space-y-6">
          {platformLoading ? (
            <div className="space-y-4">
              <div className="animate-pulse h-32 bg-card rounded-xl border border-border" />
              <div className="animate-pulse h-48 bg-card rounded-xl border border-border" />
            </div>
          ) : (
            <>
              {/* System Stats */}
              {dashboardData && (
                <div>
                  <h3 className="font-semibold mb-4">System Statistics</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <StatsCard
                      label="Total Users"
                      value={formatNumber(dashboardData.totalUsers)}
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>}
                    />
                    <StatsCard
                      label="Total Recruiters"
                      value={formatNumber(dashboardData.totalTrainers)}
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                    />
                    <StatsCard
                      label="Total Applications"
                      value={formatNumber(dashboardData.totalBookings)}
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                    />
                    <StatsCard
                      label="Total Revenue"
                      value={formatCurrency(Number(dashboardData.totalRevenue) || 0)}
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1" /></svg>}
                    />
                    <StatsCard
                      label="Verified Recruiters"
                      value={formatNumber(dashboardData.verifiedTrainers)}
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
                    />
                    <StatsCard
                      label="Active Jobs"
                      value={formatNumber(dashboardData.activeEscrows)}
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
                    />
                    <StatsCard
                      label="Hired Candidates"
                      value={formatNumber(dashboardData.completedBookings)}
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                    />
                    <StatsCard
                      label="Companies"
                      value={formatNumber(dashboardData.activeSubscriptions)}
                      icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                    />
                  </div>
                </div>
              )}

              {/* Platform Configuration */}
              <div className="bg-card rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Platform Configuration</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Read-only</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Platform settings are managed at the infrastructure level. Contact a super admin to request changes.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">App Name</label>
                    <input value={settings?.appName || 'Uteo'} readOnly className={readOnlyCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Support Email</label>
                    <input value={settings?.supportEmail || 'support@uteo.com'} readOnly className={readOnlyCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Platform Fee Rate</label>
                    <input value={`${settings?.defaultCommissionRate ?? 0}%`} readOnly className={readOnlyCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Currency</label>
                    <input value={settings?.currency || 'KES'} readOnly className={readOnlyCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Maintenance Mode</label>
                    <input
                      value={settings?.maintenanceMode ? 'Enabled' : 'Disabled'}
                      readOnly
                      className={`${readOnlyCls} ${settings?.maintenanceMode ? 'text-red-500' : ''}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5">Platform Version</label>
                    <input value="v1.0.0" readOnly className={readOnlyCls} />
                  </div>
                </div>
              </div>

              {/* Billing Rules */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">Billing Rules</h3>
                {commissionRules.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Name</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Range</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Rate</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Tier</th>
                          <th className="text-left py-2 px-3 text-muted-foreground font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {commissionRules.map(rule => (
                          <tr key={rule.id}>
                            <td className="py-2.5 px-3 font-medium">{rule.name}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              {formatCurrency(Number(rule.minAmount))} - {formatCurrency(Number(rule.maxAmount))}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-primary-500">
                              {Number(rule.commissionRate || rule.rate)}%
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">{rule.subscriptionTier || '-'}</td>
                            <td className="py-2.5 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                rule.isActive
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                              }`}>
                                {rule.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No billing rules configured yet.</p>
                )}
              </div>

              {/* Recruiter Plans */}
              <div className="bg-card rounded-xl border border-border p-6">
                <h3 className="font-semibold mb-4">Recruiter Plans</h3>
                {subscriptionPlans.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subscriptionPlans.map(plan => (
                      <div key={plan.id} className={`p-4 rounded-lg border ${plan.isActive ? 'border-primary-500/50 bg-primary-500/5' : 'border-border bg-muted/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm">{plan.name}</h4>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            plan.isActive
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                          }`}>
                            {plan.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-primary-500">
                          {formatCurrency(Number(plan.price))}
                          <span className="text-xs font-normal text-muted-foreground">/{plan.durationDays}d</span>
                        </p>
                        {plan.description && (
                          <p className="text-xs text-muted-foreground mt-2">{plan.description}</p>
                        )}
                        {plan.features && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Features</p>
                            {Array.isArray(plan.features) ? (
                              <ul className="space-y-1">
                                {(plan.features as string[]).map((f, i) => (
                                  <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                                    <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    {f}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-muted-foreground">Custom feature set</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No recruiter plans configured yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
