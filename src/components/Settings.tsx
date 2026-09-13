import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type CalendarFeed } from '@/lib/supabase';
import {
  Settings as SettingsIcon,
  LogOut,
  User,
  Cloud,
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Shield,
  Plus,
  Trash2,
  Calendar,
  RefreshCw,
  Link2,
  Eye,
  KeyRound,
  Copy,
  Check,
  Cpu,
} from 'lucide-react';

export default function Settings() {
  const { user, isGuest, signOut } = useAuth();
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [newFeed, setNewFeed] = useState({ name: '', feed_url: '' });

  const [copiedId, setCopiedId] = useState(false);

  // Change Password State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchFeeds = useCallback(async () => {
    if (isGuest) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('calendar_feeds')
      .select('*')
      .order('created_at', { ascending: false });
    setFeeds(data ?? []);
    setLoading(false);
  }, [isGuest]);

  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (isGuest) {
      setPasswordStatus({ type: 'error', message: 'Password change is not available in Guest mode.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters long.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPasswordStatus({ type: 'success', message: 'Password updated successfully across all devices.' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordStatus({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCopySyncId = () => {
    if (!user?.id) return;
    navigator.clipboard.writeText(user.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeed.feed_url.trim()) return;
    setShowForm(false);
    await handleImport(newFeed.feed_url.trim(), newFeed.name.trim() || 'My Calendar');
    setNewFeed({ name: '', feed_url: '' });
  };

  const handleImport = async (feedUrl: string, feedName: string) => {
    setImporting(true);
    setImportResult(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-import`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feed_url: feedUrl, feed_name: feedName }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Import failed (${response.status})`);
      }
      setImportResult(`Imported ${result.imported} assignment(s) from ${result.total_found || 0} calendar event(s).`);
      await fetchFeeds();
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : 'Failed to import calendar.');
    }
    setImporting(false);
  };

  const handleDeleteFeed = async (id: string) => {
    if (!confirm('Remove this calendar feed? Your imported assignments will remain.')) return;
    await supabase.from('calendar_feeds').delete().eq('id', id);
    setFeeds((prev) => prev.filter((f) => f.id !== id));
  };

  const handleReimport = async (feed: CalendarFeed) => {
    await handleImport(feed.feed_url, feed.name);
  };

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
          <SettingsIcon className="w-6 h-6 text-indigo-400" />
          Settings
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Account sync identity, credentials, and schedule integrations
        </p>
      </div>

      {/* Account Card */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-base shadow-inner">
            {user?.email ? user.email.charAt(0).toUpperCase() : 'G'}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-semibold text-base truncate">
              {user?.email || 'Guest Session'}
            </h2>
            <p className="text-zinc-500 text-xs flex items-center gap-1.5 mt-0.5">
              <Shield className="w-3 h-3 text-indigo-400" />
              {isGuest ? 'Local Device Only' : 'Supabase Multi-Device RLS'}
            </p>
          </div>
        </div>

        {/* Sync Status & Info */}
        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/[0.05] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">Cloud Sync Status</span>
            {isGuest ? (
              <span className="text-amber-400 flex items-center gap-1 font-medium">
                <Eye className="w-3.5 h-3.5" />
                Guest Mode
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active & Synced
              </span>
            )}
          </div>

          {!isGuest && user?.id && (
            <div className="pt-3 border-t border-white/[0.04] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[11px] uppercase font-mono tracking-wider text-zinc-500 block">
                  Tampermonkey Sync ID
                </span>
                <p className="font-mono text-xs text-indigo-300 truncate max-w-[200px] sm:max-w-xs mt-0.5">
                  {user.id}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopySyncId}
                className="shrink-0 px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 text-zinc-300 text-xs font-medium border border-white/[0.06] transition-all flex items-center gap-1.5 active:scale-95"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedId ? 'Copied' : 'Copy ID'}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className="w-full bg-zinc-850 hover:bg-rose-500/10 hover:border-rose-500/20 text-zinc-300 hover:text-rose-400 border border-white/[0.06] py-2.5 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
        >
          <LogOut className="w-3.5 h-3.5" />
          {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
        </button>
      </div>

      {/* Change Password Card */}
      {!isGuest && (
        <div className="glass-panel rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2 tracking-tight">
              <KeyRound className="w-4 h-4 text-indigo-400" />
              Change Password
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              Update credentials for your TeamSync account on all devices
            </p>
          </div>

          <form onSubmit={handlePasswordUpdate} className="space-y-3.5">
            <div>
              <label className="text-[11px] font-medium text-zinc-400 mb-1.5 block tracking-wide uppercase">
                New Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-400 mb-1.5 block tracking-wide uppercase">
                Confirm New Password
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full glass-input rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none"
                required
              />
            </div>

            {passwordStatus && (
              <div
                className={`text-xs px-3.5 py-2.5 rounded-xl flex items-center gap-2 border transition-all ${
                  passwordStatus.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}
              >
                {passwordStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                {passwordStatus.message}
              </div>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="bg-gradient-to-b from-indigo-500 to-indigo-600 hover:brightness-110 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 active:scale-98"
            >
              {passwordLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Update Password
            </button>
          </form>
        </div>
      )}

      {/* Calendar Feeds Card */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 shadow-xl space-y-4">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2 tracking-tight">
            <Cloud className="w-4 h-4 text-indigo-400" />
            Calendar & iCal Subscriptions
          </h2>
          <p className="text-zinc-400 text-xs mt-1">
            Connect Outlook or Microsoft Teams calendar feeds to automatically pull coursework deadlines
          </p>
        </div>

        {isGuest ? (
          <p className="text-xs text-zinc-500 text-center py-4 bg-black/20 rounded-2xl border border-white/[0.04]">
            Sign up for an account to connect external calendar subscriptions.
          </p>
        ) : (
          <>
            {importResult && (
              <div className={`text-xs rounded-xl px-3.5 py-2.5 border ${
                importResult.startsWith('Imported')
                  ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-rose-300 bg-rose-500/10 border-rose-500/20'
              }`}>
                {importResult}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              </div>
            ) : feeds.length > 0 ? (
              <div className="space-y-2">
                {feeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="group flex items-center gap-3 p-3 rounded-2xl bg-black/30 border border-white/[0.05]"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-100 font-medium truncate">{feed.name}</p>
                      <p className="text-[11px] text-zinc-500 font-mono truncate">{feed.feed_url}</p>
                    </div>
                    <button
                      onClick={() => handleReimport(feed)}
                      disabled={importing}
                      className="shrink-0 p-1.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-white/[0.06] transition-all"
                      title="Re-sync"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteFeed(feed.id)}
                      className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {showForm ? (
              <form onSubmit={handleAddFeed} className="space-y-3 bg-black/40 rounded-2xl p-4 border border-white/[0.05]">
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 mb-1 block">Calendar Title (optional)</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. Teams Sem I"
                    value={newFeed.name}
                    onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                    className="w-full glass-input rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-400 mb-1 block">iCal / ICS URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://outlook.live.com/owa/calendar/.../calendar.ics"
                    value={newFeed.feed_url}
                    onChange={(e) => setNewFeed({ ...newFeed, feed_url: e.target.value })}
                    className="w-full glass-input rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={importing}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                    Save Feed
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setNewFeed({ name: '', feed_url: '' }); }}
                    className="px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-xl text-xs transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-300 border border-white/[0.06] py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-400" />
                Add Calendar Subscription
              </button>
            )}
          </>
        )}
      </div>

      {/* System Engine Tag Footer */}
      <div className="glass-panel rounded-3xl p-5 shadow-xl flex items-center gap-3">
        <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-white text-xs font-semibold">TeamSync PWA Engine</h3>
          <p className="text-zinc-500 text-[11px] mt-0.5">
            Client-side cache with Postgres RLS data fencing. Installable natively on iOS, Android, and Desktop.
          </p>
        </div>
      </div>
    </div>
  );
}