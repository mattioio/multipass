import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import "./styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root mount node");
}

createRoot(rootElement).render(<App />);

if (!window.__multipassLegacyBootstrapped) {
  window.__multipassLegacyBootstrapped = true;
  requestAnimationFrame(() => {
    void import("./legacy/runtime.js").then((mod) => {
      mod.initLegacyApp();
    });
  });
}
