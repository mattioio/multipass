import { createRoot } from "react-dom/client";
import { resolveRuntimeMode } from "./app/runtime";
import { App } from "./ui/App";
import "./styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root mount node");
}

createRoot(rootElement).render(<App />);

const runtimeMode = resolveRuntimeMode();
if (document.body) {
  document.body.dataset.runtimeMode = runtimeMode;
}

if (runtimeMode === "legacy" && !window.__multipassLegacyBootstrapped) {
  window.__multipassLegacyBootstrapped = true;
  requestAnimationFrame(() => {
    void import("./legacy/runtime.js").then((mod) => {
      mod.initLegacyApp();
    });
  });
}
