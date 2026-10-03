import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  rows: [] as any[],
  insertError: null as unknown,
  deleteError: null as unknown,
  // Lets a test hold the insert open to look at the screen meanwhile.
  insertGate: null as Promise<void> | null,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    const q: any = {
      select: () => q,
      eq: () => q,
      in: () => q,
      order: () => q,
      insert: async (row: any) => {
        if (h.insertGate) await h.insertGate;
        if (!h.insertError) h.rows.push({ id: `c${h.rows.length + 1}`, created_at: new Date().toISOString(), ...row });
        return { error: h.insertError };
      },
      delete: () => ({
        eq: async (_c: string, id: string) => {
          if (!h.deleteError) h.rows = h.rows.filter((r) => r.id !== id);
          return { error: h.deleteError };
        },
      }),
      then: (resolve: (v: unknown) => void) =>
        resolve({
          data: table === "profiles" ? [{ user_id: "me", username: "pariso", profile_picture: null }] : h.rows,
          error: null,
        }),
    };
    return q;
  };
  return { supabase: { from } };
});
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "me" }, profile: { username: "pariso", profile_picture: null } }),
}));
vi.mock("@/lib/toastError", () => ({ toastError: vi.fn() }));

import { ReviewComments } from "@/components/ReviewComments";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { toastError } from "@/lib/toastError";

const setup = async () => {
  render(
    <LanguageProvider>
      <MemoryRouter>
        <ReviewComments reviewId="r1" />
      </MemoryRouter>
    </LanguageProvider>,
  );
  await act(async () => {});
};
const box = () => screen.getByPlaceholderText(/comment/i) as HTMLInputElement;
const send = async (text: string) => {
  fireEvent.change(box(), { target: { value: text } });
  fireEvent.keyDown(box(), { key: "Enter" });
};

beforeEach(() => {
  h.rows = [];
  h.insertError = null;
  h.deleteError = null;
  h.insertGate = null;
  vi.mocked(toastError).mockClear();
});

describe("ReviewComments", () => {
  it("shows a new comment before the server has saved it", async () => {
    await setup();
    let open!: () => void;
    h.insertGate = new Promise((r) => (open = r));
    await act(async () => send("Lovely place"));
    expect(screen.getByText("Lovely place")).toBeTruthy();
    expect(box().value).toBe("");
    await act(async () => open());
    expect(screen.getByText("Lovely place")).toBeTruthy();
  });

  it("a failed post is taken back out and the text returns to the box", async () => {
    await setup();
    h.insertError = new Error("offline");
    await act(async () => send("Lost words"));
    expect(screen.queryByText("Lost words")).toBeNull();
    expect(box().value).toBe("Lost words");
    expect(toastError).toHaveBeenCalled();
  });

  it("a failed delete puts the comment back", async () => {
    h.rows = [{ id: "c1", review_id: "r1", user_id: "me", parent_id: null, comment_text: "Keep me", created_at: new Date().toISOString() }];
    await setup();
    h.deleteError = new Error("nope");
    const trash = screen.getByText("Keep me").closest("div.flex-1")!.querySelectorAll("button");
    await act(async () => fireEvent.click(trash[trash.length - 1]));
    expect(screen.getByText("Keep me")).toBeTruthy();
    expect(toastError).toHaveBeenCalled();
  });

  it("a reply appears under the comment it answers", async () => {
    h.rows = [{ id: "c1", review_id: "r1", user_id: "me", parent_id: null, comment_text: "Parent", created_at: new Date().toISOString() }];
    await setup();
    let open!: () => void;
    h.insertGate = new Promise((r) => (open = r));
    await act(async () => fireEvent.click(screen.getByText(/reply/i)));
    await act(async () => send("Child"));
    const parentBlock = screen.getByText("Parent").closest("div.flex.items-start")!.parentElement!;
    expect(parentBlock.textContent).toContain("Child");
    await act(async () => open());
  });

  it("a reply to a reply appears under that reply", async () => {
    const at = new Date().toISOString();
    h.rows = [
      { id: "c1", review_id: "r1", user_id: "me", parent_id: null, comment_text: "Parent", created_at: at },
      { id: "c2", review_id: "r1", user_id: "me", parent_id: "c1", comment_text: "Child", created_at: at },
    ];
    await setup();
    let open!: () => void;
    h.insertGate = new Promise((r) => (open = r));
    await act(async () => fireEvent.click(screen.getAllByText(/^reply$/i)[1]));
    await act(async () => send("Grandchild"));
    const childBlock = screen.getByText("Child").closest("div.flex.items-start")!.parentElement!;
    expect(childBlock.textContent).toContain("Grandchild");
    await act(async () => open());
  });
});
