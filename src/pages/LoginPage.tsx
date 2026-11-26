import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react';
import { useFocusFlow } from '../context/FocusFlowContext';

type AuthMode = 'login' | 'signup';

export const LoginPage: React.FC = () => {
  const {
    state,
    updatePreferences,
    loginAccount,
    signupAccount,
    enterGuestMode,
    supabaseConfigured,
  } = useFocusFlow();

  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const isDark =
    state.preferences.theme === 'dark' ||
    (state.preferences.theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  const toggleTheme = () => {
    updatePreferences({ theme: isDark ? 'light' : 'dark' });
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setErrorCode(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setErrorCode(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (mode === 'signup') {
      const cleanName = fullName.trim();
      if (!cleanName) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }

      setSubmitting(true);
      const res = await signupAccount({
        fullName: cleanName,
        email: cleanEmail,
        password,
        roleTitle: roleTitle.trim() || 'Personal Workspace',
      });
      setSubmitting(false);

      if (!res.ok) {
        setErrorMsg(res.error || 'Could not create account.');
        setErrorCode(res.code || null);
      }
      return;
    }

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setSubmitting(true);
    const res = await loginAccount({ email: cleanEmail, password });
    setSubmitting(false);

    if (!res.ok) {
      setErrorMsg(res.error || 'Invalid email or password.');
      setErrorCode(res.code || null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-[#111216] text-zinc-900 dark:text-zinc-100 flex flex-col">
      {/* Top Bar */}
      <header className="flex h-16 items-center justify-between px-6 sm:px-10 border-b border-zinc-200/80 dark:border-[#232530] bg-white/80 dark:bg-[#14151B]/80 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-white font-display text-sm font-bold"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            F
          </span>
          <span className="font-display text-base font-semibold tracking-tight">Focus Flow</span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-[#272A36] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Product Overview */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <p className="font-mono text-xs uppercase tracking-wider text-[var(--accent)] font-medium">
                Personal Productivity Workspace
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                Organize tasks, build habits, and protect your deep work.
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Sign in or create an account to save your profile, tasks, projects, habit streaks, and focus logs in your personal Supabase workspace.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {[
                'Per-account workspace isolation synced to Supabase PostgreSQL',
                'Kanban boards, interactive calendar, habit heatmaps, and Pomodoro timer',
                'AI-assisted task breakdown and realistic daily scheduling',
              ].map((line) => (
                <div key={line} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
                  <span>{line}</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-4 flex items-start gap-3">
              <Database className="h-4 w-4 shrink-0 mt-0.5 text-[var(--accent)]" />
              <div className="text-xs space-y-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  Supabase Project{' '}
                  <span className="font-mono text-zinc-500 dark:text-zinc-400">exsuwvqxvxihrkzuahmd</span>
                </p>
                <p className="text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {supabaseConfigured
                    ? 'Backend authentication and ff_accounts storage are connected.'
                    : 'Supabase secret key is not set yet in Settings > Secrets. You can still preview everything in Local Guest Mode below.'}
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Auth Card */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-zinc-200 dark:border-[#232530] bg-white dark:bg-[#17181E] p-6 sm:p-8 shadow-sm">
              {/* Mode Switcher */}
              <div className="grid grid-cols-2 rounded-lg bg-zinc-100 dark:bg-[#1E2028] p-1 mb-6">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`rounded-md py-2 text-xs font-medium transition-colors ${
                    mode === 'login'
                      ? 'bg-white dark:bg-[#14151B] text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`rounded-md py-2 text-xs font-medium transition-colors ${
                    mode === 'signup'
                      ? 'bg-white dark:bg-[#14151B] text-zinc-900 dark:text-zinc-100 shadow-xs'
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <div className="mb-5">
                <h2 className="font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {mode === 'login' ? 'Welcome back' : 'Create your account'}
                </h2>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  {mode === 'login'
                    ? 'Enter your email and password to access your workspace.'
                    : 'Your account profile and workspace data will be stored in Supabase.'}
                </p>
              </div>

              {errorMsg && (
                <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p>{errorMsg}</p>
                    {errorCode === 'KEY_MISSING' && (
                      <p className="text-[11px] opacity-90">
                        Add SUPABASE_SERVICE_ROLE_KEY in AI Studio Settings &gt; Secrets, then restart or retry.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <>
                    <div>
                      <label htmlFor="auth-fullname" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Full Name
                      </label>
                      <input
                        id="auth-fullname"
                        type="text"
                        autoComplete="name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Morgan"
                        className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="auth-role" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Role or Focus Title <span className="text-zinc-400 font-normal">(optional)</span>
                      </label>
                      <input
                        id="auth-role"
                        type="text"
                        value={roleTitle}
                        onChange={(e) => setRoleTitle(e.target.value)}
                        placeholder="Product Designer, Student, Founder..."
                        className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="auth-password" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === 'signup' ? 'Minimum 8 characters' : 'Enter your password'}
                      className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 pr-10 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'signup' && (
                  <div>
                    <label htmlFor="auth-confirm-password" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Confirm Password
                    </label>
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter your password"
                      className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] bg-zinc-50 dark:bg-[#121318] px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:border-[var(--accent)] focus:outline-none"
                      required
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-5 border-t border-zinc-100 dark:border-[#232530] space-y-2.5">
                <button
                  type="button"
                  onClick={enterGuestMode}
                  className="w-full rounded-lg border border-zinc-200 dark:border-[#2A2D39] px-4 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                >
                  Continue in Local Guest Mode
                </button>
                <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-500">
                  Guest mode stores data locally in your browser without cloud sync.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
