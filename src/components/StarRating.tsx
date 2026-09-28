import { useRef } from "react";
import { Star, Heart } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";

interface StarRatingProps {
  rating: number | null;
  size?: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  liked?: boolean;
}

/** Half-star value (0.5–5) for a position `x` across a row `width` wide. */
export function ratingAt(x: number, width: number): number {
  if (width <= 0) return 0.5;
  const halfSteps = Math.ceil((x / width) * 10);
  return Math.min(10, Math.max(1, halfSteps)) / 2;
}

/** Movement before a touch counts as a drag rather than a tap. */
const DRAG_SLOP_PX = 4;

export function StarRating({ rating, size = 16, interactive = false, onChange, liked }: StarRatingProps) {
  const { t } = useLanguage();
  const stars = [1, 2, 3, 4, 5];
  const displayRating = rating ?? 0;
  const starsRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    startX: number;
    startY: number;
    dragging: boolean;
    last: number;
  } | null>(null);

  const editable = interactive && !!onChange;

  const valueAt = (clientX: number) => {
    const rect = starsRef.current?.getBoundingClientRect();
    return rect ? ratingAt(clientX - rect.left, rect.width) : displayRating;
  };

  const emit = (value: number) => {
    hapticLight();
    onChange?.(value);
  };

  // Stars were individual tap targets exactly as big as the icon — 8pt wide per
  // half-star at size 16. The whole row is now one control: tap anywhere, or
  // drag along it and watch the value follow the finger. A rating is only
  // applied on a tap or a genuine horizontal drag, never on touch-down, so
  // starting a page scroll on a row of stars can't rate it by accident.
  const handlers = editable
    ? {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          gesture.current = {
            startX: e.clientX,
            startY: e.clientY,
            dragging: false,
            last: displayRating,
          };
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
          const g = gesture.current;
          if (!g) return;
          if (!g.dragging) {
            if (Math.abs(e.clientX - g.startX) < DRAG_SLOP_PX) return;
            g.dragging = true;
            e.currentTarget.setPointerCapture?.(e.pointerId);
          }
          const value = valueAt(e.clientX);
          if (value !== g.last) {
            g.last = value;
            emit(value);
          }
        },
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
          const g = gesture.current;
          gesture.current = null;
          if (!g || g.dragging) return;
          const value = valueAt(e.clientX);
          // Tapping the current value clears it, as before.
          emit(value === displayRating ? 0 : value);
        },
        onPointerCancel: () => {
          // The browser took the touch for a vertical scroll.
          gesture.current = null;
        },
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          const step =
            e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.5
            : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.5
            : 0;
          if (!step) return;
          e.preventDefault();
          emit(Math.min(5, Math.max(0, displayRating + step)));
        },
      }
    : {};

  const label = t("rating.valueText", { value: String(displayRating) });

  return (
    <div className="flex items-center gap-0.5">
      <div
        {...handlers}
        {...(editable
          ? {
              role: "slider",
              tabIndex: 0,
              "aria-label": t("rating.label"),
              "aria-valuemin": 0,
              "aria-valuemax": 5,
              "aria-valuenow": displayRating,
              "aria-valuetext": label,
            }
          : { role: "img", "aria-label": label })}
        // Grows the touch area without moving anything: 4px vertically is the
        // most that doesn't overlap the next row of sub-ratings.
        className={editable ? "-mx-2 -my-1 px-2 py-1 cursor-pointer select-none" : undefined}
        style={editable ? { touchAction: "pan-y" } : undefined}
      >
        <div ref={starsRef} className="flex items-center gap-0.5">
          {stars.map((star) => {
            const filled = displayRating >= star;
            const halfFilled = displayRating >= star - 0.5 && displayRating < star;

            return (
              <span key={star} className="relative block" style={{ width: size, height: size }}>
                <Star size={size} className="text-star-empty absolute inset-0" fill="none" />
                {halfFilled && (
                  <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
                    <Star size={size} className="text-star fill-star" fill="currentColor" />
                  </span>
                )}
                {filled && (
                  <Star size={size} className="text-star fill-star absolute inset-0" fill="currentColor" />
                )}
              </span>
            );
          })}
        </div>
      </div>
      {liked && (
        <Heart
          size={size * 0.75}
          className="text-red-500 fill-red-500 ml-0.5 shrink-0"
        />
      )}
    </div>
  );
}
