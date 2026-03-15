const DOCK_SOURCE_BUTTON_MAP = Object.freeze([
  { sourceButtonId: "local-continue", dockButtonId: "app-dock-local-continue" },
  { sourceButtonId: "create-room", dockButtonId: "app-dock-host-create" },
  { sourceButtonId: "join-room", dockButtonId: "app-dock-join-room" }
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

export function syncDockFromSourceButtons() {
  DOCK_SOURCE_BUTTON_MAP.forEach(({ sourceButtonId, dockButtonId }) => {
    syncDockSlotButton(sourceButtonId, dockButtonId);
  });
}
