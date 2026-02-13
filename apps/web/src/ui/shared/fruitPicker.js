export function setupFruitPicker(container, onSelect) {
  if (!container) return;
  container.addEventListener("click", (event) => {
    let button = null;
    if (event.target instanceof Element) {
      button = event.target.closest(".fruit-option");
    }
    if (!button && typeof event.composedPath === "function") {
      button = event.composedPath().find((node) => (
        node instanceof Element && node.classList?.contains("fruit-option")
      )) || null;
    }
    if (!button || button.disabled) return;
    const fruitId = button.dataset.fruit;
    if (!fruitId) return;
    onSelect(fruitId);
  });
}

export function updateFruitPicker(container, selectedId, disabledIds = []) {
  if (!container) return;
  container.querySelectorAll(".fruit-option").forEach((button) => {
    const fruitId = button.dataset.fruit;
    const isSelected = fruitId === selectedId;
    const isDisabled = disabledIds.includes(fruitId);
    button.classList.toggle("selected", isSelected);
    button.setAttribute("aria-pressed", String(isSelected));
    button.dataset.selected = String(isSelected);
    button.disabled = isDisabled;
  });
}
