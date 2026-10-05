import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { useSheetDrag, isOverlayOpen } from "@/hooks/useSheetDrag";

function Sheet({ onClose, scrolled = false }: { onClose: () => void; scrolled?: boolean }) {
  const ref = useSheetDrag(onClose);
  return (
    <div ref={ref} data-testid="panel">
      <div
        data-testid="content"
        style={{ overflowY: "auto" }}
        ref={(el) => {
          if (!el) return;
          Object.defineProperty(el, "scrollHeight", { value: 1000, configurable: true });
          Object.defineProperty(el, "clientHeight", { value: 400, configurable: true });
          el.scrollTop = scrolled ? 200 : 0;
        }}
      />
    </div>
  );
}

const touch = (y: number, x = 100) => ({ touches: [{ clientX: x, clientY: y }] });

let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.useFakeTimers({ toFake: ["setTimeout"] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

const drag = (el: HTMLElement, distance: number, ms: number, x = 100) => {
  fireEvent.touchStart(el, touch(100));
  now += ms / 2;
  fireEvent.touchMove(el, touch(110, 100));
  now += ms / 2;
  fireEvent.touchMove(el, touch(100 + distance, x));
  fireEvent.touchEnd(el, { touches: [] });
};

describe("useSheetDrag", () => {
  it("follows the finger and closes when pulled far enough", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Sheet onClose={onClose} />);
    const content = getByTestId("content");
    fireEvent.touchStart(content, touch(100));
    fireEvent.touchMove(content, touch(110));
    fireEvent.touchMove(content, touch(180));
    expect(getByTestId("panel").style.transform).toBe("translateY(80px)");
    now = 1000; // slow: only distance counts
    fireEvent.touchMove(content, touch(260));
    fireEvent.touchEnd(content, { touches: [] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("springs back after a short slow pull", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Sheet onClose={onClose} />);
    drag(getByTestId("content"), 60, 1000);
    expect(onClose).not.toHaveBeenCalled();
    expect(getByTestId("panel").style.transform).toBe("translateY(0px)");
    vi.advanceTimersByTime(300);
    expect(getByTestId("panel").style.transform).toBe("");
  });

  it("a quick flick closes from a short pull", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Sheet onClose={onClose} />);
    drag(getByTestId("content"), 60, 60);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("leaves scrolling alone when the content is scrolled down", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Sheet onClose={onClose} scrolled />);
    drag(getByTestId("content"), 300, 1000);
    expect(onClose).not.toHaveBeenCalled();
    expect(getByTestId("panel").style.transform).toBe("");
  });

  it("ignores upward and sideways gestures", () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<Sheet onClose={onClose} />);
    const content = getByTestId("content");
    fireEvent.touchStart(content, touch(400));
    fireEvent.touchMove(content, touch(380));
    fireEvent.touchMove(content, touch(100));
    fireEvent.touchEnd(content, { touches: [] });
    fireEvent.touchStart(content, touch(100, 100));
    fireEvent.touchMove(content, touch(108, 200)); // mostly sideways
    fireEvent.touchMove(content, touch(300, 300));
    fireEvent.touchEnd(content, { touches: [] });
    expect(onClose).not.toHaveBeenCalled();
    expect(getByTestId("panel").style.transform).toBe("");
  });
});

describe("isOverlayOpen", () => {
  it("is true only while a sheet or open dialog is in the page", () => {
    expect(isOverlayOpen()).toBe(false);
    document.body.innerHTML = '<div data-overlay-open></div>';
    expect(isOverlayOpen()).toBe(true);
    document.body.innerHTML = '<div role="dialog" data-state="closed"></div>';
    expect(isOverlayOpen()).toBe(false);
    document.body.innerHTML = '<div role="dialog" data-state="open"></div>';
    expect(isOverlayOpen()).toBe(true);
  });
});
