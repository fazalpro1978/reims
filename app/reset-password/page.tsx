'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

interface PwStrength { len: boolean; upper: boolean; num: boolean; special: boolean; }

function strengthLevel(s: PwStrength) {
  return [s.len, s.upper, s.num, s.special].filter(Boolean).length;
}

function ResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [ready,    setReady   ] = useState(false);  // recovery session established
  const [expired,  setExpired ] = useState(false);
  const [newPw,    setNewPw   ] = useState('');
  const [confirm,  setConfirm ] = useState('');
  const [showPw,   setShowPw  ] = useState(false);
  const [strength, setStrength] = useState<PwStrength>({ len: false, upper: false, num: false, special: false });
  const [busy,     setBusy    ] = useState(false);
  const [error,    setError   ] = useState('');
  const [done,     setDone    ] = useState(false);

  useEffect(() => {
    // Handle ?code= (PKCE flow) — Supabase JS exchanges it automatically via onAuthStateChange
    // Handle #access_token=...&type=recovery (implicit flow) — also automatic
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setReady(true);
      } else if (event === 'SIGNED_IN' && searchParams.get('type') === 'recovery') {
        setReady(true);
      }
    });

    // If the URL has a token_hash + type=recovery (email OTP flow), exchange it
    const tokenHash = searchParams.get('token_hash');
    const type      = searchParams.get('type');
    if (tokenHash && type === 'recovery') {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(({ error: e }) => {
        if (e) setExpired(true);
        else setReady(true);
      });
    }

    // Fallback timeout: if nothing fires within 4s, the link is invalid/expired
    const t = setTimeout(() => setExpired(prev => prev || !ready), 4000);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPwChange(v: string) {
    setNewPw(v);
    setStrength({
      len:     v.length >= 8,
      upper:   /[A-Z]/.test(v),
      num:     /[0-9]/.test(v),
      special: /[^A-Za-z0-9]/.test(v),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) { setError('Passwords do not match.'); return; }
    if (strengthLevel(strength) < 4) { setError('Password does not meet all requirements.'); return; }
    setError('');
    setBusy(true);
    const { error: authErr } = await supabase.auth.updateUser({ password: newPw });
    setBusy(false);
    if (authErr) { setError(authErr.message); return; }
    await supabase.auth.signOut();
    setDone(true);
    setTimeout(() => router.replace('/login?reset=success'), 2500);
  }

  const level  = strengthLevel(strength);
  const colors = ['', '#ef4444', '#f59e0b', '#f59e0b', '#10b981'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)',
      }} />

      <div className="w-full max-w-[380px] relative">
        <div className="text-center mb-10">
          <img src="/brand/logo-dark.png" alt="Privé Group Real Estate"
            className="h-12 w-auto mx-auto mb-5 opacity-90"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <p className="text-[#c9a84c] text-[9px] font-bold uppercase tracking-[0.28em] mb-1">Privé Group Real Estate</p>
          <h1 className="text-[#e8e8e8] text-xl font-bold tracking-tight">Reset Password</h1>
        </div>

        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-7 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">

          {/* ── Done ── */}
          {done && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl"
                style={{ background: '#10b98120', border: '1px solid #10b98140' }}>✓</div>
              <p className="text-[#e0e0e0] font-semibold text-sm">Password updated</p>
              <p className="text-[#555] text-xs">Redirecting to sign in…</p>
            </div>
          )}

          {/* ── Expired / invalid ── */}
          {!done && expired && !ready && (
            <div className="py-4 text-center space-y-4">
              <p className="text-red-400 text-sm font-semibold">Link expired or invalid</p>
              <p className="text-[#555] text-xs">Password reset links are single-use and expire after 1 hour. Please request a new one.</p>
              <button onClick={() => router.replace('/login?forgot=1')}
                className="text-[#c9a84c] text-xs hover:underline">← Back to Sign In</button>
            </div>
          )}

          {/* ── Loading ── */}
          {!done && !expired && !ready && (
            <div className="py-6 text-center text-[#555] text-xs">Verifying reset link…</div>
          )}

          {/* ── Form ── */}
          {!done && ready && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#555] uppercase tracking-[0.14em] mb-1.5">New Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required autoComplete="new-password"
                    placeholder="••••••••" value={newPw} onChange={e => onPwChange(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 pr-10 text-sm text-[#e0e0e0] placeholder-[#333] outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/20 transition-colors" />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                    {showPw
                      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {newPw && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1.5">
                      {[1,2,3,4].map(i => (
                        <div key={i} style={{ background: i <= level ? colors[level] : '#1e1e1e' }}
                          className="flex-1 h-1 rounded-full transition-all" />
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                      {[{k:'len',l:'8+ chars'},{k:'upper',l:'Uppercase'},{k:'num',l:'Number'},{k:'special',l:'Special'}].map(({k,l}) => (
                        <span key={k} className="text-[10px] flex items-center gap-1"
                          style={{ color: strength[k as keyof PwStrength] ? '#10b981' : '#444' }}>
                          {strength[k as keyof PwStrength] ? '✓' : '○'} {l}
                        </span>
                      ))}
                    </div>
                    {level > 0 && <p className="text-[10px] mt-1" style={{ color: colors[level] }}>{labels[level]}</p>}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#555] uppercase tracking-[0.14em] mb-1.5">Confirm Password</label>
                <input type="password" required autoComplete="new-password" placeholder="••••••••"
                  value={confirm} onChange={e => setConfirm(e.target.value)}
                  className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-[#e0e0e0] placeholder-[#333] outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/20 transition-colors" />
                {confirm && confirm !== newPw && (
                  <p className="text-red-400 text-[10px] mt-1">Passwords do not match</p>
                )}
              </div>

              {error && (
                <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">{error}</p>
              )}

              <button type="submit" disabled={busy}
                className="w-full bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-50 text-[#0f0f0f] font-bold text-sm py-2.5 rounded-lg transition-colors mt-1">
                {busy ? 'Updating…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[#2a2a2a] text-[10px] mt-6">
          Privé Group Real Estate · Internal Platform
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
