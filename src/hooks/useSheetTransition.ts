import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Exit transition for bottom sheets that mount/unmount from an `open` prop.
 *
 * Sheets in this app animate IN with `animate-in slide-in-from-bottom` but
 * previously vanished instantly on close. This hook plays a matching
 * slide-down/fade-out first: call `requestClose()` instead of `onClose()`;
 * `closing` drives the exit classes and `onClose` fires when the animation
 * finishes.
 */
export function useSheetTransition(open: boolean, onClose: () => void, duration = 200) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (open) setClosing(false);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [open]);

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    timerRef.current = window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, duration);
  }, [closing, onClose, duration]);

  return { closing, requestClose };
}
