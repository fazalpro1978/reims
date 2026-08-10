'use client';

import { useState, useEffect, FormEvent, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

type Mode = 'login' | 'register' | 'forgot';

interface PwStrength { len: boolean; upper: boolean; num: boolean; special: boolean; }

function strengthLevel(s: PwStrength): number {
  return [s.len, s.upper, s.num, s.special].filter(Boolean).length;
}

function StrengthBar({ s }: { s: PwStrength }) {
  const level = strengthLevel(s);
  const colors = ['#ef4444', '#f59e0b', '#f59e0b', '#10b981', '#10b981'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= level ? colors[level] : '#1e1e1e', transition: 'background .2s' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
        {[
          { key: 'len',     label: '8+ chars' },
          { key: 'upper',   label: 'Uppercase' },
          { key: 'num',     label: 'Number' },
          { key: 'special', label: 'Special char' },
        ].map(({ key, label }) => (
          <span key={key} style={{ fontSize: 10, color: s[key as keyof PwStrength] ? '#10b981' : '#444', display: 'flex', alignItems: 'center', gap: 3 }}>
            <span>{s[key as keyof PwStrength] ? '✓' : '○'}</span>{label}
          </span>
        ))}
      </div>
      {level > 0 && <p style={{ margin: '6px 0 0', fontSize: 10, color: colors[level] }}>{labels[level]}</p>}
    </div>
  );
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const reason       = searchParams.get('reason');

  const [mode,     setMode    ] = useState<Mode>(() => reason === 'reset' ? 'login' : 'login');

  // Login state
  const [email,    setEmail   ] = useState('');
  const [password, setPassword] = useState('');
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginErr, setLoginErr] = useState('');
  const [showPw,   setShowPw  ] = useState(false);

  // Forgot password state
  const [forgotEmail,   setForgotEmail  ] = useState('');
  const [forgotBusy,    setForgotBusy   ] = useState(false);
  const [forgotErr,     setForgotErr    ] = useState('');
  const [forgotSent,    setForgotSent   ] = useState(false);

  // Register state
  const [regEmail,   setRegEmail  ] = useState('');
  const [regName,    setRegName   ] = useState('');
  const [regCompany, setRegCompany] = useState('');
  const [regPhone,   setRegPhone  ] = useState('');
  const [regPw,      setRegPw     ] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPw,  setShowRegPw ] = useState(false);
  const [regBusy,    setRegBusy   ] = useState(false);
  const [regErr,     setRegErr    ] = useState('');
  const [regOk,      setRegOk     ] = useState(false);
  const [pwStrength, setPwStrength] = useState<PwStrength>({ len: false, upper: false, num: false, special: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/');
    });
  }, [router]);

  function onPwChange(v: string) {
    setRegPw(v);
    setPwStrength({
      len:     v.length >= 8,
      upper:   /[A-Z]/.test(v),
      num:     /[0-9]/.test(v),
      special: /[^A-Za-z0-9]/.test(v),
    });
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginErr('');
    setLoginBusy(true);
    const { error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoginBusy(false);
    if (authErr) {
      setLoginErr(authErr.message === 'Invalid login credentials'
        ? 'Incorrect email or password. Please try again.'
        : authErr.message);
    } else {
      router.replace('/');
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    if (regPw !== regConfirm) { setRegErr('Passwords do not match.'); return; }
    const s = strengthLevel(pwStrength);
    if (s < 4) { setRegErr('Password does not meet all requirements.'); return; }
    setRegErr('');
    setRegBusy(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, full_name: regName, company: regCompany, phone: regPhone, password: regPw }),
      });
      const json = await res.json();
      if (!res.ok) { setRegErr(json.error ?? 'Registration failed. Please try again.'); }
      else         { setRegOk(true); }
    } catch { setRegErr('Network error. Please try again.'); }
    setRegBusy(false);
  }

  async function handleForgot(e: FormEvent) {
    e.preventDefault();
    setForgotErr('');
    setForgotBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setForgotBusy(false);
    if (error) setForgotErr(error.message);
    else setForgotSent(true);
  }

  const fieldCls = 'w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3.5 py-2.5 text-sm text-[#e0e0e0] placeholder-[#333] outline-none focus:border-[#c9a84c] focus:ring-1 focus:ring-[#c9a84c]/20 transition-colors';
  const labelCls = 'block text-[10px] font-bold text-[#555] uppercase tracking-[0.14em] mb-1.5';

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4 py-12">
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,168,76,0.06) 0%, transparent 60%)',
      }} />

      <div className="w-full max-w-[400px] relative">
        {/* Brand */}
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
          <h1 className="text-[#e8e8e8] text-xl font-bold tracking-tight">Vanguard REOS</h1>
          <p className="text-[#555] text-xs mt-1">
            {mode === 'login' ? 'Sign in to your account' : 'Request system access'}
          </p>
        </div>

        {/* Reason banners (login mode only) */}
        {mode === 'login' && reason === 'reset' && (
          <div className="mb-4 px-3 py-2.5 rounded-lg border text-xs" style={{ background: '#10b98110', borderColor: '#10b98130', color: '#10b981' }}>
            Password updated successfully. Please sign in with your new password.
          </div>
        )}
        {mode === 'login' && reason === 'inactive' && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-400 text-xs">
            Your account has been deactivated. Contact your administrator.
          </div>
        )}
        {mode === 'login' && reason === 'pending' && (
          <div className="mb-4 px-3 py-2.5 rounded-lg border text-xs" style={{ background: '#f59e0b10', borderColor: '#f59e0b30', color: '#f59e0b' }}>
            Your access request is pending approval. You will be notified by email once approved.
          </div>
        )}
        {mode === 'login' && reason === 'rejected' && (
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-red-950/40 border border-red-900/40 text-red-400 text-xs">
            Your access request was not approved. Contact your administrator for assistance.
          </div>
        )}

        {/* Card */}
        <div className="bg-[#111111] border border-[#1e1e1e] rounded-xl p-7 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">

          {/* ── LOGIN FORM ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelCls}>Email Address</label>
                <input type="email" required autoComplete="email" placeholder="you@privegroupre.com"
                  value={email} onChange={e => setEmail(e.target.value)} className={fieldCls} />
              </div>

              <div>
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                    placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                    className={`${fieldCls} pr-10`} />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                    {showPw
                      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {loginErr && (
                <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">{loginErr}</p>
              )}

              <button type="submit" disabled={loginBusy}
                className="w-full bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-50 text-[#0f0f0f] font-bold text-sm py-2.5 rounded-lg transition-colors mt-1">
                {loginBusy ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="pt-1 border-t border-[#1a1a1a] space-y-0.5">
                <button type="button" onClick={() => { setMode('forgot'); setForgotSent(false); setForgotErr(''); setForgotEmail(email); }}
                  className="w-full text-xs text-[#555] hover:text-[#c9a84c] transition-colors py-1.5 text-center">
                  Forgot your password?
                </button>
                <button type="button" onClick={() => setMode('register')}
                  className="w-full text-xs text-[#555] hover:text-[#c9a84c] transition-colors py-1.5 text-center">
                  Don&apos;t have an account? <span className="font-semibold">Request Access →</span>
                </button>
              </div>
            </form>
          )}

          {/* ── FORGOT PASSWORD FORM ── */}
          {mode === 'forgot' && !forgotSent && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <p className="text-xs text-[#555] mb-4 leading-relaxed">Enter your registered email address and we&apos;ll send you a secure link to reset your password.</p>
                <label className={labelCls}>Email Address</label>
                <input type="email" required autoComplete="email" placeholder="you@privegroupre.com"
                  value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className={fieldCls} />
              </div>

              {forgotErr && (
                <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">{forgotErr}</p>
              )}

              <button type="submit" disabled={forgotBusy}
                className="w-full bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-50 text-[#0f0f0f] font-bold text-sm py-2.5 rounded-lg transition-colors mt-1">
                {forgotBusy ? 'Sending…' : 'Send Reset Link'}
              </button>

              <div className="pt-1 border-t border-[#1a1a1a]">
                <button type="button" onClick={() => setMode('login')}
                  className="w-full text-xs text-[#555] hover:text-[#c9a84c] transition-colors py-1.5 text-center">
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ── FORGOT SUCCESS ── */}
          {mode === 'forgot' && forgotSent && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl"
                style={{ background: '#c9a84c20', border: '1px solid #c9a84c40' }}>✉</div>
              <div>
                <p className="text-[#e0e0e0] font-semibold text-sm mb-1">Check your email</p>
                <p className="text-[#555] text-xs leading-relaxed">
                  A password reset link has been sent to <strong className="text-[#888]">{forgotEmail}</strong>. It expires in 1 hour.
                </p>
              </div>
              <button type="button" onClick={() => setMode('login')}
                className="text-xs text-[#c9a84c] hover:underline">← Back to Sign In</button>
            </div>
          )}

          {/* ── REGISTER FORM ── */}
          {mode === 'register' && !regOk && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div>
                <label className={labelCls}>Full Name <span className="text-red-500">*</span></label>
                <input type="text" required autoComplete="name" placeholder="Jane Smith"
                  value={regName} onChange={e => setRegName(e.target.value)} className={fieldCls} />
              </div>

              <div>
                <label className={labelCls}>Email Address <span className="text-red-500">*</span></label>
                <input type="email" required autoComplete="email" placeholder="you@example.com"
                  value={regEmail} onChange={e => setRegEmail(e.target.value)} className={fieldCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Company</label>
                  <input type="text" autoComplete="organization" placeholder="Company name"
                    value={regCompany} onChange={e => setRegCompany(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="tel" autoComplete="tel" placeholder="+974 5XXX XXXX"
                    value={regPhone} onChange={e => setRegPhone(e.target.value)} className={fieldCls} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type={showRegPw ? 'text' : 'password'} required autoComplete="new-password"
                    placeholder="••••••••" value={regPw} onChange={e => onPwChange(e.target.value)}
                    className={`${fieldCls} pr-10`} />
                  <button type="button" onClick={() => setShowRegPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
                    {showRegPw
                      ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/></svg>
                      : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-4 h-4"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                {regPw && <div className="mt-2"><StrengthBar s={pwStrength} /></div>}
              </div>

              <div>
                <label className={labelCls}>Confirm Password <span className="text-red-500">*</span></label>
                <input type="password" required autoComplete="new-password" placeholder="••••••••"
                  value={regConfirm} onChange={e => setRegConfirm(e.target.value)} className={fieldCls} />
                {regConfirm && regConfirm !== regPw && (
                  <p className="text-red-400 text-[10px] mt-1">Passwords do not match</p>
                )}
              </div>

              {regErr && (
                <p className="text-red-400 text-xs bg-red-950/30 border border-red-900/30 rounded-lg px-3 py-2">{regErr}</p>
              )}

              <button type="submit" disabled={regBusy}
                className="w-full bg-[#c9a84c] hover:bg-[#dfc070] disabled:opacity-50 text-[#0f0f0f] font-bold text-sm py-2.5 rounded-lg transition-colors mt-1">
                {regBusy ? 'Submitting…' : 'Submit Access Request'}
              </button>

              <div className="pt-1 border-t border-[#1a1a1a]">
                <button type="button" onClick={() => setMode('login')}
                  className="w-full text-xs text-[#555] hover:text-[#c9a84c] transition-colors py-1.5 text-center">
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ── REGISTER SUCCESS ── */}
          {mode === 'register' && regOk && (
            <div className="py-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl"
                style={{ background: '#10b98120', border: '1px solid #10b98140' }}>✓</div>
              <div>
                <p className="text-[#e0e0e0] font-semibold text-sm mb-1">Request Submitted</p>
                <p className="text-[#555] text-xs leading-relaxed">
                  Your access request has been received. A Superuser or Administrator will review it and you&apos;ll be notified by email once approved.
                </p>
              </div>
              <button type="button" onClick={() => { setMode('login'); setRegOk(false); }}
                className="text-xs text-[#c9a84c] hover:underline">Back to Sign In</button>
            </div>
          )}
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
