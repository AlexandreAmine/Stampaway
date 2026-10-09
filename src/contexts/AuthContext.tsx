import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { User, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SplashScreen } from "@capacitor/splash-screen";
import { isNative } from "@/lib/native/platform";
import { perfMark } from "@/lib/perfMarks";

const PASSWORD_RESET_LOCK_KEY = "traveld.password-reset-lock";
const SPLASH_FONT_WAIT_MS = 400;

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

/**
 * The signed-in user as saved on the phone, read without waiting on the
 * network. After the app has been closed for over an hour the access token
 * has expired, and Supabase only answers once it has renewed it online —
 * seconds on a slow connection, never when offline. Starting from the saved
 * user lets the app open straight onto its last screens meanwhile; Supabase
 * still has the final word (a revoked session signs out as before).
 */
function readSavedUser(): User | null {
  try {
    const key = (supabase.auth as unknown as { storageKey?: string }).storageKey;
    if (!key || typeof window === "undefined") return null;
    const saved = JSON.parse(window.localStorage.getItem(key) || "null");
    return saved?.refresh_token && saved?.user?.id ? (saved.user as User) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [savedUser] = useState(readSavedUser);
  const [user, setUserState] = useState<User | null>(savedUser);
  // True until Supabase has confirmed (or replaced) the saved user.
  const unconfirmedRef = useRef(!!savedUser);
  // Every hourly token renewal (and the double sign-in event at launch)
  // hands over a new copy of the same user. Keeping the existing object when
  // nothing in it changed stops everything that depends on the user from
  // re-rendering and re-running its effects for no reason.
  const setUser = (next: User | null) =>
    setUserState((prev) => (prev && next && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  const [profile, setProfile] = useState<{ username: string; profile_picture: string | null; needs_username: boolean } | null>(null);
  const [loading, setLoading] = useState(!savedUser);
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
    // Failed (e.g. offline at launch): let the next sign-in event try again.
    else if (profileFetchedForRef.current === userId) profileFetchedForRef.current = null;
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
    // After the first screen has been laid out and its fonts have loaded
    // (briefly capped), so the app never appears in a fallback font first.
    requestAnimationFrame(() => {
      const fontsReady = document.fonts?.ready ?? Promise.resolve();
      Promise.race([fontsReady, new Promise((r) => window.setTimeout(r, SPLASH_FONT_WAIT_MS))]).then(() => {
        perfMark("splash-hide");
        // Smooth dissolve into the app instead of a hard cut
        SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => {});
      });
    });
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

    // The saved user can show the app at once; its data loads as soon as
    // Supabase has the session ready.
    if (savedUser) {
      fetchProfile(savedUser.id);
      hideSplash();
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      perfMark("auth-event", `${_event} ${session ? "signed-in" : "signed-out"}`);
      // With no connection the startup answer is "no session" although it is
      // still saved: getSession below tells the two apart.
      if (_event === "INITIAL_SESSION" && !session && unconfirmedRef.current) return;
      unconfirmedRef.current = false;
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

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      perfMark("auth-getSession", session ? "signed-in" : "signed-out");
      // Offline: the session couldn't be renewed but is still saved, and
      // Supabase renews it once back online. Stay signed in meanwhile.
      if (!session && unconfirmedRef.current && error && isAuthRetryableFetchError(error)) {
        setLoading(false);
        hideSplash();
        return;
      }
      unconfirmedRef.current = false;
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
