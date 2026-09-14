import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Zap,
  Inbox,
  RotateCcw,
} from 'lucide-react';

export default function Auth() {
  const authContext = useAuth() as any;
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
    } catch (err: any) {
      setStatus({
        type: 'error',
        message: err.message || 'Authentication failed. Please check your details.',
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
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message || 'Failed to resend email.' });
    } finally {
      setResending(false);
    }
  };

  const handleGuestLogin = () => {
    if (authContext.signInAsGuest) {
      authContext.signInAsGuest();
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#08090d] flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[340px] bg-indigo-600/15 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 right-1/3 w-[380px] h-[280px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Main Glass Card */}
      <div className="w-full max-w-[420px] glass-panel rounded-3xl p-6 sm:p-8 relative z-10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] border border-white/[0.08] backdrop-blur-2xl">
        {/* ========================================================= */}
        {/* VIEW 1: DEDICATED EMAIL CONFIRMATION SCREEN                */}
        {/* ========================================================= */}
        {emailSent ? (
          <div className="flex flex-col items-center text-center py-2 animate-in fade-in zoom-in-95 duration-200">
            {/* Pulsing Mail Icon */}
            <div className="relative mb-5">
              <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-3xl blur opacity-50 animate-pulse" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-b from-[#181a24] to-[#0f1118] border border-white/[0.12] flex items-center justify-center shadow-inner">
                <Inbox className="w-8 h-8 text-indigo-400 drop-shadow-[0_0_10px_rgba(99,102,241,0.6)]" />
              </div>
            </div>

            <h2 className="text-xl font-bold text-white tracking-tight">Check your email</h2>
            <p className="text-zinc-400 text-xs mt-2 leading-relaxed px-2">
              We just sent a confirmation link to:
            </p>
            <p className="text-indigo-300 font-mono text-xs font-semibold mt-1 px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 break-all">
              {email}
            </p>

            <p className="text-zinc-500 text-[11px] mt-4 leading-relaxed max-w-xs">
              Click the link inside to activate your TeamSync account. Once confirmed, you can log right in.
            </p>

            {status && (
              <div
                className={`mt-4 w-full text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 border ${
                  status.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}
              >
                {status.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span className="text-left leading-tight">{status.message}</span>
              </div>
            )}

            {/* Actions */}
            <div className="w-full space-y-2.5 mt-6 pt-5 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resending}
                className="w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.06] py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              >
                {resending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                )}
                Resend Confirmation Email
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmailSent(false);
                  setIsSignUp(false);
                  setStatus(null);
                }}
                className="w-full text-xs text-zinc-500 hover:text-zinc-300 py-1.5 transition-colors"
              >
                ← Back to Sign In
              </button>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* VIEW 2: STANDARD LOGIN / SIGNUP FORM                     */
          /* ========================================================= */
          <>
            <div className="flex flex-col items-center text-center mb-7">
              <div className="relative group mb-3">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-600 rounded-2xl blur opacity-50 group-hover:opacity-75 transition duration-300" />
                <div className="relative w-13 h-13 rounded-2xl bg-gradient-to-b from-[#181a24] to-[#0f1118] border border-white/[0.12] flex items-center justify-center shadow-inner">
                  <Zap className="w-6 h-6 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                </div>
              </div>

              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-1.5">
                TeamSync
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                  PRO
                </span>
              </h1>
              <p className="text-zinc-400 text-xs mt-1.5">
                Your university assignments, tasks, and agendas synced in real time
              </p>
            </div>

            {/* Segment Switcher */}
            <div className="relative p-1 bg-black/50 border border-white/[0.05] rounded-xl flex items-center mb-6">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setStatus(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  !isSignUp
                    ? 'bg-zinc-800/90 text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setStatus(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
                  isSignUp
                    ? 'bg-zinc-800/90 text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-white/[0.08]'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-400 block tracking-wide uppercase">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="w-full glass-input rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-zinc-400 block tracking-wide uppercase">
                  Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-indigo-400 transition-colors">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full glass-input rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {status && (
                <div
                  className={`text-xs px-3.5 py-2.5 rounded-xl flex items-start gap-2.5 border transition-all animate-in fade-in slide-in-from-top-1 ${
                    status.type === 'success'
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                  }`}
                >
                  {status.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  )}
                  <span className="leading-snug">{status.message}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full relative group overflow-hidden bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-400 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-xl text-xs transition-all duration-200 shadow-[0_4px_18px_rgba(99,102,241,0.35)] hover:shadow-[0_6px_22px_rgba(99,102,241,0.45)] active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{isSignUp ? 'Create My Account' : 'Sign In'}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </button>
            </form>

            {authContext.signInAsGuest && (
              <div className="mt-5 pt-4 border-t border-white/[0.06] text-center">
                <button
                  type="button"
                  onClick={handleGuestLogin}
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Explore as Guest (No Cloud Sync)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="absolute bottom-4 text-[11px] text-zinc-600 tracking-wider">
        Teams & University Task Automation Dashboard
      </p>
    </div>
  );
}