/**
 * Render local setup step UI.
 * @param {Object} options
 * @param {Object} options.state
 * @param {(id: string) => any} options.getAvatar
 * @param {(avatar: any) => string} [options.formatAvatarLabel]
 * @param {(container: Element, selectedId: string|null, disabledIds?: string[]) => void} options.updateAvatarPicker
 * @param {() => void} [options.renderLocalSetupCta]
 * @param {() => void} options.updateHeroActions
 */
export function renderLocalSetupScreen({
  state,
  getAvatar,
  formatAvatarLabel = (avatar) => avatar?.name || "",
  updateAvatarPicker,
  renderLocalSetupCta = () => {},
  updateHeroActions
}) {
  const stage = document.getElementById("local-stage");
  const title = document.getElementById("local-step-title");
  const grid = document.getElementById("local-avatar-grid");
  if (!title || !grid || !stage) return;
  stage.dataset.localStep = state.localStep;

  const stepChanged = state.prevLocalStep !== state.localStep;
  if (stepChanged) {
    stage.classList.remove("step-transition-enter");
    void stage.offsetWidth;
    stage.classList.add("step-transition-enter");
  }

  if (state.localStep === "p1") {
    title.textContent = "Player 1 choice";
    updateAvatarPicker(grid, state.localAvatars.one, []);
  } else {
    title.textContent = "Player 2 choice";
    updateAvatarPicker(grid, state.localAvatars.two, state.localAvatars.one ? [state.localAvatars.one] : []);
  }

  const avatarOne = state.localAvatars.one;
  grid.querySelectorAll(".avatar-option").forEach((button) => {
    const avatarId = button.dataset.avatar || "";
    const avatar = getAvatar(avatarId);
    const defaultLabel = avatar ? `${formatAvatarLabel(avatar)}` : "";
    button.classList.remove("p1-locked");
    if (defaultLabel) {
      button.setAttribute("aria-label", defaultLabel);
    } else {
      button.removeAttribute("aria-label");
    }
    button.removeAttribute("aria-disabled");
    if (state.localStep === "p2" && avatarOne && avatarId === avatarOne) {
      button.classList.add("p1-locked");
      button.setAttribute("aria-disabled", "true");
      if (avatar) {
        button.setAttribute("aria-label", `${avatar.name}, selected by Player 1`);
      }
    }
  });

  renderLocalSetupCta();
  state.prevLocalStep = state.localStep;
  updateHeroActions();
}
