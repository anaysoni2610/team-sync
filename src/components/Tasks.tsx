import { useEffect, useState, useCallback } from 'react';
import { supabase, type Task, type NewTask, type TaskStatus } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, CheckCircle2, Circle, Calendar, X,
  Loader2, ListTodo, AlertCircle, Clock,
} from 'lucide-react';

const statusConfig: Record<TaskStatus, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: 'text-zinc-400', bg: 'bg-zinc-800/60', border: 'border-white/[0.06]', label: 'Pending' },
  in_progress: { color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', label: 'In Progress' },
  completed: { color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', label: 'Completed' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toLocalInputString(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'completed') return false;
  return new Date(dateStr) < new Date();
}

export default function Tasks() {
  const { user, isGuest } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [newTask, setNewTask] = useState<NewTask>({
    title: '',
    description: '',
    due_date: null,
    status: 'pending',
  });

  const fetchTasks = useCallback(async () => {
    if (isGuest) {
      setTasks([
        { id: 'demo-1', title: 'Review lecture notes', description: 'Chapter 3-5 review for midterm', due_date: new Date(Date.now() + 86400000).toISOString(), status: 'pending', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-2', title: 'Buy groceries', description: null, due_date: new Date(Date.now() + 3600000).toISOString(), status: 'in_progress', user_id: 'guest', created_at: new Date().toISOString() },
        { id: 'demo-3', title: 'Submit project proposal', description: 'Draft version for feedback', due_date: null, status: 'completed', user_id: 'guest', created_at: new Date().toISOString() },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load tasks:', error.message);
    } else {
      setTasks(data ?? []);
    }
    setLoading(false);
  }, [isGuest]);

  useEffect(() => {
    fetchTasks();

    if (isGuest) return;

    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        const item = payload.new as Task;
        if (item.user_id && item.user_id !== user?.id) return;
        setTasks((prev) => {
          if (prev.some((t) => t.id === item.id)) return prev;
          return [item, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
        const item = payload.new as any;
        if (item.user_id && item.user_id !== user?.id) return;
        setTasks((prev) => prev.map((t) => (t.id === item.id ? item : t)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        setTasks((prev) => prev.filter((t) => t.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, isGuest, user?.id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    if (isGuest) {
      const task: Task = {
        id: `local-${Date.now()}`,
        title: newTask.title.trim(),
        description: newTask.description?.trim() || null,
        due_date: newTask.due_date || null,
        status: 'pending',
        user_id: 'guest',
        created_at: new Date().toISOString(),
      };
      setTasks((prev) => [task, ...prev]);
      setNewTask({ title: '', description: '', due_date: null, status: 'pending' });
      setShowForm(false);
      return;
    }

    const payload = {
      title: newTask.title.trim(),
      description: newTask.description?.trim() || null,
      due_date: newTask.due_date || null,
      status: 'pending' as TaskStatus,
      user_id: user?.id,
    };

    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Failed to add task:', error.message);
      return;
    }

    if (data) {
      setTasks((prev) => {
        if (prev.some((t) => t.id === data.id)) return prev;
        return [data, ...prev];
      });
    }

    setNewTask({ title: '', description: '', due_date: null, status: 'pending' });
    setShowForm(false);
  };

  const handleStatusChange = async (task: Task, status: TaskStatus) => {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));

    if (!isGuest) {
      const { error } = await supabase.from('tasks').update({ status }).eq('id', task.id);
      if (error) {
        console.error('Failed to update task:', error.message);
      }
    }
  };

  const toggleComplete = (task: Task) => {
    handleStatusChange(task, task.status === 'completed' ? 'pending' : 'completed');
  };

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));

    if (!isGuest) {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete task:', error.message);
      }
    }
  };

  const filtered = tasks.filter((t) => {
    if (filter === 'active') return t.status !== 'completed';
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  const activeCount = tasks.filter((t) => t.status !== 'completed').length;
  const overdueCount = tasks.filter((t) => isOverdue(t.due_date, t.status)).length;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2 tracking-tight">
            <ListTodo className="w-6 h-6 text-indigo-400" />
            Tasks
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {activeCount} active{overdueCount > 0 && ` · ${overdueCount} overdue`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-b from-indigo-500 to-indigo-600 hover:brightness-110 text-white px-4 py-2 rounded-xl font-semibold text-xs flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(99,102,241,0.35)] active:scale-95"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {/* Task Creation Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="glass-panel rounded-2xl p-5 mb-6 space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="What needs to get done?"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="w-full glass-input rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none"
          />
          <textarea
            placeholder="Add some context or details (optional)..."
            value={newTask.description ?? ''}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            rows={2}
            className="w-full glass-input rounded-xl px-4 py-2.5 text-white placeholder-zinc-500 text-sm focus:outline-none resize-none"
          />
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block font-medium">Due Date & Time</label>
            <input
              type="datetime-local"
              value={toLocalInputString(newTask.due_date)}
              onChange={(e) => {
                if (!e.target.value) {
                  setNewTask({ ...newTask, due_date: null });
                  return;
                }
                const localDate = new Date(e.target.value);
                setNewTask({ ...newTask, due_date: localDate.toISOString() });
              }}
              className="w-full glass-input rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none [color-scheme:dark]"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-b from-indigo-500 to-indigo-600 hover:brightness-110 text-white font-semibold py-2.5 rounded-xl transition-all text-xs shadow-md shadow-indigo-500/20 active:scale-95"
          >
            Create Task
          </button>
        </form>
      )}

      {/* Filter Segmented Pills */}
      <div className="flex gap-1.5 p-1 bg-black/40 border border-white/[0.05] rounded-xl w-fit mb-5">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all active:scale-95 ${
              filter === f
                ? 'bg-zinc-800 text-white shadow-sm font-semibold'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/[0.05] rounded-2xl glass-panel">
          <ListTodo className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-400 font-medium text-sm">No tasks here</p>
          <p className="text-zinc-600 text-xs mt-1">Add a new task or switch filters to inspect other items.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((task) => {
            const sc = statusConfig[task.status];
            const overdue = isOverdue(task.due_date, task.status);
            const isCompleted = task.status === 'completed';

            return (
              <div
                key={task.id}
                className={`glass-panel hover:border-white/[0.14] rounded-2xl p-4 transition-all duration-200 active:scale-[0.99] flex items-start gap-3.5 group ${
                  isCompleted ? 'opacity-40' : ''
                }`}
              >
                {/* Complete Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleComplete(task)}
                  className="mt-0.5 shrink-0 transition-transform active:scale-90"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-zinc-600 hover:text-indigo-400 transition-colors" />
                  )}
                </button>

                {/* Content Details */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium leading-snug tracking-tight transition-colors ${
                      isCompleted ? 'line-through text-zinc-500' : 'text-zinc-100 group-hover:text-white'
                    }`}
                  >
                    {task.title}
                  </p>

                  {task.description && (
                    <p className="text-zinc-400 text-xs mt-1 leading-relaxed line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    {/* Status Badge Dropdown */}
                    {task.status !== 'completed' && (
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${sc.bg} ${sc.border} ${sc.color} border bg-transparent focus:outline-none cursor-pointer`}
                      >
                        <option value="pending" className="bg-[#0f1117] text-zinc-300">Pending</option>
                        <option value="in_progress" className="bg-[#0f1117] text-sky-400">In Progress</option>
                        <option value="completed" className="bg-[#0f1117] text-indigo-400">Completed</option>
                      </select>
                    )}

                    {/* Due Date Tag */}
                    {task.due_date && (
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md flex items-center gap-1.5 border font-mono ${
                          overdue
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-zinc-800/80 text-zinc-400 border-white/[0.06]'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {formatDate(task.due_date)}
                      </span>
                    )}

                    {/* Overdue Alert */}
                    {overdue && (
                      <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  className="shrink-0 p-1.5 rounded-lg text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 transition-all active:scale-90"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}