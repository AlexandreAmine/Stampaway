import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { StarRating, ratingAt } from "@/components/StarRating";

vi.mock("@/lib/haptics", () => ({ hapticLight: vi.fn() }));
vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string, r?: Record<string, string>) =>
      key === "rating.valueText" ? `${r?.value} out of 5 stars` : key === "rating.label" ? "Rating" : key,
  }),
}));

// jsdom has no PointerEvent; without one, clientX never reaches the handlers.
beforeAll(() => {
  if (typeof window.PointerEvent === "undefined") {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    }
    (window as any).PointerEvent = PointerEventPolyfill;
  }
});

// The star row is 100px wide starting at x=0, so each half-star is 10px.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0, top: 0, right: 100, bottom: 16, width: 100, height: 16, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect);
});

describe("ratingAt", () => {
  it("maps each tenth of the row to a half-star", () => {
    expect(ratingAt(1, 100)).toBe(0.5);
    expect(ratingAt(10, 100)).toBe(0.5);
    expect(ratingAt(11, 100)).toBe(1);
    expect(ratingAt(55, 100)).toBe(3);
    expect(ratingAt(100, 100)).toBe(5);
  });

  it("clamps positions past either end instead of producing 0 or >5", () => {
    expect(ratingAt(-40, 100)).toBe(0.5);
    expect(ratingAt(0, 100)).toBe(0.5);
    expect(ratingAt(250, 100)).toBe(5);
  });

  it("survives a zero-width row", () => {
    expect(ratingAt(20, 0)).toBe(0.5);
  });
});

function setup(rating: number) {
  const onChange = vi.fn();
  render(<StarRating rating={rating} size={16} interactive onChange={onChange} />);
  return { onChange, slider: screen.getByRole("slider") };
}

describe("StarRating (interactive)", () => {
  it("sets the value under a tap", () => {
    const { onChange, slider } = setup(0);
    fireEvent.pointerDown(slider, { clientX: 35, clientY: 8 });
    fireEvent.pointerUp(slider, { clientX: 35, clientY: 8 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("clears the rating when you tap the value already selected", () => {
    const { onChange, slider } = setup(2);
    fireEvent.pointerDown(slider, { clientX: 35, clientY: 8 });
    fireEvent.pointerUp(slider, { clientX: 35, clientY: 8 });
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("does NOT rate on touch-down alone", () => {
    const { onChange, slider } = setup(0);
    fireEvent.pointerDown(slider, { clientX: 35, clientY: 8 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("follows a horizontal drag, emitting each new half-star once", () => {
    const { onChange, slider } = setup(0);
    fireEvent.pointerDown(slider, { clientX: 5, clientY: 8 });
    fireEvent.pointerMove(slider, { clientX: 25, clientY: 8 }); // 1.5
    fireEvent.pointerMove(slider, { clientX: 27, clientY: 8 }); // still 1.5
    fireEvent.pointerMove(slider, { clientX: 95, clientY: 8 }); // 5
    fireEvent.pointerUp(slider, { clientX: 95, clientY: 8 });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([1.5, 5]);
  });

  it("does not toggle to 0 when a drag ends on the starting value", () => {
    const { onChange, slider } = setup(3);
    fireEvent.pointerDown(slider, { clientX: 55, clientY: 8 });
    fireEvent.pointerMove(slider, { clientX: 85, clientY: 8 }); // 4.5
    fireEvent.pointerMove(slider, { clientX: 55, clientY: 8 }); // back to 3
    fireEvent.pointerUp(slider, { clientX: 55, clientY: 8 });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([4.5, 3]);
  });

  it("treats a jitter under the drag threshold as a tap", () => {
    const { onChange, slider } = setup(0);
    fireEvent.pointerDown(slider, { clientX: 35, clientY: 8 });
    fireEvent.pointerMove(slider, { clientX: 37, clientY: 9 });
    fireEvent.pointerUp(slider, { clientX: 37, clientY: 9 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("emits nothing when the browser takes the touch for a scroll", () => {
    const { onChange, slider } = setup(0);
    fireEvent.pointerDown(slider, { clientX: 35, clientY: 8 });
    fireEvent.pointerCancel(slider);
    fireEvent.pointerUp(slider, { clientX: 35, clientY: 8 });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("adjusts by half a star with the arrow keys", () => {
    const { onChange, slider } = setup(3);
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([3.5, 2.5]);
  });

  it("clamps keyboard changes to 0–5", () => {
    const top = setup(5);
    fireEvent.keyDown(top.slider, { key: "ArrowRight" });
    expect(top.onChange).toHaveBeenCalledWith(5);
  });

  it("exposes its value to VoiceOver", () => {
    const { slider } = setup(3.5);
    expect(slider).toHaveAttribute("aria-valuenow", "3.5");
    expect(slider).toHaveAttribute("aria-valuetext", "3.5 out of 5 stars");
  });
});

describe("StarRating (display only)", () => {
  it("is not a control and ignores touches", () => {
    const onChange = vi.fn();
    render(<StarRating rating={4} />);
    expect(screen.queryByRole("slider")).toBeNull();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("aria-label", "4 out of 5 stars");
    fireEvent.pointerDown(img, { clientX: 35 });
    fireEvent.pointerUp(img, { clientX: 35 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
