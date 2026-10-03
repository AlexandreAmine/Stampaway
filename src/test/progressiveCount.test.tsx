import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import ScrollRestoration from "@/components/ScrollRestoration";
import { useProgressiveCount } from "@/hooks/useProgressiveCount";

let scrollY = 0;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
  scrollY = 0;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
  window.scrollTo = ((_x: number, y: number) => {
    scrollY = y;
  }) as typeof window.scrollTo;
});
afterEach(() => vi.useRealTimers());

const rendered: number[] = [];
let navigate: ReturnType<typeof useNavigate>;

function List({ total, resetKey = "" }: { total: number; resetKey?: string }) {
  navigate = useNavigate();
  const count = useProgressiveCount(total, { initial: 3, step: 4, resetKey });
  rendered.push(count);
  return <div data-testid="count">{count}</div>;
}
function Other() {
  navigate = useNavigate();
  return null;
}

const setup = (path: string, props: { total: number; resetKey?: string }) => {
  rendered.length = 0;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ScrollRestoration />
      <Routes>
        <Route path="/other" element={<Other />} />
        <Route path="*" element={<List {...props} />} />
      </Routes>
    </MemoryRouter>,
  );
};

const frames = async (n: number) => {
  for (let i = 0; i < n; i++) {
    await act(async () => {
      vi.advanceTimersByTime(16);
    });
  }
};
const shown = (r: ReturnType<typeof render>) => Number(r.getByTestId("count").textContent);

describe("useProgressiveCount", () => {
  it("renders the first items now and the rest over the next frames", async () => {
    const r = setup("/a", { total: 15 });
    expect(rendered[0]).toBe(3);
    await frames(10);
    expect(shown(r)).toBe(15);
  });

  it("never goes past the total", async () => {
    const r = setup("/b", { total: 2 });
    expect(shown(r)).toBe(2);
    await frames(3);
    expect(shown(r)).toBe(2);
  });

  it("coming back to a saved scroll position renders everything at once", async () => {
    const r = setup("/c", { total: 15 });
    await frames(10);
    act(() => {
      scrollY = 1200;
      window.dispatchEvent(new Event("scroll"));
    });
    act(() => navigate("/other"));
    rendered.length = 0;
    act(() => navigate(-1));
    expect(rendered[0]).toBe(15);
    expect(shown(r)).toBe(15);
  });

  it("a new filter or query starts again from the first items", async () => {
    const r = setup("/d", { total: 15, resetKey: "Countries" });
    await frames(10);
    r.rerender(
      <MemoryRouter initialEntries={["/d"]}>
        <ScrollRestoration />
        <Routes>
          <Route path="*" element={<List total={15} resetKey="Cities" />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(shown(r)).toBe(3);
    await frames(10);
    expect(shown(r)).toBe(15);
  });
});
