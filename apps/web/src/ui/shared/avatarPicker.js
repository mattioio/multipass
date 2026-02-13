export function setupAvatarPicker(container, onSelect) {
  if (!container) return;
  container.addEventListener("click", (event) => {
    let button = null;
    if (event.target instanceof Element) {
      button = event.target.closest(".avatar-option");
    }
    if (!button && typeof event.composedPath === "function") {
      button = event.composedPath().find((node) => (
        node instanceof Element && node.classList?.contains("avatar-option")
      )) || null;
    }
    if (!button || button.disabled) return;
    const avatarId = button.dataset.avatar;
    if (!avatarId) return;
    onSelect(avatarId);
  });
}

export function updateAvatarPicker(container, selectedId, disabledIds = []) {
  if (!container) return;
  container.querySelectorAll(".avatar-option").forEach((button) => {
    const avatarId = button.dataset.avatar;
    const isSelected = avatarId === selectedId;
    const isDisabled = disabledIds.includes(avatarId);
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.dataset.selected = String(isSelected);
    button.disabled = isDisabled;
  });
}
