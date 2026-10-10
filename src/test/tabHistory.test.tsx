import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "me" } }) }));
vi.mock("@/hooks/useKeyboardOpen", () => ({ useKeyboardOpen: () => false }));

import { BottomNav } from "@/components/BottomNav";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { resetTabStacks } from "@/lib/tabStacks";

let go: ReturnType<typeof useNavigate>;
function Screen() {
  const location = useLocation();
  go = useNavigate();
  return <p data-testid="screen">{location.pathname}</p>;
}

const where = () => screen.getByTestId("screen").textContent;
const tab = (name: string) => fireEvent.click(screen.getByRole("button", { name }));

function mount() {
  render(
    <LanguageProvider>
      <MemoryRouter initialEntries={["/"]} future={{ v7_startTransition: true }}>
        <Routes>
          <Route path="*" element={<Screen />} />
        </Routes>
        <BottomNav />
      </MemoryRouter>
    </LanguageProvider>
  );
}

beforeEach(() => {
  resetTabStacks();
  sessionStorage.clear();
});

describe("per-tab history", () => {
  it("coming back to a tab reopens the screen it was left on, with Back leading to its first screen", async () => {
    mount();
    tab("Explore");
    await act(async () => go("/place/france"));
    await act(async () => go("/place/paris"));
    tab("Profile");
    expect(where()).toBe("/profile");

    tab("Explore");
    expect(where()).toBe("/place/paris");
    await act(async () => go(-1));
    expect(where()).toBe("/place/france");
    await act(async () => go(-1));
    expect(where()).toBe("/explore");
  });

  it("tapping the tab you're on returns to its first screen", async () => {
    mount();
    tab("Explore");
    await act(async () => go("/place/france"));
    tab("Explore");
    expect(where()).toBe("/explore");
    // And it stays there after visiting another tab.
    tab("Search");
    tab("Explore");
    expect(where()).toBe("/explore");
  });

  it("going back within a tab is remembered too", async () => {
    mount();
    tab("Search");
    await act(async () => go("/place/japan"));
    await act(async () => go("/place/tokyo"));
    await act(async () => go(-1));
    tab("Profile");
    tab("Search");
    expect(where()).toBe("/place/japan");
  });

  it("each tab keeps its own screens", async () => {
    mount();
    tab("Explore");
    await act(async () => go("/place/france"));
    tab("Profile");
    await act(async () => go("/settings"));
    tab("Explore");
    expect(where()).toBe("/place/france");
    tab("Profile");
    expect(where()).toBe("/settings");
  });
});
