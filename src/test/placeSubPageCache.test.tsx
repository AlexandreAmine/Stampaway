import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const h = vi.hoisted(() => ({
  listName: "Summer trip",
  gate: null as Promise<void> | null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      in: () => q,
      maybeSingle: async () => ({ data: { name: "Paris" }, error: null }),
      then: async (resolve: (v: unknown) => void) => {
        if (h.gate) await h.gate;
        if (table === "list_items") {
          resolve({ data: [{ list_id: "l1", lists: { id: "l1", name: h.listName, user_id: "u2" } }], error: null });
        } else {
          resolve({ data: [{ user_id: "u2", username: "maya", profile_picture: null }], error: null });
        }
      },
    };
    return q;
  };
  return { supabase: { from } };
});
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));

import PlaceSubPage from "@/pages/PlaceSubPage";
import { LanguageProvider } from "@/contexts/LanguageContext";

const open = () =>
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={["/place/p1/lists"]}>
        <Routes>
          <Route path="/place/:id/:section" element={<PlaceSubPage />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );

describe("PlaceSubPage", () => {
  it("shows the last loaded content at once when reopened, then refreshes it", async () => {
    // First visit: nothing cached, the content loads.
    const first = open();
    await act(async () => {});
    expect(screen.getByText("Summer trip")).toBeTruthy();
    first.unmount();

    // Second visit while the server is slow: the cached list is already there.
    let release!: () => void;
    h.gate = new Promise((r) => (release = r));
    h.listName = "Summer trip 2026";
    open();
    expect(screen.getByText("Summer trip")).toBeTruthy();

    // The quiet refresh then replaces it.
    await act(async () => release());
    expect(screen.getByText("Summer trip 2026")).toBeTruthy();
    h.gate = null;
  });
});
