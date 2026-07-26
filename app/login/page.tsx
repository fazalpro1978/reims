'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const reason       = searchParams.get('reason');

  const [email,    setEmail   ] = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading ] = useState(false);
  const [error,    setError   ] = useState('');
  const [showPw,   setShowPw  ] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/');
    });
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (authErr) {
      setError(authErr.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : authErr.message);
    } else {
      router.replace('/');
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      {/* Background texture */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)',
      }} />

      <div className="w-full max-w-[380px] relative">
        {/* Logo & brand */}
        <div className="text-center mb-10">
          <img
            src="/brand/logo-dark.png"
            alt="Privé Group Real Estate"
            className="h-12 w-auto mx-auto mb-5 opacity-90"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <p className="text-[#c9a84c] text-[9px] font-bold uppercase tracking-[0.28em] mb-1">
            Privé Group Real Estate
          </p>
          <h1 className="text-[#e8e8e8] text-xl font-bold tracking-tight">
            Vanguard REOS
          </h1>
          <p className="text-[#555] text-xs mt-1">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-7 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">

          {/* Inactive / no-access notice */}
          {reason === 'inactive' && (
            <div className="mb-5 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-400 text-xs">
              Your account has been deactivated. Contact your administrator.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-[10px] font-bold text-[#555] uppercase tracking-[0.14em] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@privegroupre.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-[#e0e0e0] placeholder-[#333] outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/20 transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[10px] font-bold text-[#555] uppercase tracking-[0.14em] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 pr-10 text-sm text-[#e0e0e0] placeholder-[#333] outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/20 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors"
                >
                  {showPw
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-50 text-[#0f0f0f] font-bold text-sm py-2.5 rounded-lg transition-colors mt-1"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-[#2a2a2a] text-[10px] mt-6">
          Privé Group Real Estate · Internal Platform · Access Restricted
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
