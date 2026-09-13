import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase, type Task, type Assignment, type EventItem, type NewEvent } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChevronLeft, ChevronRight, CalendarDays, Plus, X,
  Loader2, Clock, BookOpen, CheckSquare, MapPin, Trash2,
} from 'lucide-react';

type AgendaItem = {
  id: string;
  type: 'task' | 'assignment' | 'event';
  title: string;
  subtitle: string | null;
  time: string | null;
  location: string | null;
  color: string;
  url: string | null;
};

const colorMap = {
  task: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
  assignment: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  event: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export default function Agenda() {
  const { isGuest } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventForm, setShowEventForm] = useState(false);
  const [newEvent, setNewEvent] = useState<NewEvent>({
    title: '',
    description: '',
    start_time: new Date().toISOString().slice(0, 16),
    end_time: null,
    location: '',
    color: 'blue',
  });

  const fetchAll = useCallback(async () => {
    if (isGuest) {
      setTasks([
        { id: 'demo-1', title: 'Review lecture notes', description: 'Chapter 3-5 review', due_date: new Date(Date.now() + 86400000).toISOString(), status: 'pending', user_id: 'guest', created_at: new Date().toISOString() },
      ]);
      setAssignments([
        { id: 'demo-a1', title: 'Math Problem Set 4', subject: 'Mathematics', deadline: new Date(Date.now() + 172800000).toISOString(), attachment_url: null, status: 'pending', source: 'calendar', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-a2', title: 'Lab Report: Enzyme Kinetics', subject: 'Biology', deadline: new Date(Date.now() + 432000000).toISOString(), attachment_url: 'https://example.com/lab-guide.pdf', status: 'in_progress', source: 'calendar', user_id: 'guest', created_at: new Date().toISOString() },
      ]);
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [tasksRes, assignmentsRes, eventsRes] = await Promise.all([
      supabase.from('tasks').select('*').order('due_date', { ascending: true }),
      supabase.from('assignments').select('*').order('deadline', { ascending: true }),
      supabase.from('events').select('*').order('start_time', { ascending: true }),
    ]);

    if (tasksRes.data) setTasks(tasksRes.data);
    if (assignmentsRes.data) setAssignments(assignmentsRes.data);
    if (eventsRes.data) setEvents(eventsRes.data);
    setLoading(false);
  }, [isGuest]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const agendaItems = useMemo((): AgendaItem[] => {
    const items: AgendaItem[] = [];

    tasks.forEach((t) => {
      if (t.due_date) {
        items.push({
          id: t.id,
          type: 'task',
          title: t.title,
          subtitle: t.status === 'completed' ? 'Completed' : null,
          time: t.due_date,
          location: null,
          color: 'task',
          url: null,
        });
      }
    });

    assignments.forEach((a) => {
      items.push({
        id: a.id,
        type: 'assignment',
        title: a.title,
        subtitle: a.subject,
        time: a.deadline,
        location: null,
        color: 'assignment',
        url: a.attachment_url,
      });
    });

    events.forEach((e) => {
      items.push({
        id: e.id,
        type: 'event',
        title: e.title,
        subtitle: e.description,
        time: e.start_time,
        location: e.location,
        color: 'event',
        url: null,
      });
    });

    return items.sort((a, b) => {
      if (!a.time) return 1;
      if (!b.time) return -1;
      return new Date(a.time).getTime() - new Date(b.time).getTime();
    });
  }, [tasks, assignments, events]);

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const calendarDays: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), d));
  }

  const itemsForDay = (date: Date): AgendaItem[] =>
    agendaItems.filter((item) => item.time && isSameDay(new Date(item.time), date));

  const upcomingItems = useMemo(() => {
    const now = new Date();
    return agendaItems.filter((item) => item.time && new Date(item.time) >= now).slice(0, 10);
  }, [agendaItems]);

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title.trim()) return;

    if (isGuest) {
      const event: EventItem = {
        id: `local-${Date.now()}`,
        user_id: 'guest',
        title: newEvent.title.trim(),
        description: newEvent.description?.trim() || null,
        start_time: new Date(newEvent.start_time).toISOString(),
        end_time: newEvent.end_time ? new Date(newEvent.end_time).toISOString() : null,
        location: newEvent.location?.trim() || null,
        color: newEvent.color || 'blue',
        created_at: new Date().toISOString(),
      };
      setEvents((prev) => [...prev, event]);
      setNewEvent({ title: '', description: '', start_time: new Date().toISOString().slice(0, 16), end_time: null, location: '', color: 'blue' });
      setShowEventForm(false);
      return;
    }

    const payload = {
      title: newEvent.title.trim(),
      description: newEvent.description?.trim() || null,
      start_time: new Date(newEvent.start_time).toISOString(),
      end_time: newEvent.end_time ? new Date(newEvent.end_time).toISOString() : null,
      location: newEvent.location?.trim() || null,
      color: newEvent.color || 'blue',
    };

    const { data, error } = await supabase.from('events').insert(payload).select().single();
    if (error) {
      console.error('Failed to add event:', error.message);
      return;
    }
    setEvents((prev) => [...prev, data]);
    setNewEvent({ title: '', description: '', start_time: new Date().toISOString().slice(0, 16), end_time: null, location: '', color: 'blue' });
    setShowEventForm(false);
  };

  const handleDeleteEvent = async (id: string) => {
    if (isGuest) {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      return;
    }
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) {
      console.error('Failed to delete event:', error.message);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const formatTime = (time: string | null): string => {
    if (!time) return '';
    return new Date(time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const typeIcon = {
    task: CheckSquare,
    assignment: BookOpen,
    event: Clock,
  };

  const today = new Date();

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-teal-400" />
            Agenda
          </h1>
          <p className="text-slate-400 text-sm mt-1">Your tasks, assignments & events in one calendar</p>
        </div>
        <button
          onClick={() => setShowEventForm(!showEventForm)}
          className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20"
        >
          {showEventForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showEventForm ? 'Cancel' : 'New Event'}
        </button>
      </div>

      {showEventForm && (
        <form onSubmit={handleAddEvent} className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-5 mb-6 space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Event title..."
            value={newEvent.title}
            onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Start</label>
              <input
                type="datetime-local"
                value={newEvent.start_time ? new Date(newEvent.start_time).toISOString().slice(0, 16) : ''}
                onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString() })}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">End (optional)</label>
              <input
                type="datetime-local"
                value={newEvent.end_time ? new Date(newEvent.end_time).toISOString().slice(0, 16) : ''}
                onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 [color-scheme:dark]"
              />
            </div>
          </div>
          <input
            type="text"
            placeholder="Location (optional)"
            value={newEvent.location ?? ''}
            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
          <button
            type="submit"
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-all text-sm"
          >
            Add Event
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">{monthName}</h2>
                <div className="flex items-center gap-1">
                  <button onClick={goToday} className="text-xs px-2.5 py-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all mr-1">
                    Today
                  </button>
                  <button onClick={prevMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={nextMonth} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((date, i) => {
                  if (!date) return <div key={i} />;
                  const dayItems = itemsForDay(date);
                  const isToday = isSameDay(date, today);
                  return (
                    <div
                      key={i}
                      className={`min-h-[60px] rounded-lg p-1.5 border transition-all ${
                        isToday
                          ? 'bg-teal-500/10 border-teal-500/40'
                          : 'bg-slate-900/30 border-slate-700/30 hover:border-slate-600/50'
                      }`}
                    >
                      <div className={`text-xs text-right mb-1 ${isToday ? 'text-teal-400 font-bold' : 'text-slate-400'}`}>
                        {date.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayItems.slice(0, 3).map((item) => {
                          const Icon = typeIcon[item.type];
                          return (
                            <div
                              key={`${item.type}-${item.id}`}
                              className={`text-[10px] px-1 py-0.5 rounded border ${colorMap[item.color]} flex items-center gap-0.5 truncate`}
                            >
                              <Icon className="w-2.5 h-2.5 shrink-0" />
                              <span className="truncate">{item.title}</span>
                            </div>
                          );
                        })}
                        {dayItems.length > 3 && (
                          <div className="text-[10px] text-slate-500 px-1">
                            +{dayItems.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Upcoming sidebar */}
          <div>
            <div className="bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-4">
              <h2 className="text-lg font-semibold text-white mb-4">Upcoming</h2>
              {upcomingItems.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">Nothing scheduled</p>
              ) : (
                <div className="space-y-2">
                  {upcomingItems.map((item) => {
                    const Icon = typeIcon[item.type];
                    return (
                      <div key={`${item.type}-${item.id}`} className="group flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900/30 hover:bg-slate-900/50 transition-all">
                        <div className={`shrink-0 w-8 h-8 rounded-lg border ${colorMap[item.color]} flex items-center justify-center`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium truncate">{item.title}</p>
                          {item.subtitle && <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>}
                          {item.time && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {new Date(item.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {formatTime(item.time)}
                            </p>
                          )}
                          {item.location && (
                            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3" />
                              {item.location}
                            </p>
                          )}
                        </div>
                        {item.type === 'event' && (
                          <button
                            onClick={() => handleDeleteEvent(item.id)}
                            className="shrink-0 p-1 rounded text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
