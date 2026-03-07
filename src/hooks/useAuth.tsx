import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isAdminUser } from "@/lib/admin";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithGitHub: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAdminStatus = async (user: User | null) => {
      if (!user || !mounted) {
        setIsAdmin(false);
        return;
      }

      // 1. Quick frontend check (no-op for regular users)
      if (!isAdminUser(user)) {
        setIsAdmin(false);
        return;
      }

      // 2. Database check (only for potential admins)
      try {
        const { data, error } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (mounted) {
          if (error) {
            console.error("Error checking admin status:", error);
            setIsAdmin(false);
          } else {
            setIsAdmin(!!data);
          }
        }
      } catch (err) {
        console.error("Failed to fetch admin status:", err);
        if (mounted) setIsAdmin(false);
      }
    };

    const handleAuthChange = async (user: User | null, session: Session | null) => {
      if (!mounted) return;

      setUser(user);
      setSession(session);

      try {
        if (user) {
          await checkAdminStatus(user);
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        console.error("Error in handleAuthChange:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        if (session) {
          handleAuthChange(session.user, session);
        } else {
          setLoading(false);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (mounted) {
          handleAuthChange(session?.user ?? null, session);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, username: string, displayName: string) => {
    // Check if username is already taken before attempting signup
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return { error: { message: "this_username_is_taken" } };
    }

    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username,
          display_name: displayName,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const signInWithGitHub = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAdmin,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithGitHub,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
