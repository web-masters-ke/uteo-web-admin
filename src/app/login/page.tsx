'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { authService } from '@/lib/services/authService';
import { useToast } from '@/lib/toast';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { addToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const response = await authService.login({ email, password });
      login(response.accessToken, response.user);
      addToast('success', 'Login successful');
      router.push('/dashboard');
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Invalid credentials';
      addToast('error', message);
    } finally {
      setLoading(false);
    }
  };

  const ic = "w-full px-4 py-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#F77B0F] focus:border-[#F77B0F] outline-none text-sm transition-all";

  return (
    <div className="min-h-screen relative flex items-center justify-center">

      {/* Full-bleed background — image visible */}
      <img
        src="https://plus.unsplash.com/premium_photo-1664300108565-fdd8a6132123?auto=format&fit=crop&w=2400&q=90"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Light tint */}
      <div className="absolute inset-0 bg-[#060f22]/55" />

      {/* Centred login card — solid dark so form is razor sharp */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div
          className="rounded-2xl border border-black/8 shadow-2xl shadow-black/40 p-10"
          style={{ background: 'rgba(255,252,245,0.97)', backdropFilter: 'blur(24px)' }}
        >
          {/* Shield icon */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#F77B0F]/15 border border-[#F77B0F]/30 flex items-center justify-center">
              <svg className="w-7 h-7 text-[#F77B0F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-black text-gray-900 text-center mb-1">Admin Login</h1>
          <p className="text-gray-500 text-sm text-center mb-9">Sign in to the Uteo admin dashboard</p>

          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={ic}
                style={{ background: 'rgba(255,255,255,0.07)' }}
                placeholder="admin@uteo.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={ic + ' pr-12'}
                  style={{  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPw ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#F77B0F] hover:bg-[#e06a0d] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-black rounded-xl transition-all text-sm uppercase tracking-widest mt-1 shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          <div className="mt-7 pt-6 border-t border-gray-200">
            <div className="flex flex-wrap gap-1.5 justify-center">
              {['Candidates', 'Interviews', 'Jobs', 'Analytics', 'AI Engine', 'Finance'].map(f => (
                <span key={f} className="px-2.5 py-1 rounded-full border border-gray-400 text-[10px] font-bold text-gray-600 uppercase tracking-wider">{f}</span>
              ))}
            </div>
          </div>

        </div>

        <p className="text-center text-white/40 text-[11px] mt-5 uppercase tracking-widest drop-shadow">Uteo Platform · Admin Access Only</p>
      </div>

      {/* Logo pinned to bottom-left of the page */}
      <div className="absolute bottom-8 right-10 z-10">
        <img src="/logo.png" alt="Uteo" className="h-12 w-auto object-contain object-right" />
      </div>
    </div>
  );
}
