import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, type Assignment, type Task } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  CheckCircle2,
  Circle,
  X,
  Sparkles,
  GraduationCap,
} from 'lucide-react';

export default function Agenda() {
  const { user, isGuest } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getDayAnalytics = (day: number) => {
    const targetDate = new Date(year, month, day);

    const dayAssignments = assignments.filter((a) => {
      if (!a.deadline) return false;
      return isSameDay(new Date(a.deadline), targetDate);
    });

    const dayTasks = tasks.filter((t) => {
      if (!t.due_date) return false;
      return isSameDay(new Date(t.due_date), targetDate);
    });

    const now = new Date();
    const hasOverdue = dayAssignments.some(
      (a) => (a.status !== 'submitted' && a.status !== 'graded') && new Date(a.deadline!) < now
    );
    const hasInProgress = dayAssignments.some(
      (a) => a.status === 'in_progress'
    );
    const hasPending = dayAssignments.some(
      (a) => a.status === 'pending'
    );
    const allCompleted = dayAssignments.length > 0 && dayAssignments.every(
      (a) => a.status === 'submitted' || a.status === 'graded'
    );

    return {
      assignments: dayAssignments,
      tasks: dayTasks,
      total: dayAssignments.length + dayTasks.length,
      hasOverdue,
      hasInProgress,
      hasPending,
      allCompleted,
    };
  };

  const selectedDayItems = useMemo(() => {
    if (!selectedDate) return { assignments: [], tasks: [], total: 0 };
    const dayAssignments = assignments.filter((a) => a.deadline && isSameDay(new Date(a.deadline), selectedDate));
    const dayTasks = tasks.filter((t) => t.due_date && isSameDay(new Date(t.due_date), selectedDate));
    return { assignments: dayAssignments, tasks: dayTasks, total: dayAssignments.length + dayTasks.length };
  }, [selectedDate, assignments, tasks]);

  const handleDateClick = (day: number) => {
    setSelectedDate(new Date(year, month, day));
    setIsModalOpen(true);
  };

  const today = new Date();

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
            <CalendarDays className="w-6 h-6 text-indigo-400" />
            Agenda
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Dynamic calendar tracking: sky for in progress, amber for pending, rose for overdue, emerald for done
          </p>
        </div>
      </div>

      {/* Calendar Matrix Card */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 shadow-2xl mb-6">
        {/* Navigation Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">
              {monthNames[month]}
            </h2>
            <span className="text-sm font-mono text-zinc-500 font-medium">{year}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="text-xs px-3 py-1.5 rounded-xl bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-medium border border-white/[0.06] transition-all active:scale-95"
            >
              Today
            </button>
            <div className="flex items-center bg-black/40 border border-white/[0.05] rounded-xl p-0.5">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all active:scale-90"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all active:scale-90"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-mono font-medium text-zinc-500 uppercase tracking-wider mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square opacity-0 pointer-events-none" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const thisDate = new Date(year, month, dayNum);
            const isToday = isSameDay(thisDate, today);
            const { total, hasOverdue, hasInProgress, hasPending, allCompleted, tasks: dayT } = getDayAnalytics(dayNum);

            return (
              <button
                key={dayNum}
                onClick={() => handleDateClick(dayNum)}
                className={`aspect-square rounded-2xl p-1.5 sm:p-2 flex flex-col justify-between items-center relative transition-all duration-200 active:scale-90 group ${
                  isToday
                    ? 'bg-indigo-600/20 border-2 border-indigo-500/80 shadow-[0_0_16px_rgba(99,102,241,0.25)]'
                    : total > 0
                    ? 'bg-zinc-850/60 border border-white/[0.09] hover:border-indigo-500/50 hover:bg-zinc-800'
                    : 'bg-zinc-900/30 border border-white/[0.03] hover:bg-zinc-800/40 hover:border-white/[0.08]'
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    isToday ? 'text-indigo-300 font-bold' : total > 0 ? 'text-zinc-100' : 'text-zinc-500'
                  }`}
                >
                  {dayNum}
                </span>

                {/* Status Color Indicators */}
                {total > 0 && (
                  <div className="flex items-center gap-1 mt-auto pb-0.5">
                    {/* 1. Overdue takes top priority */}
                    {hasOverdue && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse"
                        title="Overdue coursework"
                      />
                    )}

                    {/* 2. In Progress (Sky Blue) */}
                    {!hasOverdue && hasInProgress && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]"
                        title="Coursework in progress"
                      />
                    )}

                    {/* 3. Pending (Amber) */}
                    {!hasOverdue && !hasInProgress && hasPending && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                        title="Pending coursework"
                      />
                    )}

                    {/* 4. Completed (Emerald) */}
                    {!hasOverdue && !hasInProgress && !hasPending && allCompleted && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"
                        title="All coursework completed"
                      />
                    )}

                    {/* 5. Custom Tasks (Indigo) */}
                    {dayT.length > 0 && (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.6)]"
                        title="Tasks scheduled"
                      />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM SHEET / MODAL DRAWER                                              */}
      {/* ========================================================================= */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity duration-300 animate-in fade-in"
          />

          <div className="relative w-full max-w-lg bg-[#0e1017] border border-white/[0.09] rounded-t-[32px] sm:rounded-3xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto transform transition-all duration-300 animate-in slide-in-from-bottom-8 sm:zoom-in-95">
            <div className="w-12 h-1 bg-zinc-700/80 rounded-full mx-auto mb-5 sm:hidden" />

            {/* Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="text-[11px] font-mono font-medium px-2.5 py-1 bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 rounded-lg">
                  {selectedDayItems.total} {selectedDayItems.total === 1 ? 'Item Scheduled' : 'Items Scheduled'}
                </span>
                <h2 className="text-xl font-bold text-white mt-2 tracking-tight">
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            {selectedDayItems.total === 0 ? (
              <div className="text-center py-12 border border-dashed border-white/[0.06] rounded-2xl bg-black/20">
                <Sparkles className="w-8 h-8 text-indigo-400/60 mx-auto mb-2" />
                <p className="text-zinc-200 font-medium text-sm">Schedule Free</p>
                <p className="text-zinc-500 text-xs mt-1">
                  Nothing scheduled or due on this date.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Coursework with Specific In-Progress Styling */}
                {selectedDayItems.assignments.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                      Teams Assignments ({selectedDayItems.assignments.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedDayItems.assignments.map((item) => {
                        const isDone = item.status === 'submitted' || item.status === 'graded';
                        const isPast = item.deadline && new Date(item.deadline) < new Date() && !isDone;
                        const isInProgress = item.status === 'in_progress';

                        return (
                          <div
                            key={item.id}
                            className={`border rounded-2xl p-4 flex flex-col gap-1.5 transition-all ${
                              isDone
                                ? 'bg-emerald-500/[0.04] border-emerald-500/20'
                                : isPast
                                ? 'bg-rose-500/[0.05] border-rose-500/30'
                                : isInProgress
                                ? 'bg-sky-500/[0.05] border-sky-500/30'
                                : 'bg-black/30 border-white/[0.06]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono font-medium truncate max-w-[200px]">
                                {item.subject || 'Coursework'}
                              </span>

                              <span
                                className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${
                                  isDone
                                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25'
                                    : isPast
                                    ? 'text-rose-400 bg-rose-500/10 border-rose-500/25'
                                    : isInProgress
                                    ? 'text-sky-400 bg-sky-500/10 border-sky-500/25'
                                    : 'text-amber-400 bg-amber-400/10 border-amber-400/20'
                                }`}
                              >
                                {isPast ? 'Overdue' : item.status.replace('_', ' ')}
                              </span>
                            </div>

                            <p className={`font-medium text-sm ${isDone ? 'line-through text-zinc-400' : 'text-zinc-100'}`}>
                              {item.title}
                            </p>

                            {item.deadline && (
                              <p className="text-xs text-zinc-400 flex items-center gap-1 font-mono mt-0.5">
                                <Clock className="w-3 h-3 text-zinc-500" />
                                Due at{' '}
                                {new Date(item.deadline).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tasks */}
                {selectedDayItems.tasks.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-mono font-semibold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tasks ({selectedDayItems.tasks.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedDayItems.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="bg-black/30 border border-white/[0.06] rounded-2xl p-3.5 flex items-start gap-3"
                        >
                          <div className="mt-0.5">
                            {task.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-zinc-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                task.status === 'completed'
                                  ? 'line-through text-zinc-500'
                                  : 'text-zinc-100'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.due_date && (
                              <p className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5 font-mono">
                                <Clock className="w-3 h-3 text-zinc-500" />
                                {new Date(task.due_date).toLocaleTimeString('en-US', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setIsModalOpen(false)}
              className="mt-6 w-full bg-zinc-850 hover:bg-zinc-800 text-zinc-200 font-semibold py-2.5 rounded-xl text-xs transition-all active:scale-98 border border-white/[0.05]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}