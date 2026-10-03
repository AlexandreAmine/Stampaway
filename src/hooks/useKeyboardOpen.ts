import { useEffect, useState } from "react";
import { Keyboard, isNative } from "@/lib/native";

/**
 * Whether the iOS on-screen keyboard is showing (always false on web).
 * The web view is resized above the keyboard, so anything fixed to the
 * bottom of the screen would otherwise ride up on top of it.
 */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isNative()) return;
    const handles = [
      Keyboard.addListener("keyboardWillShow", () => setOpen(true)),
      Keyboard.addListener("keyboardWillHide", () => setOpen(false)),
    ];
    return () => {
      handles.forEach((handle) => {
        void handle.then((h) => h.remove()).catch(() => {});
      });
    };
  }, []);

  return open;
}
