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

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-xl border-t border-slate-700/50 z-50">
        <div className="max-w-4xl mx-auto flex items-center justify-around px-2 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all min-w-[60px] ${
                  active ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`} />
                <span className="text-[10px] font-medium">{tab.label}</span>
                {active && <div className="w-1 h-1 rounded-full bg-teal-400" />}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
