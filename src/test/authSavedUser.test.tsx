import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";

const h = vi.hoisted(() => ({
  emit: null as null | ((event: string, session: any) => void),
  resolveSession: null as null | ((result: any) => void),
}));

vi.mock("@/integrations/supabase/client", () => {
  const q: any = { select: () => q, eq: () => q, single: async () => ({ data: null }) };
  return {
    supabase: {
      from: () => q,
      auth: {
        storageKey: "sb-test-auth-token",
        onAuthStateChange: (cb: any) => {
          h.emit = cb;
          return { data: { subscription: { unsubscribe() {} } } };
        },
        getSession: () => new Promise((resolve) => (h.resolveSession = resolve)),
        signOut: async () => {},
      },
    },
  };
});
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: { hide: async () => {} } }));

import { AuthRetryableFetchError, AuthApiError } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

let seen: { user: any; loading: boolean } = { user: undefined, loading: true };
function Consumer() {
  const { user, loading } = useAuth();
  seen = { user, loading };
  return null;
}
const mount = () =>
  render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>
  );

describe("AuthContext saved user", () => {
  beforeEach(() => localStorage.clear());

  it("opens signed in at once from the saved session", () => {
    localStorage.setItem("sb-test-auth-token", JSON.stringify({ refresh_token: "r", user: { id: "u1" } }));
    mount();
    expect(seen.loading).toBe(false);
    expect(seen.user?.id).toBe("u1");
  });

  it("waits for Supabase when nothing is saved", () => {
    mount();
    expect(seen.loading).toBe(true);
    expect(seen.user).toBeNull();
  });

  it("stays signed in when the session can't be renewed offline", async () => {
    localStorage.setItem("sb-test-auth-token", JSON.stringify({ refresh_token: "r", user: { id: "u1" } }));
    mount();
    await act(async () => h.emit!("INITIAL_SESSION", null));
    await act(async () =>
      h.resolveSession!({ data: { session: null }, error: new AuthRetryableFetchError("offline", 0) })
    );
    expect(seen.user?.id).toBe("u1");

    // Back online, the renewed session confirms it.
    await act(async () => h.emit!("TOKEN_REFRESHED", { access_token: "t", user: { id: "u1" } }));
    expect(seen.user?.id).toBe("u1");
  });

  it("signs out when the saved session is no longer valid", async () => {
    localStorage.setItem("sb-test-auth-token", JSON.stringify({ refresh_token: "r", user: { id: "u1" } }));
    mount();
    await act(async () =>
      h.resolveSession!({ data: { session: null }, error: new AuthApiError("revoked", 400, "refresh_token_not_found") })
    );
    expect(seen.user).toBeNull();
  });

  it("a sign-out during startup is never ignored", async () => {
    localStorage.setItem("sb-test-auth-token", JSON.stringify({ refresh_token: "r", user: { id: "u1" } }));
    mount();
    await act(async () => h.emit!("SIGNED_OUT", null));
    expect(seen.user).toBeNull();
  });
});
