/**
 * Render local setup step UI.
 * @param {Object} options
 * @param {Object} options.state
 * @param {(id: string) => any} options.getFruit
 * @param {(container: Element, selectedId: string|null, disabledIds?: string[]) => void} options.updateFruitPicker
 * @param {() => void} options.updateHeroActions
 */
export function renderLocalSetupScreen({ state, getFruit, updateFruitPicker, updateHeroActions }) {
  const stage = document.getElementById("local-stage");
  const stepCount = document.getElementById("local-step-count");
  const progress = document.getElementById("local-progress");
  const title = document.getElementById("local-step-title");
  const grid = document.getElementById("local-fruit-grid");
  if (!title || !grid || !stepCount || !progress || !stage) return;

  const segments = Array.from(progress.querySelectorAll(".local-progress-segment"));
  const stepChanged = state.prevLocalStep !== state.localStep;
  if (stepChanged) {
    stage.classList.remove("step-transition-enter");
    void stage.offsetWidth;
    stage.classList.add("step-transition-enter");
  }

  if (state.localStep === "p1") {
    stepCount.textContent = "1/2";
    segments.forEach((segment, index) => segment.classList.toggle("active", index === 0));
    title.textContent = "Player 1 choice";
    updateFruitPicker(grid, state.localFruits.one, []);
  } else {
    stepCount.textContent = "2/2";
    segments.forEach((segment, index) => segment.classList.toggle("active", index === 1));
    title.textContent = "Player 2 choice";
    updateFruitPicker(grid, state.localFruits.two, state.localFruits.one ? [state.localFruits.one] : []);
  }

  const fruitOne = state.localFruits.one;
  grid.querySelectorAll(".fruit-option").forEach((button) => {
    const fruitId = button.dataset.fruit || "";
    const fruit = getFruit(fruitId);
    const defaultLabel = fruit ? `${fruit.name}` : "";
    button.classList.remove("p1-locked");
    if (defaultLabel) {
      button.setAttribute("aria-label", defaultLabel);
    } else {
      button.removeAttribute("aria-label");
    }
    button.removeAttribute("aria-disabled");
    if (state.localStep === "p2" && fruitOne && fruitId === fruitOne) {
      button.classList.add("p1-locked");
      button.setAttribute("aria-disabled", "true");
      if (fruit) {
        button.setAttribute("aria-label", `${fruit.name}, selected by Player 1`);
      }
    }
  });

  state.prevLocalStep = state.localStep;
  updateHeroActions();
}
