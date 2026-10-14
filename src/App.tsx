import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Auth from '@/components/Auth';
import Tasks from '@/components/Tasks';
import Agenda from '@/components/Agenda';
import Assignments from '@/components/Assignments';
import Settings from '@/components/Settings';
import { ListTodo, CalendarDays, GraduationCap, Settings as SettingsIcon, Loader2, LogOut } from 'lucide-react';
import { BrandMark } from '@/components/ui';

type Tab = 'tasks' | 'agenda' | 'assignments' | 'settings';

const tabs: { id: Tab; label: string; icon: typeof ListTodo }[] = [
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'assignments', label: 'Assignments', icon: GraduationCap },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function App() {
  const { user, loading, isGuest, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('tasks');

  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-5">
        <BrandMark className="w-12 h-12" />
        <Loader2 className="w-5 h-5 text-primary animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 flex-col bg-sidebar text-sidebar-text">
        <div className="flex items-center gap-3 px-6 h-20">
          <BrandMark />
          <span className="font-display text-[26px] text-canvas leading-none">TeamSync</span>
        </div>
        <nav className="flex-1 px-3 pt-4 space-y-0.5" aria-label="Main">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center gap-3 h-10 px-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
                  active ? 'bg-white/[0.08] text-canvas' : 'hover:bg-white/[0.04] hover:text-canvas'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${active ? 'text-[#8FD3B6]' : ''}`} />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="m-3 p-3 rounded-lg border border-sidebar-line">
          <p className="text-[13px] text-canvas truncate">{user.email}</p>
          <p className="text-xs mt-0.5">{isGuest ? 'Guest · this device only' : 'Synced across devices'}</p>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-xs font-medium hover:text-canvas transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isGuest ? 'Exit guest mode' : 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden sticky top-0 z-30 flex items-center gap-2.5 px-4 h-14 bg-canvas/90 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)] box-content">
        <BrandMark className="w-7 h-7" />
        <span className="font-display text-[22px] leading-none">TeamSync</span>
      </div>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-10 pt-6 lg:pt-12 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-16">
        {activeTab === 'tasks' && <Tasks />}
        {activeTab === 'agenda' && <Agenda />}
        {activeTab === 'assignments' && <Assignments />}
        {activeTab === 'settings' && <Settings />}
      </main>

      {/* Mobile bottom tabs */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-sidebar pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-4 h-16">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? 'text-canvas' : 'text-sidebar-text'
                }`}
              >
                <span className={`flex items-center justify-center w-12 h-7 rounded-full transition-colors ${active ? 'bg-white/[0.1]' : ''}`}>
                  <Icon className={`w-[18px] h-[18px] ${active ? 'text-[#8FD3B6]' : ''}`} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
