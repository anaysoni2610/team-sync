import { useEffect, useState, useCallback } from 'react';
import { supabase, type Task, type NewTask, type TaskStatus } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  Plus, Trash2, CheckCircle2, Circle, Calendar, X,
  Loader2, ListTodo, AlertCircle,
} from 'lucide-react';

const statusConfig: Record<TaskStatus, { color: string; bg: string; border: string; label: string }> = {
  pending: { color: 'text-slate-300', bg: 'bg-slate-700/50', border: 'border-slate-600/40', label: 'Pending' },
  in_progress: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'In Progress' },
  completed: { color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30', label: 'Completed' },
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
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'completed') return false;
  return new Date(dateStr) < new Date();
}

export default function Tasks() {
  const { isGuest } = useAuth();
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
        setTasks((prev) => {
          if (prev.some((t) => t.id === payload.new.id)) return prev;
          return [payload.new as Task, ...prev];
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, (payload) => {
      setTasks((prev) => prev.map((t) => (t.id === payload.new.id ? (payload.new as any) : t)));
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
      setTasks((prev) => prev.filter((t) => t.id !== (payload.old as any).id));
    })
    .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks, isGuest]);

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
    };

    // Insert into Supabase and get the created row back immediately
    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select()
      .single();

    if (error) {
      console.error('Failed to add task:', error.message);
      return;
    }

    // Instantly show the new task at the top of your list
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
    // 1. Instantly update UI on screen
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status } : t)));

    // 2. Sync to Supabase in the background
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
    // 1. Instantly remove from screen
    setTasks((prev) => prev.filter((t) => t.id !== id));

    // 2. Sync deletion to Supabase
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListTodo className="w-6 h-6 text-teal-400" />
            Tasks
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {activeCount} active{overdueCount > 0 && ` · ${overdueCount} overdue`}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white px-4 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 transition-all shadow-lg shadow-teal-500/20"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Task'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-slate-800/60 backdrop-blur border border-slate-700/50 rounded-xl p-5 mb-6 space-y-4">
          <input
            autoFocus
            type="text"
            placeholder="Task title..."
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500"
          />
          <textarea
            placeholder="Description (optional)..."
            value={newTask.description ?? ''}
            onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
            rows={2}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 resize-none"
          />
          <div>
            <label className="text-xs text-slate-400 mb-1 block">Due Date</label>
            <input
              type="datetime-local"
              value={newTask.due_date ? new Date(newTask.due_date).toISOString().slice(0, 16) : ''}
              onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/50 [color-scheme:dark]"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-teal-500 hover:bg-teal-400 text-white font-medium py-2.5 rounded-lg transition-all text-sm"
          >
            Add Task
          </button>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
              filter === f
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ListTodo className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500">No tasks yet. Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const sc = statusConfig[task.status];
            const overdue = isOverdue(task.due_date, task.status);
            const isCompleted = task.status === 'completed';
            return (
              <div
                key={task.id}
                className={`group bg-slate-800/40 backdrop-blur border border-slate-700/40 rounded-xl p-4 flex items-start gap-3 transition-all hover:border-slate-600/60 ${
                  isCompleted ? 'opacity-50' : ''
                }`}
              >
                <button
                  onClick={() => toggleComplete(task)}
                  className="mt-0.5 shrink-0 transition-transform hover:scale-110"
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-teal-400" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-600 hover:text-teal-400" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-white font-medium ${isCompleted ? 'line-through' : ''}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-slate-400 text-sm mt-0.5 truncate">{task.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {task.status !== 'completed' && (
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                        className={`text-xs px-2 py-0.5 rounded-md ${sc.bg} ${sc.border} ${sc.color} border bg-transparent focus:outline-none cursor-pointer`}
                      >
                        <option value="pending" className="bg-slate-800 text-slate-300">Pending</option>
                        <option value="in_progress" className="bg-slate-800 text-blue-400">In Progress</option>
                        <option value="completed" className="bg-slate-800 text-teal-400">Completed</option>
                      </select>
                    )}
                    {task.due_date && (
                      <span className={`text-xs px-2 py-0.5 rounded-md flex items-center gap-1 ${
                        overdue ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-slate-700/50 text-slate-300'
                      }`}>
                        <Calendar className="w-3 h-3" />
                        {formatDate(task.due_date)}
                      </span>
                    )}
                    {overdue && (
                      <span className="text-xs px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(task.id)}
                  className="shrink-0 p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
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
