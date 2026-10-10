import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const h = vi.hoisted(() => ({
  countries: 0,
  native: true,
  profile: { username: "me", profile_picture: null, needs_username: false } as any,
  queries: 0,
}));

vi.mock("@/lib/native/photoTrips", () => ({ canFindCountriesInPhotos: () => h.native }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, profile: h.profile }) }));
vi.mock("@/integrations/supabase/client", () => {
  const q: any = {
    select: () => q,
    eq: () => q,
    then: (resolve: any) => {
      h.queries++;
      resolve({ count: h.countries, error: null });
    },
  };
  return { supabase: { from: () => q } };
});

async function mount(path = "/") {
  // Fresh module each time: "shown this launch" is module state.
  vi.resetModules();
  const { default: FindCountriesPrompt } = await import("@/components/FindCountriesPrompt");
  const { LanguageProvider } = await import("@/contexts/LanguageContext");
  const utils = render(
    <LanguageProvider>
      <MemoryRouter initialEntries={[path]}>
        <FindCountriesPrompt />
      </MemoryRouter>
    </LanguageProvider>
  );
  await act(async () => {
    vi.advanceTimersByTime(1500);
  });
  await act(async () => {});
  return { ...utils, FindCountriesPrompt };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  h.countries = 0;
  h.native = true;
  h.profile = { username: "me", profile_picture: null, needs_username: false };
  h.queries = 0;
});

describe("FindCountriesPrompt", () => {
  it("offers to find countries when none is logged", async () => {
    await mount();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Find countries in my photos" })).toBeTruthy();
  });

  it("never shows once a country is logged", async () => {
    h.countries = 1;
    await mount();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Not now closes it, and it doesn't come back in the same launch", async () => {
    const { unmount, FindCountriesPrompt } = await mount();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();
    const { LanguageProvider } = await import("@/contexts/LanguageContext");
    render(
      <LanguageProvider>
        <MemoryRouter>
          <FindCountriesPrompt />
        </MemoryRouter>
      </LanguageProvider>
    );
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits for the username step and stays off the add screens and the web", async () => {
    h.profile = { username: "", profile_picture: null, needs_username: true };
    await mount();
    expect(screen.queryByRole("dialog")).toBeNull();

    h.profile = { username: "me", profile_picture: null, needs_username: false };
    await mount("/add");
    expect(screen.queryByRole("dialog")).toBeNull();

    h.native = false;
    await mount();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(h.queries).toBe(0);
  });

  it("lets the notifications prompt through only once it's out of the way", async () => {
    await mount();
    const prompts = await import("@/lib/launchPrompts");
    let done = false;
    void prompts.whenFindCountriesPromptDone().then(() => (done = true));
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(done).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    await act(async () => {});
    expect(done).toBe(true);
  });

  it("with a country already logged, the notifications prompt needn't wait", async () => {
    h.countries = 1;
    await mount();
    const prompts = await import("@/lib/launchPrompts");
    let done = false;
    void prompts.whenFindCountriesPromptDone().then(() => (done = true));
    await act(async () => {});
    expect(done).toBe(true);
  });
});
