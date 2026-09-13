import { useEffect, useState, useCallback } from 'react';
import { supabase, type Assignment, type NewAssignment, type AssignmentStatus } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, Clock, BookOpen, ExternalLink,
  X, Loader2, GraduationCap, RefreshCw, CheckCircle2, Calendar,
} from 'lucide-react';

function toLocalInputString(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDeadline(dateStr: string | null): string {
  if (!dateStr) return 'No deadline';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (diff < 0) return `Overdue by ${Math.abs(days)}d`;
  if (hours < 24) return `Due in ${hours}h`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `Due in ${days}d · ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function isOverdue(dateStr: string | null, status: AssignmentStatus): boolean {
  if (!dateStr || status === 'submitted' || status === 'graded') return false;
  return new Date(dateStr) < new Date();
}

export default function Assignments() {
  const { user, isGuest } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importName, setImportName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState<NewAssignment>({
    title: '',
    subject: '',
    deadline: null,
    attachment_url: '',
    status: 'pending',
    source: 'manual',
  });

  const fetchAssignments = useCallback(async () => {
    if (isGuest) {
      setAssignments([
        { id: 'demo-a1', title: 'Math Problem Set 4', subject: 'Mathematics', deadline: new Date(Date.now() + 172800000).toISOString(), attachment_url: null, status: 'pending', source: 'calendar', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-a2', title: 'Lab Report: Enzyme Kinetics', subject: 'Biology', deadline: new Date(Date.now() + 432000000).toISOString(), attachment_url: 'https://example.com/lab-guide.pdf', status: 'in_progress', source: 'calendar', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-a3', title: 'History Essay Draft', subject: 'History', deadline: new Date(Date.now() + 604800000).toISOString(), attachment_url: null, status: 'pending', source: 'manual', user_id: 'guest', created_at: new Date().toISOString() },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('assignments')
      .select('*')
      .order('deadline', { ascending: true, nullsFirst: false });

    if (error) {
      console.error('Failed to load assignments:', error.message);
    } else {
      setAssignments(data ?? []);
    }
    setLoading(false);
  }, [isGuest]);

  useEffect(() => {
    fetchAssignments();

    if (isGuest) return;

    const channel = supabase
      .channel('assignments-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assignments' }, (payload) => {
        const item = payload.new as Assignment;
        if (item.user_id && item.user_id !== user?.id) return;
        setAssignments((prev) => {
          if (prev.some((a) => a.id === item.id)) return prev;
          const updated = [...prev, item];
          return updated.sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          });
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignments' }, (payload) => {
        const item = payload.new as Assignment;
        if (item.user_id && item.user_id !== user?.id) return;
        setAssignments((prev) => {
          const updated = prev.map((a) => (a.id === item.id ? item : a));
          return updated.sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          });
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'assignments' }, (payload) => {
        setAssignments((prev) => prev.filter((a) => a.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAssignments, isGuest, user?.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssignment.title.trim()) return;

    if (isGuest) {
      const assignment: Assignment = {
        id: `local-${Date.now()}`,
        title: newAssignment.title.trim(),
        subject: newAssignment.subject?.trim() || null,
        deadline: newAssignment.deadline || null,
        attachment_url: newAssignment.attachment_url?.trim() || null,
        status: 'pending',
        source: 'manual',
        user_id: 'guest',
        created_at: new Date().toISOString(),
      };
      setAssignments((prev) => [...prev, assignment].sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }));
      setNewAssignment({ title: '', subject: '', deadline: null, attachment_url: '', status: 'pending', source: 'manual' });
      setShowForm(false);
      return;
    }

    const payload = {
      title: newAssignment.title.trim(),
      subject: newAssignment.subject?.trim() || null,
      deadline: newAssignment.deadline || null,
      attachment_url: newAssignment.attachment_url?.trim() || null,
      status: 'pending' as AssignmentStatus,
      source: 'manual',
      user_id: user?.id,
    };

    const { data, error } = await supabase
      .from('assignments')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Failed to add assignment:', error.message);
      return;
    }

    if (data) {
      setAssignments((prev) => [...prev, data].sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }));
    }

    setNewAssignment({ title: '', subject: '', deadline: null, attachment_url: '', status: 'pending', source: 'manual' });
    setShowForm(false);
  };

  const handleStatusChange = async (id: string, status: AssignmentStatus) => {
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );

    if (!isGuest) {
      const { error } = await supabase
        .from('assignments')
        .update({ status })
        .eq('id', id);

      if (error) {
        console.error('Failed to update status:', error.message);
        fetchAssignments();
      }
    }
  };

  const handleDelete = async (id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));

    if (!isGuest) {
      const { error } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Failed to delete assignment:', error.message);
        fetchAssignments();
      }
    }
  };

  const handleImportCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;
    setSyncing(true);
    setImportError(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-import`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ feed_url: importUrl.trim(), feed_name: importName.trim() || 'Imported Calendar' }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Import failed (${response.status})`);
      }
      setImportUrl('');
      setImportName('');
      setShowImport(false);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import calendar.');
    }
    setSyncing(false);
  };

  const pendingCount = assignments.filter((a) => a.status === 'pending' || a.status === 'in_progress').length;
  const overdueCount = assignments.filter((a) => isOverdue(a.deadline, a.status)).length;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-indigo-400" />
            Assignments
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {pendingCount} pending{overdueCount > 0 && ` · ${overdueCount} overdue`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 border border-white/[0.06] px-3.5 py-2 rounded-xl font-medium text-xs flex items-center gap-2 transition-all active:scale-95"
          >
            {showImport ? <X className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
            {showImport ? 'Cancel' : 'Import'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-b from-indigo-500 to-indigo-600 hover:brightness-110 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.35)] active:scale-95"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {/* Calendar Import Card */}
      {showImport && (
        <form onSubmit={handleImportCalendar} className="glass-panel rounded-2xl p-5 mb-6 space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Calendar Name (optional)</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. Teams / Outlook"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              className="w-full glass-input rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">iCal / ICS URL</label>
            <input
              type="url"
              required
              placeholder="https://outlook.live.com/owa/calendar/.../calendar.ics"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="w-full glass-input rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none"
            />
          </div>
          {importError && (
            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3.5 py-2.5">
              {importError}
            </div>
          )}
          <button
            type="submit"
            disabled={syncing}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-xl transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Import Deadlines
          </button>
        </form>
      )}

      {/* Manual Creation Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="glass-panel rounded-2xl p-5 mb-6 space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Assignment title..."
            value={newAssignment.title}
            onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
            className="w-full glass-input rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Subject / Class name"
              value={newAssignment.subject ?? ''}
              onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })}
              className="w-full glass-input rounded-xl px-3.5 py-2 text-white placeholder-zinc-500 text-sm focus:outline-none"
            />
            <input
              type="datetime-local"
              value={toLocalInputString(newAssignment.deadline)}
              onChange={(e) => {
                if (!e.target.value) {
                  setNewAssignment({ ...newAssignment, deadline: null });
                  return;
                }
                const local = new Date(e.target.value);
                setNewAssignment({ ...newAssignment, deadline: local.toISOString() });
              }}
              className="w-full glass-input rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none [color-scheme:dark]"
            />
          </div>
          <input
            type="url"
            placeholder="Reference material URL (optional)"
            value={newAssignment.attachment_url ?? ''}
            onChange={(e) => setNewAssignment({ ...newAssignment, attachment_url: e.target.value })}
            className="w-full glass-input rounded-xl px-4 py-2 text-white placeholder-zinc-500 text-sm focus:outline-none"
          />
          <button
            type="submit"
            className="w-full bg-gradient-to-b from-indigo-500 to-indigo-600 hover:brightness-110 text-white font-medium py-2.5 rounded-xl transition-all text-xs shadow-md shadow-indigo-500/20"
          >
            Add Assignment
          </button>
        </form>
      )}

      {/* Main Assignment List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No assignments found. Sync with Teams or add one above!</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {assignments.map((assignment) => (
            <div
              key={assignment.id}
              className="glass-panel hover:border-white/[0.14] rounded-2xl p-4 transition-all duration-200 active:scale-[0.99] flex flex-col gap-3 group"
            >
              {/* Top Row */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 truncate">
                    {assignment.subject || 'Assignment'}
                  </span>
                </div>

                {assignment.deadline && (
                  <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/[0.06] text-zinc-300 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {formatDeadline(assignment.deadline)}
                  </span>
                )}
              </div>

              {/* Title */}
              <div>
                <h3 className="text-white font-medium text-[15px] leading-snug tracking-tight group-hover:text-indigo-200 transition-colors">
                  {assignment.title}
                </h3>
              </div>

              {/* Bottom Action Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/[0.05]">
                  {(['pending', 'in_progress', 'submitted', 'graded'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(assignment.id, st)}
                      className={`text-[10px] font-medium px-2.5 py-1 rounded-lg capitalize transition-all ${
                        assignment.status === st
                          ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                          : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(assignment.id)}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Delete assignment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}