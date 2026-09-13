import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, type CalendarFeed } from '@/lib/supabase';
import {
  Settings as SettingsIcon, LogOut, User, Cloud,
  CheckCircle2, XCircle, Loader2, Mail, Shield, Plus,
  Trash2, Calendar, RefreshCw, Link2, Eye, KeyRound,
} from 'lucide-react';

export default function Settings() {
  const { user, isGuest, signOut } = useAuth();
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [newFeed, setNewFeed] = useState({ name: '', feed_url: '' });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

      setPasswordStatus({ type: 'success', message: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordStatus({ type: 'error', message: err.message || 'Failed to update password.' });
    } finally {
      setPasswordLoading(false);
    }
  };
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
    <div className="max-w-2xl mx-auto p-4 md:p-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-6">
        <SettingsIcon className="w-6 h-6 text-teal-400" />
        Settings
      </h1>

      {/* Account */}
      <div className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-5 mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-slate-400" />
          Account
        </h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-sm text-slate-400">Email</p>
              <p className="text-white">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Shield className="w-4 h-4 text-slate-500" />
            <div>
              <p className="text-sm text-slate-400">Cloud Sync</p>
              {isGuest ? (
                <p className="text-amber-400 flex items-center gap-1 text-sm">
                  <Eye className="w-4 h-4" />
                  Guest mode — data won't sync across devices
                </p>
              ) : (
                <p className="text-emerald-400 flex items-center gap-1 text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  Active — synced across all devices
                </p>
              )}
            </div>
          </div>
        </div>
       <button
          onClick={signOut}
          className="mt-4 w-full bg-slate-700/50 hover:bg-red-500/20 text-slate-300 hover:text-red-400 border border-slate-700 hover:border-red-500/30 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
        >
          <LogOut className="w-4 h-4" />
          {isGuest ? 'Exit Guest Mode' : 'Sign Out'}
        </button>
      </div>

      {/* Change Password Card */}
      <div className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-5 mt-6">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-1">
          <KeyRound className="w-5 h-5 text-teal-400" />
          Change Password
        </h3>
        <p className="text-slate-400 text-xs mb-4">
          Update your TeamSync account password across all your synced devices.
        </p>

        <form onSubmit={handlePasswordUpdate} className="space-y-3 max-w-md">
          <div>
            <label className="text-xs text-slate-400 block mb-1">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              required
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Confirm New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50"
              required
            />
          </div>

          {passwordStatus && (
            <div
              className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
                passwordStatus.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {passwordStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 shrink-0" />
              )}
              {passwordStatus.message}
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading}
            className="bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2"
          >
            {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </form>
      </div>
  
      {/* Calendar Feeds */}
      <div className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-5 mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Cloud className="w-5 h-5 text-slate-400" />
          Calendar Import
        </h2>

        {isGuest ? (
          <p className="text-sm text-slate-400 text-center py-4">
            Sign up for an account to connect your Outlook or Teams calendar and import assignment deadlines automatically.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-400 mb-4">
              Paste your Outlook or Microsoft Teams iCal subscription URL to import assignment deadlines. In Teams, go to your calendar settings and look for "Subscribe" or "Get iCal URL" / "Publish a calendar".
            </p>

            {importResult && (
              <div className={`text-sm rounded-lg px-4 py-2.5 mb-4 ${
                importResult.startsWith('Imported')
                  ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
                  : 'text-red-400 bg-red-500/10 border border-red-500/20'
              }`}>
                {importResult}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
              </div>
            ) : feeds.length > 0 ? (
              <div className="space-y-2 mb-4">
                {feeds.map((feed) => (
                  <div
                    key={feed.id}
                    className="group flex items-center gap-3 p-3 rounded-lg bg-slate-900/30 border border-slate-700/40"
                  >
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">{feed.name}</p>
                      <p className="text-xs text-slate-500 truncate">{feed.feed_url}</p>
                      {feed.last_synced_at && (
                        <p className="text-xs text-slate-600 mt-0.5">
                          Last imported: {new Date(feed.last_synced_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleReimport(feed)}
                      disabled={importing}
                      className="shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-teal-400 hover:bg-teal-500/10 transition-all"
                      title="Re-import"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFeed(feed.id)}
                      className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {showForm ? (
              <form onSubmit={handleAddFeed} className="space-y-3 bg-slate-900/30 rounded-lg p-4 border border-slate-700/40">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Calendar name (optional)</label>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. My Teams Calendar"
                    value={newFeed.name}
                    onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">iCal / ICS URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://outlook.live.com/owa/calendar/.../calendar.ics"
                    value={newFeed.feed_url}
                    onChange={(e) => setNewFeed({ ...newFeed, feed_url: e.target.value })}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={importing}
                    className="flex-1 bg-teal-500 hover:bg-teal-400 text-white font-medium py-2 rounded-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                    Import Calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setNewFeed({ name: '', feed_url: '' }); }}
                    className="px-4 bg-slate-700/50 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowForm(true)}
                className="w-full bg-slate-700/30 hover:bg-slate-700/50 text-slate-300 border border-slate-700/50 py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Calendar Feed
              </button>
            )}
          </>
        )}
      </div>

      {/* About */}
      <div className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">About TeamSync</h2>
        <p className="text-sm text-slate-400">
          TeamSync is a progressive web app that keeps your tasks, agendas, and assignment deadlines in one place.
          Import your Outlook or Teams calendar to automatically pull in assignment deadlines with reference material links.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          Installable as a native app on all your devices
        </div>
      </div>
    </div>
  );
}
