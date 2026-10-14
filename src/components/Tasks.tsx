import { useEffect, useState, useCallback } from 'react';
import { supabase, type Task, type NewTask, type TaskStatus } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDue, fromLocalInput, toLocalInputString } from '@/lib/format';
import { ConfirmDelete, EmptyState, PageHeader, Segmented, Sheet, Spinner } from '@/components/ui';
import { Plus, Check, ListTodo, Clock } from 'lucide-react';

const statusStyle: Record<TaskStatus, string> = {
  pending: 'text-muted bg-sunken',
  in_progress: 'text-info bg-info-soft',
  completed: 'text-ok bg-ok-soft',
};

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
        const item = payload.new as Task;
        if (item.user_id && item.user_id !== user?.id) return;
        setTasks((prev) => prev.map((t) => (t.id === item.id ? item : t)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, (payload) => {
        setTasks((prev) => prev.filter((t) => t.id !== (payload.old as Partial<Task>).id));
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
    <div>
      <PageHeader
        eyebrow="Personal"
        title="Tasks"
        meta={
          <>
            {activeCount} open
            {overdueCount > 0 && <span className="text-danger font-medium"> · {overdueCount} overdue</span>}
          </>
        }
        actions={
          <button onClick={() => setShowForm(true)} className="btn-primary flex-1 sm:flex-none">
            <Plus className="w-4 h-4" /> New task
          </button>
        }
      />

      <Sheet open={showForm} onClose={() => setShowForm(false)} title="New task">
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="field-label">Title</label>
            <input
              id="task-title"
              autoFocus
              required
              type="text"
              placeholder="What needs to get done?"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="task-notes" className="field-label">
              Notes <span className="text-faint font-normal">· optional</span>
            </label>
            <textarea
              id="task-notes"
              placeholder="Context or details"
              value={newTask.description ?? ''}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              rows={3}
              className="field"
            />
          </div>
          <div>
            <label htmlFor="task-due" className="field-label">
              Due <span className="text-faint font-normal">· optional</span>
            </label>
            <input
              id="task-due"
              type="datetime-local"
              value={toLocalInputString(newTask.due_date)}
              onChange={(e) => setNewTask({ ...newTask, due_date: fromLocalInput(e.target.value) })}
              className="field"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 sm:flex-none">
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1">
              Create task
            </button>
          </div>
        </form>
      </Sheet>

      <div className="mb-4">
        <Segmented
          label="Filter tasks"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: tasks.length },
            { value: 'active', label: 'Active', count: activeCount },
            { value: 'completed', label: 'Done', count: tasks.length - activeCount },
          ]}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : filtered.length === 0 ? (
        <div className="panel">
          <EmptyState
            icon={ListTodo}
            title={filter === 'completed' ? 'Nothing finished yet' : 'All clear'}
            body={filter === 'all' ? 'Add your first task to get started.' : 'Switch filters to see other tasks.'}
          />
        </div>
      ) : (
        <ul className="panel divide-y divide-line overflow-hidden">
          {filtered.map((task) => {
            const overdue = isOverdue(task.due_date, task.status);
            const isCompleted = task.status === 'completed';

            return (
              <li key={task.id} className="flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-4 transition-colors hover:bg-canvas/50">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isCompleted}
                  aria-label={`Mark "${task.title}" as ${isCompleted ? 'not done' : 'done'}`}
                  onClick={() => toggleComplete(task)}
                  className={`mt-0.5 w-[22px] h-[22px] shrink-0 rounded-full border-[1.5px] flex items-center justify-center transition-colors duration-150 ${
                    isCompleted ? 'bg-primary border-primary text-canvas' : 'border-faint hover:border-primary hover:bg-primary-soft'
                  }`}
                >
                  {isCompleted && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                </button>

                <div className="flex-1 min-w-0">
                  <p className={`text-[15px] font-medium leading-snug break-words ${isCompleted ? 'line-through text-faint' : 'text-ink'}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className={`text-sm mt-0.5 line-clamp-2 break-words ${isCompleted ? 'text-faint' : 'text-muted'}`}>{task.description}</p>
                  )}

                  {(task.due_date || !isCompleted) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
                      {!isCompleted && (
                        <select
                          aria-label="Status"
                          value={task.status}
                          onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                          className={`h-7 pl-2 pr-1 rounded-md text-xs font-medium border-0 cursor-pointer ${statusStyle[task.status]}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      )}
                      {task.due_date && (
                        <span className={`inline-flex items-center gap-1.5 text-xs ${overdue ? 'text-danger font-medium' : 'text-muted'}`}>
                          <Clock className="w-3.5 h-3.5" />
                          {overdue && 'Overdue · '}
                          {formatDue(task.due_date)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <ConfirmDelete label="Delete task" onConfirm={() => handleDelete(task.id)} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
