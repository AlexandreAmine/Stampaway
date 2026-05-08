import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initLiveUpdates } from "./lib/native/liveUpdates";

// Mark Capgo OTA bundle as ready (native production builds only).
initLiveUpdates();

createRoot(document.getElementById("root")!).render(<App />);
