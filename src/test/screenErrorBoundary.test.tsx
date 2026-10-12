import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import ScreenErrorBoundary from "@/components/ScreenErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";

vi.mock("@/lib/monitoring", () => ({ reportError: () => {} }));

let shouldThrow = true;
function Broken(): JSX.Element {
  if (shouldThrow) throw new Error("bad data");
  return <p>Place page</p>;
}

let go: ReturnType<typeof useNavigate>;
function Shell({ pathname }: { pathname: string }) {
  go = useNavigate();
  return (
    <>
      <ScreenErrorBoundary resetKey={pathname}>
        <Routes>
          <Route path="/place" element={<Broken />} />
          <Route path="/explore" element={<p>Explore</p>} />
        </Routes>
      </ScreenErrorBoundary>
      <nav>Tab bar</nav>
    </>
  );
}

function App() {
  return (
    <LanguageProvider>
      <MemoryRouter initialEntries={["/explore", "/place"]} initialIndex={1}>
        <Routes>
          <Route path="*" element={<PathShell />} />
        </Routes>
      </MemoryRouter>
    </LanguageProvider>
  );
}
function PathShell() {
  return <Shell pathname={useLocation().pathname} />;
}

describe("ScreenErrorBoundary", () => {
  it("keeps an error inside its screen, then recovers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    render(<App />);
    expect(screen.getByText("This screen couldn't be shown")).toBeTruthy();
    // The rest of the app is still there.
    expect(screen.getByText("Tab bar")).toBeTruthy();

    // Try again, once the cause is gone.
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Place page")).toBeTruthy();
  });

  it("Back leaves the broken screen, and the next screen shows normally", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    shouldThrow = true;
    render(<App />);
    // As in the app's browser history: there's a screen to go back to.
    window.history.replaceState({ idx: 1 }, "");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    await act(async () => {});
    expect(screen.getByText("Explore")).toBeTruthy();
    expect(screen.queryByText("This screen couldn't be shown")).toBeNull();
    // Coming back to the screen tries it again.
    shouldThrow = false;
    await act(async () => go("/place"));
    expect(screen.getByText("Place page")).toBeTruthy();
  });
});
