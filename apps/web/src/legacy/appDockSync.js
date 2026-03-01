const DOCK_SOURCE_BUTTON_MAP = Object.freeze([
  { sourceButtonId: "local-continue", dockButtonId: "app-dock-local-continue" },
  { sourceButtonId: "create-room", dockButtonId: "app-dock-host-create" },
  { sourceButtonId: "join-room", dockButtonId: "app-dock-join-room" },
  { sourceButtonId: "winner-play-again", dockButtonId: "app-dock-winner-next" }
]);

function getButtonById(id) {
  const element = document.getElementById(id);
  return element instanceof HTMLButtonElement ? element : null;
}

function mirrorButtonState(sourceButton, dockButton) {
  dockButton.textContent = sourceButton.textContent;
  dockButton.disabled = sourceButton.disabled;
  dockButton.classList.toggle("hidden", sourceButton.classList.contains("hidden"));
  dockButton.onclick = () => sourceButton.click();
}

export function syncDockSlotButton(sourceButtonId, dockButtonId) {
  const sourceButton = getButtonById(sourceButtonId);
  const dockButton = getButtonById(dockButtonId);
  if (!sourceButton || !dockButton) return false;
  mirrorButtonState(sourceButton, dockButton);
  return true;
}

export function syncLandingDockButtons(landingMode = "local") {
  const primaryDockButton = getButtonById("app-dock-landing-primary");
  const secondaryDockButton = getButtonById("app-dock-landing-secondary");
  if (!primaryDockButton || !secondaryDockButton) return;

  const isOnlineMode = landingMode === "online";
  const primarySourceId = isOnlineMode ? "go-host" : "go-local";
  const secondarySourceId = isOnlineMode ? "go-join" : null;

  const primarySourceButton = getButtonById(primarySourceId);
  if (primarySourceButton) {
    mirrorButtonState(primarySourceButton, primaryDockButton);
  } else {
    primaryDockButton.disabled = true;
    primaryDockButton.classList.add("hidden");
    primaryDockButton.onclick = null;
  }

  if (!secondarySourceId) {
    secondaryDockButton.classList.add("hidden");
    secondaryDockButton.disabled = true;
    secondaryDockButton.onclick = null;
    return;
  }

  const secondarySourceButton = getButtonById(secondarySourceId);
  if (secondarySourceButton) {
    mirrorButtonState(secondarySourceButton, secondaryDockButton);
    secondaryDockButton.classList.remove("hidden");
    return;
  }

  secondaryDockButton.classList.add("hidden");
  secondaryDockButton.disabled = true;
  secondaryDockButton.onclick = null;
}

export function syncDockFromSourceButtons({ landingMode = "local" } = {}) {
  DOCK_SOURCE_BUTTON_MAP.forEach(({ sourceButtonId, dockButtonId }) => {
    syncDockSlotButton(sourceButtonId, dockButtonId);
  });
  syncLandingDockButtons(landingMode);
}
