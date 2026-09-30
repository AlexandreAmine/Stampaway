import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import ScrollRestoration from "@/components/ScrollRestoration";

// jsdom has no layout: emulate a scrollable window whose scrollTo clamps to
// the page height, like a real browser.
let scrollY = 0;
let pageHeight = 5000;
const scrollTo = vi.fn((_x: number, y: number) => {
  scrollY = Math.max(0, Math.min(y, pageHeight));
  window.dispatchEvent(new Event("scroll"));
});

beforeEach(() => {
  scrollY = 0;
  pageHeight = 5000;
  scrollTo.mockClear();
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => scrollY });
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
});

let navigate: ReturnType<typeof useNavigate>;
function Driver() {
  navigate = useNavigate();
  return null;
}

function userScrollsTo(y: number) {
  scrollY = y;
  window.dispatchEvent(new Event("scroll"));
}

const setup = () =>
  render(
    <MemoryRouter initialEntries={["/explore"]}>
      <ScrollRestoration />
      <Driver />
    </MemoryRouter>,
  );

describe("ScrollRestoration", () => {
  it("returns to where you were after opening a page and going back", () => {
    setup();
    act(() => userScrollsTo(1800));

    act(() => navigate("/place/1")); // new page resets to the top
    expect(scrollY).toBe(0);

    act(() => navigate(-1));
    expect(scrollY).toBe(1800);
  });

  it("starts new pages at the top", () => {
    setup();
    act(() => userScrollsTo(900));
    act(() => navigate("/place/2"));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
  });

  it("keeps retrying while the page is still too short, then lands on the saved spot", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    setup();
    act(() => userScrollsTo(1800));
    act(() => navigate("/place/3"));

    pageHeight = 600; // coming back: content hasn't rendered yet
    act(() => navigate(-1));
    expect(scrollY).toBe(600);

    pageHeight = 5000; // content arrives on a later frame
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(scrollY).toBe(1800);
    vi.useRealTimers();
  });

  it("stops restoring as soon as the user touches the screen", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] });
    setup();
    act(() => userScrollsTo(1800));
    act(() => navigate("/place/4"));

    pageHeight = 600;
    act(() => navigate(-1));
    act(() => {
      window.dispatchEvent(new Event("touchstart"));
    });
    pageHeight = 5000;
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(scrollY).toBe(600);
    vi.useRealTimers();
  });
});

describe("ScrollRestoration with missed scroll events", () => {
  it("uses the real position at the moment of the tap, not the last scroll event", () => {
    setup();
    act(() => userScrollsTo(1600));
    // Momentum carries the page further without a scroll event reaching JS.
    scrollY = 1990;
    act(() => {
      document.body.dispatchEvent(new Event("touchstart", { bubbles: true }));
      navigate("/place/5");
    });
    act(() => navigate(-1));
    expect(scrollY).toBe(1990);
  });
});
