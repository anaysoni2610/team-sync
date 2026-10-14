import React, { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, importCalendarFeed, type CalendarFeed } from '@/lib/supabase';
import { ConfirmDelete, Notice, PageHeader } from '@/components/ui';
import { LogOut, Loader2, Plus, Calendar, RefreshCw, Copy, Check } from 'lucide-react';

function Row({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)] md:gap-10 py-8 first:pt-0 border-b border-line last:border-0">
      <div>
        <h2 className="font-display text-[26px] leading-tight">{title}</h2>
        <p className="text-sm text-muted mt-1">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default function Settings() {
  const { user, isGuest, signOut } = useAuth();
  const [feeds, setFeeds] = useState<CalendarFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null);
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
    } catch (err) {
      setPasswordStatus({ type: 'error', message: (err instanceof Error && err.message) || 'Failed to update password.' });
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
      const result = await importCalendarFeed(feedUrl, feedName);
      setImportResult({ ok: true, message: `Imported ${result.imported} assignment(s) from ${result.total_found || 0} calendar event(s).` });
      await fetchFeeds();
    } catch (err) {
      setImportResult({ ok: false, message: err instanceof Error ? err.message : 'Failed to import calendar.' });
    }
    setImporting(false);
  };

  const handleDeleteFeed = async (id: string) => {
    await supabase.from('calendar_feeds').delete().eq('id', id);
    setFeeds((prev) => prev.filter((f) => f.id !== id));
  };

  const handleReimport = async (feed: CalendarFeed) => {
    await handleImport(feed.feed_url, feed.name);
  };

  return (
    <div>
      <PageHeader eyebrow="Preferences" title="Settings" />

      <Row title="Account" description={isGuest ? 'Guest session — data stays on this device and is not synced.' : 'Signed in and syncing across your devices.'}>
        <div className="panel p-4 sm:p-5">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full bg-primary text-canvas flex items-center justify-center font-display text-xl shrink-0">
              {user?.email ? user.email.charAt(0).toUpperCase() : 'G'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{user?.email || 'Guest Session'}</p>
              <p className={`text-xs mt-0.5 flex items-center gap-1.5 ${isGuest ? 'text-warn' : 'text-ok'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isGuest ? 'bg-warn' : 'bg-ok'}`} />
                {isGuest ? 'Guest mode' : 'Cloud sync active'}
              </p>
            </div>
          </div>

          {!isGuest && user?.id && (
            <div className="mt-4 pt-4 border-t border-line flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="eyebrow">Tampermonkey sync ID</p>
                <p className="font-mono text-xs text-ink truncate mt-1">{user.id}</p>
              </div>
              <button type="button" onClick={handleCopySyncId} className="btn-secondary h-9 px-3 shrink-0">
                {copiedId ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
                {copiedId ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>

        <button onClick={signOut} className="btn-secondary mt-3 hover:!text-danger hover:!border-danger/40">
          <LogOut className="w-4 h-4" />
          {isGuest ? 'Exit guest mode' : 'Sign out'}
        </button>
      </Row>

      {!isGuest && (
        <Row title="Password" description="Update the password for your TeamSync account on all devices.">
          <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
            <div>
              <label htmlFor="new-pw" className="field-label">New password</label>
              <input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="field"
                required
              />
            </div>
            <div>
              <label htmlFor="confirm-pw" className="field-label">Confirm new password</label>
              <input
                id="confirm-pw"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="field"
                required
              />
            </div>
            {passwordStatus && <Notice type={passwordStatus.type}>{passwordStatus.message}</Notice>}
            <button type="submit" disabled={passwordLoading} className="btn-primary">
              {passwordLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update password
            </button>
          </form>
        </Row>
      )}

      <Row title="Calendars" description="Connect Outlook or Microsoft Teams iCal feeds to pull coursework deadlines in automatically. Removing a feed keeps its imported assignments.">
        {isGuest ? (
          <p className="text-sm text-muted panel p-5">Create an account to connect calendar subscriptions.</p>
        ) : (
          <div className="space-y-3">
            {importResult && <Notice type={importResult.ok ? 'success' : 'error'}>{importResult.message}</Notice>}

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              </div>
            ) : (
              feeds.length > 0 && (
                <ul className="panel divide-y divide-line overflow-hidden">
                  {feeds.map((feed) => (
                    <li key={feed.id} className="flex items-center gap-3 px-4 py-3">
                      <Calendar className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{feed.name}</p>
                        <p className="text-xs text-muted truncate">
                          {feed.last_synced_at
                            ? `Synced ${new Date(feed.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                            : feed.feed_url}
                        </p>
                      </div>
                      <button
                        onClick={() => handleReimport(feed)}
                        disabled={importing}
                        className="icon-btn disabled:opacity-50"
                        aria-label={`Re-sync ${feed.name}`}
                        title="Re-sync"
                      >
                        <RefreshCw className={`w-4 h-4 ${importing ? 'animate-spin' : ''}`} />
                      </button>
                      <ConfirmDelete label={`Remove ${feed.name}`} onConfirm={() => handleDeleteFeed(feed.id)} />
                    </li>
                  ))}
                </ul>
              )
            )}

            {showForm ? (
              <form onSubmit={handleAddFeed} className="panel p-4 sm:p-5 space-y-4">
                <div>
                  <label htmlFor="feed-name" className="field-label">
                    Name <span className="text-faint font-normal">· optional</span>
                  </label>
                  <input
                    id="feed-name"
                    autoFocus
                    type="text"
                    placeholder="e.g. Teams Sem I"
                    value={newFeed.name}
                    onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                    className="field"
                  />
                </div>
                <div>
                  <label htmlFor="feed-url" className="field-label">iCal / ICS URL</label>
                  <input
                    id="feed-url"
                    type="url"
                    required
                    placeholder="https://outlook.live.com/owa/calendar/…/calendar.ics"
                    value={newFeed.feed_url}
                    onChange={(e) => setNewFeed({ ...newFeed, feed_url: e.target.value })}
                    className="field"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); setNewFeed({ name: '', feed_url: '' }); }}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={importing} className="btn-primary flex-1 sm:flex-none">
                    {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save feed
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowForm(true)} disabled={importing} className="btn-secondary">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {importing ? 'Importing…' : 'Add calendar'}
              </button>
            )}
          </div>
        )}
      </Row>

      <Row title="About" description="TeamSync installs as an app on iOS, Android and desktop.">
        <p className="text-sm text-muted leading-relaxed max-w-md">
          Your data is protected by per-user row-level security in Postgres and cached locally for fast loading. Use
          your browser&rsquo;s &ldquo;Add to Home Screen&rdquo; or &ldquo;Install app&rdquo; option to install it.
        </p>
      </Row>
    </div>
  );
}
