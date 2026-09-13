import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type GuestUser = {
  id: string;
  email: string;
  isGuest: true;
};

type AuthContextType = {
  session: Session | null;
  user: User | GuestUser | null;
  loading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signInGuest: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'teamsync_guest';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | GuestUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const storedGuest = localStorage.getItem(GUEST_STORAGE_KEY);
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      } else if (storedGuest === 'true') {
        setIsGuest(true);
        setUser({ id: 'guest', email: 'Guest user', isGuest: true });
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session) {
        setIsGuest(false);
        localStorage.removeItem(GUEST_STORAGE_KEY);
      }
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    setIsGuest(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string) => {
    localStorage.removeItem(GUEST_STORAGE_KEY);
    setIsGuest(false);
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  };

  const signInGuest = () => {
    localStorage.setItem(GUEST_STORAGE_KEY, 'true');
    setIsGuest(true);
    setUser({ id: 'guest', email: 'Guest user', isGuest: true });
    setSession(null);
  };

  const signOut = async () => {
    if (isGuest) {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      setIsGuest(false);
      setUser(null);
      setSession(null);
      return;
    }
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, isGuest, signIn, signUp, signInGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
