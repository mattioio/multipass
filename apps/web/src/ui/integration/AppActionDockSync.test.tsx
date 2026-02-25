import { fireEvent, render } from "@testing-library/react";
import { syncDockFromSourceButtons } from "../../legacy/appDockSync.js";
import { App } from "../App";

describe("App action dock sync", () => {
  it("mirrors lobby CTA state and forwards dock clicks to the source CTA", () => {
    render(<App />);

    const source = document.getElementById("ready-cta") as HTMLButtonElement | null;
    const dock = document.getElementById("app-dock-lobby-ready") as HTMLButtonElement | null;
    expect(source).toBeTruthy();
    expect(dock).toBeTruthy();
    if (!source || !dock) return;

    source.textContent = "Waiting for second player";
    source.disabled = true;
    syncDockFromSourceButtons({ landingMode: "local" });

    expect(dock.textContent).toBe("Waiting for second player");
    expect(dock.disabled).toBe(true);

    source.textContent = "Pick a game";
    source.disabled = false;
    syncDockFromSourceButtons({ landingMode: "local" });

    let clickCount = 0;
    source.addEventListener("click", () => {
      clickCount += 1;
    });

    fireEvent.click(dock);
    expect(clickCount).toBe(1);
  });
});
