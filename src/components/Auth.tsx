import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { BrandMark, Notice, Segmented } from '@/components/ui';
import { Eye, EyeOff, ArrowRight, Loader2, MailCheck, RotateCcw, ArrowLeft } from 'lucide-react';

export default function Auth() {
  const { signInGuest } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error, data } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        // If email confirmation is enabled in Supabase, session is null initially
        if (!data.session) {
          setEmailSent(true);
        } else {
          setStatus({ type: 'success', message: 'Account created! Welcome to TeamSync.' });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;
      }
    } catch (err) {
      setStatus({
        type: 'error',
        message: (err instanceof Error && err.message) || 'Authentication failed. Please check your details.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) return;
    setResending(true);
    setStatus(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) throw error;
      setStatus({ type: 'success', message: 'Verification link resent to your email.' });
    } catch (err) {
      setStatus({ type: 'error', message: (err instanceof Error && err.message) || 'Failed to resend email.' });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Editorial panel (desktop) */}
      <aside className="hidden lg:flex flex-col justify-between bg-sidebar text-sidebar-text p-12 xl:p-16">
        <div className="flex items-center gap-3">
          <BrandMark />
          <span className="font-display text-[26px] text-canvas leading-none">TeamSync</span>
        </div>
        <div>
          <p className="font-display text-[64px] xl:text-[76px] leading-[0.95] text-canvas">
            Every deadline,
            <br />
            <em className="text-[#8FD3B6]">in one place.</em>
          </p>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed">
            Tasks, Teams assignments and your calendar — synced across your phone and laptop.
          </p>
        </div>
        <ul className="flex gap-8 text-xs uppercase tracking-[0.14em]">
          <li>Tasks</li>
          <li>Assignments</li>
          <li>Agenda</li>
        </ul>
      </aside>

      <main className="flex flex-col items-center justify-center px-5 py-10 sm:px-8 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-[380px]">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <BrandMark />
            <span className="font-display text-[26px] leading-none">TeamSync</span>
          </div>

          {emailSent ? (
            <div>
              <MailCheck className="w-8 h-8 text-primary" strokeWidth={1.5} />
              <h1 className="font-display text-[44px] leading-none mt-5">Check your email</h1>
              <p className="text-muted mt-3">
                We sent a confirmation link to <span className="text-ink font-medium break-all">{email}</span>. Open it to
                activate your account, then sign in.
              </p>

              {status && <div className="mt-5"><Notice type={status.type}>{status.message}</Notice></div>}

              <div className="mt-8 flex flex-col gap-2">
                <button type="button" onClick={handleResendVerification} disabled={resending} className="btn-secondary w-full h-11">
                  {resending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  Resend confirmation email
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmailSent(false);
                    setIsSignUp(false);
                    setStatus(null);
                  }}
                  className="btn-ghost w-full"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to sign in
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-[44px] leading-none">{isSignUp ? 'Create an account' : 'Welcome back'}</h1>
              <p className="text-muted mt-3 mb-8">
                {isSignUp ? 'Start tracking your coursework in minutes.' : 'Sign in to pick up where you left off.'}
              </p>

              <div className="mb-6 [&>div]:w-full [&_button]:flex-1">
                <Segmented
                  label="Account mode"
                  value={isSignUp ? 'up' : 'in'}
                  onChange={(v) => {
                    setIsSignUp(v === 'up');
                    setStatus(null);
                  }}
                  options={[
                    { value: 'in', label: 'Sign in' },
                    { value: 'up', label: 'Create account' },
                  ]}
                />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="auth-email" className="field-label">Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="field"
                  />
                </div>

                <div>
                  <label htmlFor="auth-password" className="field-label">Password</label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete={isSignUp ? 'new-password' : 'current-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={isSignUp ? 'At least 6 characters' : ''}
                      className="field pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-1 my-auto icon-btn"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {status && <Notice type={status.type}>{status.message}</Notice>}

                <button type="submit" disabled={loading} className="btn-primary w-full h-11 !mt-6">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {isSignUp ? 'Create account' : 'Sign in'}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-line text-center">
                <button type="button" onClick={signInGuest} className="text-sm text-muted hover:text-ink underline underline-offset-4 decoration-line hover:decoration-ink transition-colors">
                  Explore as a guest — no cloud sync
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
