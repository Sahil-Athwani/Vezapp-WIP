'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { api } from '@/lib/client';

// Logs in with an existing account from the main Vezapp Users table.
export default function AuthForm() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: form });
      router.replace('/');
      router.refresh();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={submit}>
      <div className="auth-brand">
        <img src="/logo.svg" alt="" />
        <span>Vezapp-WIP</span>
      </div>
      <p className="auth-tagline">Moulding &amp; WIP, spoken.</p>
      <h1>Welcome back</h1>
      <p className="sub">Sign in with your Vezapp account</p>
      <label className="field"><span>Email address</span>
        <input type="email" required autoComplete="email" placeholder="you@company.com" value={form.email} onChange={set('email')} />
      </label>
      <label className="field"><span>Password</span>
        <span className="pw-wrap">
          <input type={show ? 'text' : 'password'} required autoComplete="current-password" value={form.password} onChange={set('password')} />
          <button type="button" className="pw-toggle" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </span>
      </label>
      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      <button type="submit" className="auth-submit" disabled={busy}>
        <LogIn size={18} aria-hidden="true" /> {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="auth-help">Accounts are managed by your company admin in Vezapp.</p>
    </form>
  );
}
