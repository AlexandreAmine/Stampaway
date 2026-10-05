import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SplashScreen } from "@capacitor/splash-screen";
import { isNative } from "@/lib/native/platform";
import { perfMark } from "@/lib/perfMarks";

const PASSWORD_RESET_LOCK_KEY = "traveld.password-reset-lock";

interface AuthContextType {
  user: User | null;
  profile: { username: string; profile_picture: string | null; needs_username: boolean } | null;
  loading: boolean;
  mustCompletePasswordReset: boolean;
  beginPasswordReset: () => void;
  completePasswordReset: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  // Every hourly token renewal (and the double sign-in event at launch)
  // hands over a new copy of the same user. Keeping the existing object when
  // nothing in it changed stops everything that depends on the user from
  // re-rendering and re-running its effects for no reason.
  const setUser = (next: User | null) =>
    setUserState((prev) => (prev && next && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  const [profile, setProfile] = useState<{ username: string; profile_picture: string | null; needs_username: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mustCompletePasswordReset, setMustCompletePasswordReset] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PASSWORD_RESET_LOCK_KEY) === "true";
  });

  // Both onAuthStateChange and getSession fire at startup; this ref makes
  // sure we only fetch the profile once per user unless a refresh is forced.
  const profileFetchedForRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string, options?: { force?: boolean }) => {
    if (!options?.force && profileFetchedForRef.current === userId) return;
    profileFetchedForRef.current = userId;
    const { data } = await supabase
      .from("profiles")
      .select("username, profile_picture, needs_username")
      .eq("user_id", userId)
      .single();
    if (data) setProfile(data);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id, { force: true });
  };

  // Native splash stays up (launchAutoHide: false) until auth state is
  // resolved, so users never see a blank screen between splash and app.
  const splashHiddenRef = useRef(false);
  const hideSplash = () => {
    if (splashHiddenRef.current || !isNative()) return;
    splashHiddenRef.current = true;
    perfMark("splash-hide");
    // Smooth dissolve into the app instead of a hard cut
    SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
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
    // Safety net: never leave the native splash stuck if auth resolution hangs.
    const splashTimeout = window.setTimeout(hideSplash, 6000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      perfMark("auth-event", `${_event} ${session ? "signed-in" : "signed-out"}`);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchProfile(session.user.id), 0);
      } else {
        profileFetchedForRef.current = null;
        setProfile(null);
        setPasswordResetLock(false);
      }
      setLoading(false);
      hideSplash();
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      perfMark("auth-getSession", session ? "signed-in" : "signed-out");
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        profileFetchedForRef.current = null;
        setProfile(null);
        setPasswordResetLock(false);
      }
      setLoading(false);
      hideSplash();
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
      window.clearTimeout(splashTimeout);
      subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("storage", handleStorage);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const value = useMemo(
    () => ({ user, profile, loading, mustCompletePasswordReset, beginPasswordReset, completePasswordReset, refreshProfile, signOut }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, profile, loading, mustCompletePasswordReset]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
