import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, type Assignment, type Task } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  BookOpen,
  CheckCircle2,
  Circle,
  X,
  Plus,
  Sparkles,
  AlertCircle
} from 'lucide-react';

export default function Agenda() {
  const { isGuest } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected date modal state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (isGuest) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [assignmentsRes, tasksRes] = await Promise.all([
        supabase.from('assignments').select('*'),
        supabase.from('tasks').select('*')
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

  // Calendar math helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Previous & Next month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Check if a given date matches day/month/year
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  // Group items by date for quick lookup
  const getItemsForDay = (day: number) => {
    const targetDate = new Date(year, month, day);

    const dayAssignments = assignments.filter((a) => {
      if (!a.deadline) return false;
      return isSameDay(new Date(a.deadline), targetDate);
    });

    const dayTasks = tasks.filter((t) => {
      if (!t.due_date) return false;
      return isSameDay(new Date(t.due_date), targetDate);
    });

    return { assignments: dayAssignments, tasks: dayTasks, total: dayAssignments.length + dayTasks.length };
  };

  // Items for the selected day in modal
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
    <div className="max-w-4xl mx-auto p-4 md:p-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-teal-400" />
            Agenda
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Tap any date to inspect due tasks & assignments
          </p>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl mb-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg md:text-xl font-bold text-white tracking-wide">
            {monthNames[month]} {year}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-all"
            >
              Today
            </button>
            <div className="flex gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells before month starts */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square opacity-0 pointer-events-none" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const thisDate = new Date(year, month, dayNum);
            const isToday = isSameDay(thisDate, today);
            const { assignments: dayA, tasks: dayT, total } = getItemsForDay(dayNum);

            return (
              <button
                key={dayNum}
                onClick={() => handleDateClick(dayNum)}
                className={`aspect-square rounded-xl p-1.5 flex flex-col justify-between items-center relative transition-all duration-200 active:scale-95 group ${
                  isToday
                    ? 'border-2 border-teal-400/80 bg-teal-500/10'
                    : total > 0
                    ? 'bg-slate-800/60 border border-slate-700/60 hover:border-teal-500/40 hover:bg-slate-800'
                    : 'bg-slate-800/20 border border-slate-800/40 hover:bg-slate-800/50 hover:border-slate-700/50'
                }`}
              >
                <span
                  className={`text-xs font-semibold ${
                    isToday ? 'text-teal-300 font-bold' : total > 0 ? 'text-white' : 'text-slate-400'
                  }`}
                >
                  {dayNum}
                </span>

                {/* Event Pill Indicator */}
                {total > 0 && (
                  <div className="flex flex-col items-center gap-0.5 w-full">
                    {dayA.length > 0 && (
                      <span className="w-full py-0.5 px-1 bg-amber-500/20 border border-amber-500/30 rounded text-[9px] text-amber-300 font-medium flex items-center justify-center gap-0.5 truncate">
                        <BookOpen className="w-2.5 h-2.5 shrink-0" />
                        <span className="hidden md:inline">{dayA.length}</span>
                      </span>
                    )}
                    {dayT.length > 0 && (
                      <span className="w-full py-0.5 px-1 bg-teal-500/20 border border-teal-500/30 rounded text-[9px] text-teal-300 font-medium flex items-center justify-center gap-0.5 truncate">
                        <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                        <span className="hidden md:inline">{dayT.length}</span>
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming Section Under Calendar */}
      <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-teal-400" />
          Upcoming Soon
        </h3>
        {assignments.length === 0 && tasks.length === 0 ? (
          <p className="text-slate-500 text-sm">No upcoming assignments or tasks found.</p>
        ) : (
          <div className="space-y-2.5">
            {assignments.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3 bg-slate-800/40 border border-slate-700/40 rounded-xl"
              >
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{a.title}</p>
                  <p className="text-slate-400 text-xs truncate">
                    {a.subject} • {a.deadline ? new Date(a.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No due date'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* POPUP / BOTTOM SHEET MODAL (Animated on Date Click)                      */}
      {/* ========================================================================= */}
      {isModalOpen && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop with Fade */}
          <div
            onClick={() => setIsModalOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
          />

          {/* Dialog Container: Slide-Up on Mobile, Pop-In on Desktop */}
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl z-10 max-h-[85vh] overflow-y-auto transform transition-all duration-300 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
            {/* Grab handle for mobile feeling */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto mb-4 sm:hidden" />

            {/* Modal Header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <span className="text-xs font-semibold px-2.5 py-1 bg-teal-500/10 text-teal-300 border border-teal-500/20 rounded-md">
                  {selectedDayItems.total} {selectedDayItems.total === 1 ? 'Item Due' : 'Items Due'}
                </span>
                <h2 className="text-xl font-bold text-white mt-2">
                  {selectedDate.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content List */}
            {selectedDayItems.total === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
                <Sparkles className="w-10 h-10 text-teal-400/60 mx-auto mb-2" />
                <p className="text-white font-medium text-sm">Clear Skies!</p>
                <p className="text-slate-500 text-xs mt-1">
                  No assignments or tasks are due on this date.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Assignments Sub-group */}
                {selectedDayItems.assignments.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Teams Assignments ({selectedDayItems.assignments.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedDayItems.assignments.map((item) => (
                        <div
                          key={item.id}
                          className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-teal-300 font-medium truncate max-w-[200px]">
                              {item.subject}
                            </span>
                            <span className="text-xs capitalize text-amber-400 font-medium bg-amber-400/10 px-2 py-0.5 rounded">
                              {item.status}
                            </span>
                          </div>
                          <p className="text-white font-medium text-sm mt-1">{item.title}</p>
                          {item.deadline && (
                            <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3 text-slate-500" />
                              Due at{' '}
                              {new Date(item.deadline).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tasks Sub-group */}
                {selectedDayItems.tasks.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-teal-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Tasks ({selectedDayItems.tasks.length})
                    </h4>
                    <div className="space-y-2">
                      {selectedDayItems.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3.5 flex items-start gap-3"
                        >
                          <div className="mt-0.5">
                            {task.status === 'completed' ? (
                              <CheckCircle2 className="w-4 h-4 text-teal-400" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className={`text-sm font-medium ${
                                task.status === 'completed'
                                  ? 'line-through text-slate-500'
                                  : 'text-white'
                              }`}
                            >
                              {task.title}
                            </p>
                            {task.due_date && (
                              <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3 text-slate-500" />
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

            {/* Bottom Dismiss Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="mt-6 w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 rounded-xl text-sm transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}