import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initLiveUpdates } from "./lib/native/liveUpdates";
import { isNative } from "./lib/native/platform";
import { initScrollKeyboardDismiss } from "./lib/keyboardDismiss";

// Mark Capgo OTA bundle as ready (native production builds only).
initLiveUpdates();

// Native pattern: scrolling the page dismisses the keyboard.
initScrollKeyboardDismiss();

// Enforce light status-bar icons over the dark UI in all cases (some iOS
// state restorations otherwise pick the wrong style).
if (isNative()) {
  import("@capacitor/status-bar")
    .then(({ StatusBar, Style }) => StatusBar.setStyle({ style: Style.Dark }))
    .catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
