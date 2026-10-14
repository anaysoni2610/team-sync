import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, type Assignment, type Task } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatTime, isSameDay, subjectColor } from '@/lib/format';
import { EmptyState, PageHeader, Spinner } from '@/components/ui';
import { ChevronLeft, ChevronRight, Check, Coffee } from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const isDone = (a: Assignment) => a.status === 'submitted' || a.status === 'graded';

// Dot colours, in priority order: overdue > in progress > pending > all done. Tasks get their own dot.
const DOT = {
  overdue: { cls: 'bg-danger', label: 'Overdue' },
  in_progress: { cls: 'bg-info', label: 'In progress' },
  pending: { cls: 'bg-warn', label: 'Pending' },
  done: { cls: 'bg-ok', label: 'Submitted' },
  task: { cls: 'bg-ink', label: 'Task' },
};

function assignmentDot(a: Assignment): keyof typeof DOT {
  if (isDone(a)) return 'done';
  if (new Date(a.deadline!) < new Date()) return 'overdue';
  return a.status === 'in_progress' ? 'in_progress' : 'pending';
}

export default function Agenda() {
  const { isGuest } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    if (isGuest) {
      setAssignments([
        { id: 'demo-1', title: 'Math Problem Set 4', subject: 'Mathematics', deadline: new Date(Date.now() - 86400000).toISOString(), attachment_url: null, status: 'pending', source: 'calendar', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-2', title: 'Lab Report: Enzyme Kinetics', subject: 'Biology', deadline: new Date(Date.now() + 86400000).toISOString(), attachment_url: null, status: 'in_progress', source: 'calendar', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-3', title: 'History Essay Draft', subject: 'History', deadline: new Date(Date.now() + 172800000).toISOString(), attachment_url: null, status: 'submitted', source: 'manual', user_id: 'guest', created_at: new Date().toISOString() },
      ]);
      setTasks([
        { id: 'demo-t1', title: 'Review lecture notes', description: null, due_date: new Date(Date.now() + 86400000).toISOString(), status: 'pending', user_id: 'guest', created_at: new Date().toISOString() },
      ]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [assignmentsRes, tasksRes] = await Promise.all([
        supabase.from('assignments').select('*').order('deadline', { ascending: true }),
        supabase.from('tasks').select('*').order('due_date', { ascending: true })
      ]);

      if (assignmentsRes.data) setAssignments(assignmentsRes.data);
      if (tasksRes.data) setTasks(tasksRes.data);
    } catch (err) {
      console.error('Failed to load agenda data:', err);
    } finally {
      setLoading(false);
    }
  }, [isGuest]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const itemsOn = useCallback(
    (date: Date) => ({
      assignments: assignments.filter((a) => a.deadline && isSameDay(new Date(a.deadline), date)),
      tasks: tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), date)),
    }),
    [assignments, tasks]
  );

  const dayDots = (dayAssignments: Assignment[], dayTasks: Task[]) => {
    const now = new Date();
    const dots: (keyof typeof DOT)[] = [];
    if (dayAssignments.some((a) => !isDone(a) && new Date(a.deadline!) < now)) dots.push('overdue');
    else if (dayAssignments.some((a) => a.status === 'in_progress')) dots.push('in_progress');
    else if (dayAssignments.some((a) => a.status === 'pending')) dots.push('pending');
    else if (dayAssignments.length > 0) dots.push('done');
    if (dayTasks.length > 0) dots.push('task');
    return dots;
  };

  const selected = useMemo(() => itemsOn(selectedDate), [itemsOn, selectedDate]);
  const selectedTotal = selected.assignments.length + selected.tasks.length;
  const today = new Date();

  const monthCount = useMemo(
    () =>
      assignments.filter((a) => {
        if (!a.deadline) return false;
        const d = new Date(a.deadline);
        return d.getFullYear() === year && d.getMonth() === month && !isDone(a);
      }).length,
    [assignments, year, month]
  );

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title="Agenda"
        meta={`${monthCount} open deadline${monthCount === 1 ? '' : 's'} in ${MONTHS[month]}`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] items-start">
        <section className="panel p-3 sm:p-5" aria-label="Month calendar">
          <div className="flex items-center justify-between gap-3 mb-4 px-1">
            <h2 className="font-display text-[30px] leading-none">
              {MONTHS[month]} <span className="text-faint">{year}</span>
            </h2>
            <div className="flex items-center gap-1">
              <button onClick={goToToday} className="btn-ghost h-9 px-3">Today</button>
              <button onClick={prevMonth} className="icon-btn" aria-label="Previous month">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={nextMonth} className="icon-btn" aria-label="Next month">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="eyebrow !tracking-[0.08em] py-2">
                <span className="sm:hidden">{d[0]}</span>
                <span className="hidden sm:inline">{d}</span>
              </div>
            ))}
          </div>

          {loading ? (
            <Spinner />
          ) : (
            <div className="grid grid-cols-7 gap-px bg-line border border-line rounded-lg overflow-hidden">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-canvas/60" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const thisDate = new Date(year, month, dayNum);
                const isToday = isSameDay(thisDate, today);
                const isSelected = isSameDay(thisDate, selectedDate);
                const { assignments: dayA, tasks: dayT } = itemsOn(thisDate);
                const dots = dayDots(dayA, dayT);
                const titles = [
                  ...dayA.map((a) => ({ title: a.title, cls: DOT[assignmentDot(a)].cls })),
                  ...dayT.map((t) => ({ title: t.title, cls: DOT.task.cls })),
                ];
                const total = titles.length;

                return (
                  <button
                    key={dayNum}
                    onClick={() => setSelectedDate(thisDate)}
                    aria-pressed={isSelected}
                    aria-label={`${thisDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${total ? `, ${total} item${total === 1 ? '' : 's'}` : ''}`}
                    className={`relative flex flex-col items-center md:items-stretch text-left aspect-square md:aspect-auto md:min-h-[92px] p-1 md:p-2 transition-colors duration-150 focus-visible:z-10 ${
                      isSelected ? 'bg-primary-soft' : 'bg-surface hover:bg-canvas'
                    }`}
                  >
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-full text-[13px] tabular-nums ${
                        isToday ? 'bg-primary text-canvas font-semibold' : total ? 'text-ink font-medium' : 'text-faint'
                      }`}
                    >
                      {dayNum}
                    </span>

                    {/* Phones: status dots. Desktop: first titles. */}
                    {dots.length > 0 && (
                      <span className="flex gap-1 mt-auto mb-1 md:hidden">
                        {dots.map((d) => (
                          <span key={d} className={`w-1.5 h-1.5 rounded-full ${DOT[d].cls}`} />
                        ))}
                      </span>
                    )}
                    {total > 0 && (
                      <span className="hidden md:flex flex-col gap-0.5 mt-1 min-w-0">
                        {titles.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="flex items-center gap-1 text-[11px] leading-tight text-ink truncate">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.cls}`} />
                            <span className="truncate">{t.title}</span>
                          </span>
                        ))}
                        {total > 2 && <span className="text-[11px] text-muted pl-2.5">+{total - 2} more</span>}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 px-1 text-xs text-muted" aria-label="Legend">
            {Object.values(DOT).map((d) => (
              <li key={d.label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${d.cls}`} />
                {d.label}
              </li>
            ))}
          </ul>
        </section>

        <aside className="xl:sticky xl:top-12" aria-live="polite">
          <p className="eyebrow">{isSameDay(selectedDate, today) ? 'Today' : selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</p>
          <h2 className="font-display text-[34px] leading-tight mt-1">
            {selectedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </h2>
          <p className="text-sm text-muted mb-4">
            {selectedTotal === 0 ? 'Nothing due' : `${selectedTotal} item${selectedTotal === 1 ? '' : 's'} due`}
          </p>

          {selectedTotal === 0 ? (
            <div className="panel">
              <EmptyState icon={Coffee} title="A free day" body="Nothing scheduled or due on this date." />
            </div>
          ) : (
            <ul className="panel divide-y divide-line overflow-hidden">
              {selected.assignments.map((item) => {
                const done = isDone(item);
                const late = !done && new Date(item.deadline!) < new Date();
                const statusText = late ? 'Overdue' : item.status.replace('_', ' ');
                return (
                  <li key={item.id} className="px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium tabular-nums text-muted">{formatTime(item.deadline!)}</span>
                      <span className={`capitalize font-medium ${late ? 'text-danger' : done ? 'text-ok' : item.status === 'in_progress' ? 'text-info' : 'text-warn'}`}>
                        {statusText}
                      </span>
                    </div>
                    <p className={`text-[15px] font-medium mt-1 break-words ${done ? 'line-through text-faint' : 'text-ink'}`}>{item.title}</p>
                    {item.subject && (
                      <span className="inline-block mt-1.5 text-[11px] font-semibold px-1.5 py-0.5 rounded" style={subjectColor(item.subject)}>
                        {item.subject}
                      </span>
                    )}
                  </li>
                );
              })}
              {selected.tasks.map((task) => {
                const done = task.status === 'completed';
                return (
                  <li key={task.id} className="px-4 py-3.5 flex items-start gap-3">
                    <span
                      className={`mt-0.5 w-[18px] h-[18px] rounded-full border-[1.5px] shrink-0 flex items-center justify-center ${
                        done ? 'bg-primary border-primary text-canvas' : 'border-faint'
                      }`}
                      aria-label={done ? 'Completed' : 'Not completed'}
                    >
                      {done && <Check className="w-3 h-3" strokeWidth={3} />}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-[15px] font-medium break-words ${done ? 'line-through text-faint' : 'text-ink'}`}>{task.title}</p>
                      <p className="text-xs text-muted mt-0.5 tabular-nums">Task · {formatTime(task.due_date!)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
