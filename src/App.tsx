import { useAuth } from '@/contexts/AuthContext';
import Auth from '@/components/Auth';
import Tasks from '@/components/Tasks';
import Agenda from '@/components/Agenda';
import Assignments from '@/components/Assignments';
import Settings from '@/components/Settings';
import { ListTodo, CalendarDays, GraduationCap, Settings as SettingsIcon, CheckSquare, Loader2 } from 'lucide-react';
import { useState } from 'react';

type Tab = 'tasks' | 'agenda' | 'assignments' | 'settings';

const tabs: { id: Tab; label: string; icon: typeof ListTodo }[] = [
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'assignments', label: 'Assignments', icon: GraduationCap },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('tasks');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-600 mb-4 shadow-lg shadow-cyan-500/20">
            <CheckSquare className="w-8 h-8 text-white" />
          </div>
          <Loader2 className="w-6 h-6 text-teal-400 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'tasks' && <Tasks />}
        {activeTab === 'agenda' && <Agenda />}
        {activeTab === 'assignments' && <Assignments />}
        {activeTab === 'settings' && <Settings />}
      </div>

{/* Floating Island Navigation */}
<div className="fixed bottom-4 inset-x-0 z-40 px-4 pointer-events-none flex justify-center">
  <nav className="pointer-events-auto w-full max-w-md glass-panel rounded-2xl p-1.5 flex items-center justify-around shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
    {[
      { id: 'tasks', label: 'Tasks', icon: ListTodo },
      { id: 'agenda', label: 'Agenda', icon: Calendar },
      { id: 'assignments', label: 'Assignments', icon: GraduationCap },
      { id: 'settings', label: 'Settings', icon: SettingsIcon },
    ].map((tab) => {
      const Icon = tab.icon;
      const isActive = currentTab === tab.id;
      return (
        <button
          key={tab.id}
          onClick={() => setCurrentTab(tab.id)}
          className={`relative px-4 py-2 rounded-xl flex flex-col items-center gap-1 transition-all duration-200 active:scale-95 ${
            isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {/* Active Pill Glow Background */}
          {isActive && (
            <span className="absolute inset-0 bg-indigo-600/20 border border-indigo-500/30 rounded-xl -z-10 shadow-[0_0_12px_rgba(99,102,241,0.25)]" />
          )}

          <Icon className={`w-4 h-4 transition-transform ${isActive ? 'scale-110 text-indigo-400' : ''}`} />
          <span className={`text-[10px] tracking-tight font-medium ${isActive ? 'font-semibold' : ''}`}>
            {tab.label}
          </span>
        </button>
      );
    })}
  </nav>
</div>
  );
}
