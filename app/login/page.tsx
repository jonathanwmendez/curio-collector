'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';
import { useAuth } from '@/components/Providers';
import { BrandMark } from '@/components/Icons';

function LoginInner() {
  const sb = supabaseBrowser();
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/portfolio';
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState(params.get('error') || '');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (user) router.replace(next); }, [user, router, next]);
  const redirect = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg('');
    try {
      if (mode === 'magic') {
        const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } });
        if (error) throw error;
        setMsg('Check your email for a sign-in link.');
      } else if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: redirect() } });
        if (error) throw error;
        if (!data.session) setMsg('Check your email to confirm your account, then sign in.');
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) { setMsg(err.message || 'Something went wrong. Try again.'); }
    setBusy(false);
  }

  async function google() {
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirect() } });
    if (error) setMsg(error.message.includes('not enabled') ? 'Google sign-in is not set up yet. Use email instead.' : error.message);
  }

  return (
    <div className="center-page">
      <div className="auth-card panel">
        <Link href="/" className="brand" style={{ textDecoration: 'none', padding: 0 }}><BrandMark /><b>Curio</b></Link>
        <div>
          <h1 style={{ fontSize: 24 }}>{mode === 'signup' ? 'Create your account' : 'Sign in'}</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Track, value and show off your collection.</p>
        </div>
        <button className="btn" type="button" onClick={google}>Continue with Google</button>
        <div className="divider">or with email</div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="field"><span>Email</span><input className="input" id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></label>
          {mode !== 'magic' && <label className="field"><span>Password</span><input className="input" id="password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} /></label>}
          <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Working' : mode === 'signup' ? 'Create account' : mode === 'magic' ? 'Email me a link' : 'Sign in'}</button>
        </form>
        {msg && <p className="small" style={{ margin: 0 }}>{msg}</p>}
        <div className="small muted" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {mode !== 'signin' && <button className="btn ghost sm" type="button" onClick={() => setMode('signin')}>Sign in with password</button>}
          {mode !== 'signup' && <button className="btn ghost sm" type="button" onClick={() => setMode('signup')}>Create an account</button>}
          {mode !== 'magic' && <button className="btn ghost sm" type="button" onClick={() => setMode('magic')}>Email me a sign-in link</button>}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
