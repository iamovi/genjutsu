import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Force service worker registration for PWABuilder detection
registerSW({ immediate: true });

createRoot(document.getElementById("root")!).render(<App />);
