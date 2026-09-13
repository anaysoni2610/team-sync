import { useEffect, useState, useCallback } from 'react';
import { supabase, type Assignment, type NewAssignment, type AssignmentStatus } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, Clock, BookOpen, ExternalLink,
  X, Loader2, GraduationCap, RefreshCw, CheckCircle2, Calendar,
} from 'lucide-react';

const statusConfig: Record<AssignmentStatus, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Pending' },
  in_progress: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'In Progress' },
  submitted: { color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', label: 'Submitted' },
  graded: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Graded' },
};

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
  const { isGuest } = useAuth();
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
        setAssignments((prev) => {
          if (prev.some((a) => a.id === payload.new.id)) return prev;
          const updated = [...prev, payload.new as Assignment];
          return updated.sort((a, b) => {
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
          });
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignments' }, (payload) => {
        setAssignments((prev) => {
          const updated = prev.map((a) => (a.id === payload.new.id ? payload.new as Assignment : a));
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
  }, [fetchAssignments, isGuest]);

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
    };

    const { error } = await supabase.from('assignments').insert(payload);
    if (error) {
      console.error('Failed to add assignment:', error.message);
      return;
    }
    setNewAssignment({ title: '', subject: '', deadline: null, attachment_url: '', status: 'pending', source: 'manual' });
    setShowForm(false);
  };

  const handleStatusChange = async (id: string, status: AssignmentStatus) => {
    // 1. Immediately update UI state on screen (Zero lag)
    setAssignments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status } : a))
    );

    // 2. Persist change to Supabase in the background
    if (!isGuest) {
      const { error } = await supabase
        .from('assignments')
        .update({ status })
        .eq('id', id);

      if (error) {
        console.error('Failed to update status:', error.message);
        fetchAssignments(); // Revert back to database state if network failed
      }
    }
  };

  const handleDelete = async (id: string) => {
    // 1. Immediately remove from screen
    setAssignments((prev) => prev.filter((a) => a.id !== id));

    // 2. Delete from Supabase
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-teal-400" />
            Assignments
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {pendingCount} pending{overdueCount > 0 && ` · ${overdueCount} overdue`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="bg-slate-700/50 hover:bg-slate-700 text-white px-3 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all"
          >
            {showImport ? <X className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
            {showImport ? 'Cancel' : 'Import Calendar'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {showImport && (
        <form onSubmit={handleImportCalendar} className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-5 mb-6 space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Calendar name (optional)</label>
            <input
              autoFocus
              type="text"
              placeholder="e.g. My Teams Calendar"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1 block">iCal / ICS URL from Outlook or Teams</label>
            <input
              type="url"
              required
              placeholder="https://outlook.live.com/owa/calendar/.../calendar.ics"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
          </div>
          {importError && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2.5">
              {importError}
            </div>
          )}
          <button
            type="submit"
            disabled={syncing}
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Import Deadlines
          </button>
        </form>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-5 mb-6 space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Assignment title..."
            value={newAssignment.title}
            onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Subject / Class name"
              value={newAssignment.subject ?? ''}
              onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            />
            <input
              type="datetime-local"
              value={newAssignment.deadline ? new Date(newAssignment.deadline).toISOString().slice(0, 16) : ''}
              onChange={(e) => setNewAssignment({ ...newAssignment, deadline: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 [color-scheme:dark]"
            />
          </div>
          <input
            type="url"
            placeholder="Reference material URL (optional)"
            value={newAssignment.attachment_url ?? ''}
            onChange={(e) => setNewAssignment({ ...newAssignment, attachment_url: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
          <button
            type="submit"
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-all text-sm"
          >
            Add Assignment
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
        </div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-16">
          <GraduationCap className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No assignments yet. Add one manually or import from your calendar!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map((assignment) => {
            const sc = statusConfig[assignment.status];
            const overdue = isOverdue(assignment.deadline, assignment.status);
            return (
              <div
                key={assignment.id}
                className="group bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-4 transition-all hover:border-slate-600/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {assignment.source === 'calendar' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          Imported
                        </span>
                      )}
                      <h3 className="text-white font-medium truncate">{assignment.title}</h3>
                    </div>
                    {assignment.subject && (
                      <p className="text-slate-400 text-sm flex items-center gap-1 mb-1">
                        <BookOpen className="w-3.5 h-3.5" />
                        {assignment.subject}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {assignment.deadline && (
                        <span className={`text-xs px-2 py-0.5 rounded-md flex items-center gap-1 ${
                          overdue ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-slate-700/50 text-slate-300'
                        }`}>
                          <Clock className="w-3 h-3" />
                          {formatDeadline(assignment.deadline)}
                        </span>
                      )}
                      {assignment.attachment_url && (
                        <a
                          href={assignment.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1 hover:bg-blue-500/20 transition-all"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Reference
                        </a>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(assignment.id)}
                    className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/40">
                  <div className="flex gap-1">
                    {(['pending', 'in_progress', 'submitted', 'graded'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(assignment.id, s)}
                        className={`text-xs px-2.5 py-1 rounded-md transition-all ${
                          assignment.status === s
                            ? `${statusConfig[s].bg} ${statusConfig[s].border} ${statusConfig[s].color} border`
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {assignment.status === s && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                        {statusConfig[s].label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
