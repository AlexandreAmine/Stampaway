import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";

const h = vi.hoisted(() => ({ emit: null as null | ((event: string, session: any) => void) }));

vi.mock("@/integrations/supabase/client", () => {
  const q: any = { select: () => q, eq: () => q, single: async () => ({ data: { username: "u", profile_picture: null, needs_username: false } }) };
  return {
    supabase: {
      from: () => q,
      auth: {
        onAuthStateChange: (cb: any) => {
          h.emit = cb;
          return { data: { subscription: { unsubscribe() {} } } };
        },
        getSession: () => new Promise(() => {}),
        signOut: async () => {},
      },
    },
  };
});
vi.mock("@capacitor/splash-screen", () => ({ SplashScreen: { hide: async () => {} } }));

import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const user = (extra: Record<string, unknown> = {}) => ({ id: "u1", email: "a@b.c", ...extra });
const session = (u: any, token: string) => ({ access_token: token, user: u });

describe("AuthContext", () => {
  it("a token renewal for the same user doesn't re-render consumers", async () => {
    let renders = 0;
    let seen: unknown = null;
    function Consumer() {
      seen = useAuth().user;
      renders++;
      return null;
    }
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await act(async () => h.emit!("SIGNED_IN", session(user(), "t1")));
    await act(async () => {}); // profile load
    const first = seen;
    const before = renders;

    await act(async () => h.emit!("TOKEN_REFRESHED", session(user(), "t2")));
    expect(seen).toBe(first);
    expect(renders).toBe(before);

    // A real change to the user still comes through.
    await act(async () => h.emit!("USER_UPDATED", session(user({ email: "new@b.c" }), "t3")));
    expect((seen as any).email).toBe("new@b.c");

    await act(async () => h.emit!("SIGNED_OUT", null));
    expect(seen).toBeNull();
  });
});
