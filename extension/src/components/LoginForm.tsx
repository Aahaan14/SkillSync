import React, { useState } from 'react';
import { Eye, EyeOff, LogoMark } from './icons';

export interface Credentials {
  email: string;
  password: string;
  fullName: string;
}

const field =
  'w-full rounded-xl border bg-zinc-900 px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30';

export const LoginForm = ({
  busy,
  error,
  fieldErrors,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  fieldErrors: Record<string, string>;
  onSubmit: (mode: 'login' | 'register', credentials: Credentials) => void;
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [show, setShow] = useState(false);
  const isRegister = mode === 'register';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!busy) onSubmit(mode, { email: email.trim(), password, fullName });
  };

  return (
    <div className="animate-fade-up flex flex-1 flex-col justify-center px-6 pb-6">
      <div className="mb-6 text-center">
        <LogoMark className="mx-auto mb-3 h-11 w-11" />
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
          {isRegister ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          {isRegister ? 'Start comparing your skills with the job market.' : 'Sign in to analyze profiles from any tab.'}
        </p>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3" noValidate>
        {isRegister && (
          <div>
            <label htmlFor="sk-name" className="mb-1 block text-xs font-medium text-zinc-400">Full name <span className="text-zinc-600">(optional)</span></label>
            <input id="sk-name" className={`${field} ${fieldErrors.full_name ? 'border-rose-500/60' : 'border-zinc-800'}`} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" placeholder="Jane Doe" />
            {fieldErrors.full_name && <p className="mt-1 text-xs text-rose-300">{fieldErrors.full_name}</p>}
          </div>
        )}
        <div>
          <label htmlFor="sk-email" className="mb-1 block text-xs font-medium text-zinc-400">Email</label>
          <input id="sk-email" type="email" required className={`${field} ${fieldErrors.email ? 'border-rose-500/60' : 'border-zinc-800'}`} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
          {fieldErrors.email && <p className="mt-1 text-xs text-rose-300">{fieldErrors.email}</p>}
        </div>
        <div>
          <label htmlFor="sk-password" className="mb-1 block text-xs font-medium text-zinc-400">Password</label>
          <div className="relative">
            <input id="sk-password" type={show ? 'text' : 'password'} required className={`${field} pr-10 ${fieldErrors.password ? 'border-rose-500/60' : 'border-zinc-800'}`} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder="••••••••" />
            <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:text-zinc-200">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {fieldErrors.password ? (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.password}</p>
          ) : (
            isRegister && <p className="mt-1 text-xs text-zinc-500">8+ characters with upper and lower case letters and a number.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy || !email || !password}
          className="mt-1 w-full rounded-xl bg-linear-to-r from-brand-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:from-brand-400 hover:to-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-zinc-400">
        {isRegister ? 'Already have an account?' : 'New to SkillSync?'}{' '}
        <button type="button" onClick={() => setMode(isRegister ? 'login' : 'register')} className="font-semibold text-brand-400 hover:text-brand-300">
          {isRegister ? 'Sign in' : 'Create one'}
        </button>
      </p>
    </div>
  );
};
