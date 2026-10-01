import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const h = vi.hoisted(() => ({
  profileRow: { username: "alice", profile_picture: "https://x/a.jpg", bio: "hi", country: "France", is_private: true },
  calls: [] as string[],
}));

// Minimal Supabase stub: records which table was queried and answers the
// profile header query.
vi.mock("@/integrations/supabase/client", () => {
  const chain = (table: string) => {
    const q: any = {
      select: () => q, eq: () => q, neq: () => q, order: () => q, in: () => q,
      single: async () => ({ data: table === "profiles" ? h.profileRow : null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
      then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }),
    };
    h.calls.push(table);
    return q;
  };
  return { supabase: { from: chain, rpc: async () => ({ data: [], error: null }) } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/lib/placePrimaryQuery", () => ({ prefetchPlacePrimary: vi.fn() }));

import PressPrefetch from "@/components/PressPrefetch";
import { prefetchPlacePrimary } from "@/lib/placePrimaryQuery";
import { profileHeaderQueryKey, profileLinkProps, type ProfileHeader } from "@/lib/profileHeaderQuery";

let client: QueryClient;
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  h.calls = [];
  vi.mocked(prefetchPlacePrimary).mockClear();
});

function touch(el: Element) {
  act(() => {
    el.dispatchEvent(new Event("touchstart", { bubbles: true }));
  });
}

const setup = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={client}>
      <PressPrefetch />
      {ui}
    </QueryClientProvider>,
  );

describe("PressPrefetch", () => {
  it("shows the tapped row's name at once, but never assumes the account is public", () => {
    const { getByText } = setup(<button {...profileLinkProps("u1", "alice", "https://x/a.jpg")}>alice</button>);
    touch(getByText("alice"));
    const seeded = client.getQueryData<ProfileHeader>(profileHeaderQueryKey("u1"));
    expect(seeded?.username).toBe("alice");
    // Privacy must come from the server, never from a preview.
    expect(seeded?.is_private).toBeUndefined();
  });

  it("then loads the real header, including privacy", async () => {
    const { getByText } = setup(<button {...profileLinkProps("u1", "alice", null)}>alice</button>);
    touch(getByText("alice"));
    await vi.waitFor(() =>
      expect(client.getQueryData<ProfileHeader>(profileHeaderQueryKey("u1"))?.is_private).toBe(true),
    );
  });

  it("does not overwrite a header that is already cached", () => {
    client.setQueryData(profileHeaderQueryKey("u1"), { ...h.profileRow, username: "alice_real" });
    const { getByText } = setup(<button {...profileLinkProps("u1", "stale name", null)}>row</button>);
    touch(getByText("row"));
    expect(client.getQueryData<ProfileHeader>(profileHeaderQueryKey("u1"))?.username).toBe("alice_real");
  });

  it("ignores your own profile", () => {
    const { getByText } = setup(<button {...profileLinkProps("me", "me", null)}>me</button>);
    touch(getByText("me"));
    expect(client.getQueryData(profileHeaderQueryKey("me"))).toBeUndefined();
    expect(h.calls).not.toContain("profiles");
  });

  it("preloads a place from a poster, using the closest marked element", () => {
    const { getByText } = setup(
      <div {...profileLinkProps("u1", "alice", null)}>
        <div data-prefetch-place="p9"><span>poster</span></div>
      </div>,
    );
    touch(getByText("poster"));
    expect(prefetchPlacePrimary).toHaveBeenCalledWith(client, "p9", "me");
    expect(client.getQueryData(profileHeaderQueryKey("u1"))).toBeUndefined();
  });

  it("does nothing for touches outside marked links", () => {
    const { getByText } = setup(<p>plain text</p>);
    touch(getByText("plain text"));
    expect(h.calls).toEqual([]);
    expect(prefetchPlacePrimary).not.toHaveBeenCalled();
  });
});
