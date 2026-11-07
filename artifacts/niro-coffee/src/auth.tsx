import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, type Session, type User } from '@supabase/supabase-js';
import { setAuthTokenGetter } from '@workspace/api-client-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

function createAuthClient() {
  if (!supabaseUrl || !supabasePublishableKey) return null;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:') return null;
    return createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    });
  } catch {
    return null;
  }
}

export const supabase = createAuthClient();

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoaded: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    if (!supabase) {
      setAuthTokenGetter(null);
      setIsLoaded(true);
      return;
    }
    let mounted = true;
    let authEventReceived = false;
    const updateSession = (nextSession: Session | null) => {
      sessionRef.current = nextSession;
      setSession(nextSession);
      setIsLoaded(true);
    };

    setAuthTokenGetter(() => sessionRef.current?.access_token ?? null);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (mounted) updateSession(nextSession);
    });

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (mounted && !authEventReceived) updateSession(data.session);
      })
      .catch(() => {
        if (mounted && !authEventReceived) setIsLoaded(true);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      setAuthTokenGetter(null);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    isLoaded,
    signOut: async () => {
      if (!supabase) throw new Error('Supabase Auth is not configured.');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [session, isLoaded]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('Auth context is unavailable.');
  return context;
}
