import { useEffect, useState, useCallback } from 'react';
import { supabase, importCalendarFeed, type Assignment, type NewAssignment, type AssignmentStatus } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { daysFromToday, formatTime, fromLocalInput, relativeDue, subjectColor, toLocalInputString } from '@/lib/format';
import { ConfirmDelete, EmptyState, Notice, PageHeader, Sheet, Spinner } from '@/components/ui';
import { Plus, Check, CalendarPlus, GraduationCap, Search, Link2, Loader2, ChevronRight } from 'lucide-react';

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  submitted: 'Submitted',
  graded: 'Graded',
};

const STATUS_STYLE: Record<AssignmentStatus, string> = {
  pending: 'text-muted bg-sunken',
  in_progress: 'text-info bg-info-soft',
  submitted: 'text-ok bg-ok-soft',
  graded: 'text-ok bg-ok-soft',
};

const EMPTY_FORM: NewAssignment = { title: '', subject: '', deadline: null, attachment_url: '', status: 'pending', source: 'manual' };

function byDeadline(a: Assignment, b: Assignment) {
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
}

function isDone(status: AssignmentStatus) {
  return status === 'submitted' || status === 'graded';
}

function isOverdue(dateStr: string | null, status: AssignmentStatus): boolean {
  if (!dateStr || isDone(status)) return false;
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
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [newAssignment, setNewAssignment] = useState<NewAssignment>(EMPTY_FORM);

  const fetchAssignments = useCallback(async () => {
    if (isGuest) {
      setAssignments([
        { id: 'demo-a1', title: 'Math Problem Set 4', subject: 'Mathematics', deadline: new Date(Date.now() - 86400000).toISOString(), attachment_url: null, status: 'pending', source: 'calendar', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-a2', title: 'Lab Report: Enzyme Kinetics', subject: 'Biology', deadline: new Date(Date.now() + 172800000).toISOString(), attachment_url: null, status: 'in_progress', source: 'calendar', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-a3', title: 'History Essay Draft', subject: 'History', deadline: new Date(Date.now() + 432000000).toISOString(), attachment_url: null, status: 'submitted', source: 'manual', user_id: 'guest', created_at: new Date().toISOString() },
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
          return [...prev, item].sort(byDeadline);
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assignments' }, (payload) => {
        const item = payload.new as Assignment;
        if (item.user_id && item.user_id !== user?.id) return;
        setAssignments((prev) => prev.map((a) => (a.id === item.id ? item : a)).sort(byDeadline));
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
      setAssignments((prev) => [...prev, assignment].sort(byDeadline));
      setNewAssignment(EMPTY_FORM);
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
      setAssignments((prev) => (prev.some((a) => a.id === data.id) ? prev : [...prev, data].sort(byDeadline)));
    }

    setNewAssignment(EMPTY_FORM);
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
    setImportSuccess(null);
    try {
      const result = await importCalendarFeed(importUrl.trim(), importName.trim() || 'Imported Calendar');
      setImportUrl('');
      setImportName('');
      setShowImport(false);
      setImportSuccess(`Imported ${result.imported} assignment(s) from ${result.total_found || 0} calendar event(s).`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import calendar.');
    }
    setSyncing(false);
  };

  const subjects = [...new Set(assignments.map((a) => a.subject).filter((s): s is string => !!s))].sort();
  const q = query.trim().toLowerCase();
  const visible = assignments.filter(
    (a) =>
      (!subjectFilter || a.subject === subjectFilter) &&
      (!q || a.title.toLowerCase().includes(q) || a.subject?.toLowerCase().includes(q))
  );

  const overdueList = visible.filter((a) => isOverdue(a.deadline, a.status));
  const openList = visible.filter((a) => !isOverdue(a.deadline, a.status) && !isDone(a.status));
  const thisWeek = openList.filter((a) => a.deadline && daysFromToday(a.deadline) <= 7);
  const later = openList.filter((a) => a.deadline && daysFromToday(a.deadline) > 7);
  const undated = openList.filter((a) => !a.deadline);
  const completedList = visible.filter((a) => isDone(a.status));

  const totalOverdue = assignments.filter((a) => isOverdue(a.deadline, a.status)).length;
  const totalDone = assignments.filter((a) => isDone(a.status)).length;
  const filtering = !!q || !!subjectFilter;

  const row = (a: Assignment) => (
    <AssignmentRow key={a.id} assignment={a} onStatus={handleStatusChange} onDelete={handleDelete} />
  );

  return (
    <div>
      <PageHeader
        eyebrow="Coursework"
        title="Assignments"
        meta={
          <>
            {assignments.length - totalDone} open
            {totalOverdue > 0 && <span className="text-danger font-medium"> · {totalOverdue} overdue</span>} · {totalDone} submitted
          </>
        }
        actions={
          <>
            {!isGuest && (
              <button onClick={() => { setImportError(null); setShowImport(true); }} className="btn-secondary">
                <CalendarPlus className="w-4 h-4" /> <span className="hidden sm:inline">Import</span>
                <span className="sr-only sm:hidden">Import calendar</span>
              </button>
            )}
            <button onClick={() => setShowForm(true)} className="btn-primary flex-1 sm:flex-none">
              <Plus className="w-4 h-4" /> New assignment
            </button>
          </>
        }
      />

      <Sheet
        open={showImport}
        onClose={() => setShowImport(false)}
        title="Import a calendar"
        description="Paste an Outlook or Teams iCal link. Deadlines become assignments."
      >
        <form onSubmit={handleImportCalendar} className="space-y-4">
          <div>
            <label htmlFor="imp-name" className="field-label">
              Name <span className="text-faint font-normal">· optional</span>
            </label>
            <input id="imp-name" autoFocus type="text" placeholder="e.g. Teams / Outlook" value={importName} onChange={(e) => setImportName(e.target.value)} className="field" />
          </div>
          <div>
            <label htmlFor="imp-url" className="field-label">iCal / ICS URL</label>
            <input
              id="imp-url"
              type="url"
              required
              placeholder="https://outlook.live.com/owa/calendar/…/calendar.ics"
              value={importUrl}
              onChange={(e) => setImportUrl(e.target.value)}
              className="field"
            />
          </div>
          {importError && <Notice type="error">{importError}</Notice>}
          <button type="submit" disabled={syncing} className="btn-primary w-full">
            {syncing && <Loader2 className="w-4 h-4 animate-spin" />}
            Import deadlines
          </button>
        </form>
      </Sheet>

      <Sheet open={showForm} onClose={() => setShowForm(false)} title="New assignment">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label htmlFor="as-title" className="field-label">Title</label>
            <input
              id="as-title"
              autoFocus
              required
              type="text"
              placeholder="e.g. Lab report 3"
              value={newAssignment.title}
              onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
              className="field"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="as-subject" className="field-label">Subject</label>
              <input
                id="as-subject"
                type="text"
                list="as-subjects"
                placeholder="Class name"
                value={newAssignment.subject ?? ''}
                onChange={(e) => setNewAssignment({ ...newAssignment, subject: e.target.value })}
                className="field"
              />
              <datalist id="as-subjects">
                {subjects.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="as-deadline" className="field-label">Deadline</label>
              <input
                id="as-deadline"
                type="datetime-local"
                value={toLocalInputString(newAssignment.deadline)}
                onChange={(e) => setNewAssignment({ ...newAssignment, deadline: fromLocalInput(e.target.value) })}
                className="field"
              />
            </div>
          </div>
          <div>
            <label htmlFor="as-url" className="field-label">
              Reference link <span className="text-faint font-normal">· optional</span>
            </label>
            <input
              id="as-url"
              type="url"
              placeholder="https://"
              value={newAssignment.attachment_url ?? ''}
              onChange={(e) => setNewAssignment({ ...newAssignment, attachment_url: e.target.value })}
              className="field"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 sm:flex-none">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">Add assignment</button>
          </div>
        </form>
      </Sheet>

      {importSuccess && <div className="mb-4"><Notice type="success">{importSuccess}</Notice></div>}

      {assignments.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-faint pointer-events-none" />
            <input
              type="search"
              aria-label="Search assignments"
              placeholder="Search assignments"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field pl-10"
            />
          </div>
          {subjects.length > 0 && (
            <select
              aria-label="Filter by subject"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="field sm:w-52 cursor-pointer"
            >
              <option value="">All subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <div className="panel">
          {filtering ? (
            <EmptyState icon={Search} title="No matches" body="Try a different search or subject." />
          ) : (
            <EmptyState icon={GraduationCap} title="No assignments yet" body="Add one manually or import your Teams calendar." />
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {overdueList.length > 0 && (
            <Section title="Overdue" count={overdueList.length} tone="danger">
              {overdueList.map(row)}
            </Section>
          )}
          {thisWeek.length > 0 && <Section title="Next 7 days" count={thisWeek.length}>{thisWeek.map(row)}</Section>}
          {later.length > 0 && <Section title="Later" count={later.length}>{later.map(row)}</Section>}
          {undated.length > 0 && <Section title="No deadline" count={undated.length}>{undated.map(row)}</Section>}
          {openList.length === 0 && overdueList.length === 0 && (
            <p className="font-display text-2xl text-ink">Nothing open. Well done.</p>
          )}

          {completedList.length > 0 && (
            <details className="group">
              <summary className="flex items-center gap-2 cursor-pointer list-none select-none mb-3 w-fit [&::-webkit-details-marker]:hidden">
                <ChevronRight className="w-4 h-4 text-muted transition-transform group-open:rotate-90" />
                <span className="eyebrow">Submitted & graded</span>
                <span className="text-xs text-faint">{completedList.length}</span>
              </summary>
              <ul className="panel divide-y divide-line overflow-hidden">{completedList.map(row)}</ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, count, tone, children }: { title: string; count: number; tone?: 'danger'; children: React.ReactNode }) {
  return (
    <section>
      <h2 className={`eyebrow mb-3 flex items-center gap-2 ${tone === 'danger' ? '!text-danger' : ''}`}>
        {tone === 'danger' && <span className="w-1.5 h-1.5 rounded-full bg-danger" />}
        {title}
        <span className="text-faint font-medium tracking-normal">{count}</span>
      </h2>
      <ul className={`panel divide-y divide-line overflow-hidden ${tone === 'danger' ? 'border-danger/30' : ''}`}>{children}</ul>
    </section>
  );
}

function AssignmentRow({
  assignment: a,
  onStatus,
  onDelete,
}: {
  assignment: Assignment;
  onStatus: (id: string, s: AssignmentStatus) => void;
  onDelete: (id: string) => void;
}) {
  const done = isDone(a.status);
  const overdue = isOverdue(a.deadline, a.status);
  const due = a.deadline ? new Date(a.deadline) : null;
  const soon = !!a.deadline && !done && !overdue && daysFromToday(a.deadline) <= 1;
  const tag = subjectColor(a.subject);

  return (
    <li className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4 transition-colors hover:bg-canvas/50">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Move "${a.title}" back to pending` : `Mark "${a.title}" as submitted`}
        onClick={() => onStatus(a.id, done ? 'pending' : 'submitted')}
        className={`mt-1 w-[22px] h-[22px] shrink-0 rounded-md border-[1.5px] flex items-center justify-center transition-colors duration-150 ${
          done ? 'bg-primary border-primary text-canvas' : overdue ? 'border-danger hover:bg-danger-soft' : 'border-faint hover:border-primary hover:bg-primary-soft'
        }`}
      >
        {done && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
      </button>

      <div className="hidden sm:flex flex-col items-center w-11 shrink-0 pt-0.5" aria-hidden>
        {due ? (
          <>
            <span className={`font-display text-[28px] leading-none ${overdue ? 'text-danger' : 'text-ink'}`}>{due.getDate()}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted mt-1">
              {due.toLocaleDateString('en-US', { month: 'short' })}
            </span>
          </>
        ) : (
          <span className="font-display text-[28px] leading-none text-faint">—</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {a.subject && (
          <span className="inline-block max-w-full truncate align-top text-[11px] font-semibold px-1.5 py-0.5 rounded mb-1.5" style={tag}>
            {a.subject}
          </span>
        )}
        <p className={`text-[15px] font-medium leading-snug break-words ${done ? 'line-through text-faint' : 'text-ink'}`}>{a.title}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2 text-xs">
          <select
            aria-label="Status"
            value={a.status}
            onChange={(e) => onStatus(a.id, e.target.value as AssignmentStatus)}
            className={`h-7 pl-2 pr-1 rounded-md font-medium border-0 cursor-pointer ${STATUS_STYLE[a.status]}`}
          >
            {(Object.keys(STATUS_LABEL) as AssignmentStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
          {a.deadline && (
            <span className={overdue ? 'text-danger font-medium' : soon ? 'text-warn font-medium' : 'text-muted'}>
              <span className="sm:hidden">{due!.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, </span>
              {formatTime(a.deadline)}
              {!done && <> · {relativeDue(a.deadline)}</>}
            </span>
          )}
          {a.attachment_url && (
            <a
              href={a.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary font-medium hover:underline underline-offset-2"
            >
              <Link2 className="w-3.5 h-3.5" /> Reference
            </a>
          )}
        </div>
      </div>

      <ConfirmDelete label="Delete assignment" onConfirm={() => onDelete(a.id)} />
    </li>
  );
}
