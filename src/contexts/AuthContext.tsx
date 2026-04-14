import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const PASSWORD_RESET_LOCK_KEY = "traveld.password-reset-lock";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { username: string; profile_picture: string | null } | null;
  loading: boolean;
  mustCompletePasswordReset: boolean;
  beginPasswordReset: () => void;
  completePasswordReset: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ username: string; profile_picture: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustCompletePasswordReset, setMustCompletePasswordReset] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PASSWORD_RESET_LOCK_KEY) === "true";
  });

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("username, profile_picture")
      .eq("user_id", userId)
      .single();
    if (data) setProfile(data);
  };

  const setPasswordResetLock = (locked: boolean) => {
    setMustCompletePasswordReset(locked);

    if (typeof window === "undefined") return;

    if (locked) {
      window.localStorage.setItem(PASSWORD_RESET_LOCK_KEY, "true");
      return;
    }

    window.localStorage.removeItem(PASSWORD_RESET_LOCK_KEY);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        setProfile(null);
        setPasswordResetLock(false);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setPasswordResetLock(false);
      }
      setLoading(false);
    });

    const handleStorage = (event: StorageEvent) => {
      if (event.key === PASSWORD_RESET_LOCK_KEY) {
        setMustCompletePasswordReset(event.newValue === "true");
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("storage", handleStorage);
    }

    return () => {
      subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
  }, []);

  const beginPasswordReset = () => {
    setPasswordResetLock(true);
  };

  const completePasswordReset = () => {
    setPasswordResetLock(false);
  };

  const signOut = async () => {
    completePasswordReset();
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, mustCompletePasswordReset, beginPasswordReset, completePasswordReset, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
