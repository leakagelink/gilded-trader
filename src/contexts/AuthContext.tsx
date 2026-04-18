import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    const fallbackSession = { data: { session: null } };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;

        // Don't auto-navigate during password recovery
        const isPasswordRecovery = sessionStorage.getItem('password_recovery_mode') === 'true';
        const currentPath = window.location.pathname;
        
        if (event === 'PASSWORD_RECOVERY') {
          // User clicked password reset link - don't redirect
          sessionStorage.setItem('password_recovery_mode', 'true');
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          return;
        }
        
        // If we're on the reset password page and in recovery mode, don't update auth state that would cause redirect
        if (isPasswordRecovery && currentPath === '/reset-password') {
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    const initializeSession = async () => {
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<typeof fallbackSession>((resolve) => {
            setTimeout(() => resolve(fallbackSession), 8000);
          }),
        ]);

        if (!isMounted) return;

        setSession(sessionResult.data.session);
        setUser(sessionResult.data.session?.user ?? null);
      } catch (error) {
        console.error('Error restoring auth session:', error);
        if (!isMounted) return;

        setSession(null);
        setUser(null);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
