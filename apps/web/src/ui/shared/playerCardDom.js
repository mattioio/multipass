import { buildPlayerCardModel, getPlayerCardClassNames, PLAYER_CARD_VARIANTS } from "./playerCardContract.js";

function appendSelectedBadge(root, classes) {
  const badge = document.createElement("span");
  badge.className = classes.selectedBadge;
  badge.setAttribute("aria-hidden", "true");

  const check = document.createElement("span");
  check.className = classes.selectedCheck;
  check.textContent = "✓";

  const label = document.createElement("span");
  label.className = classes.selectedLabel;
  label.textContent = "Selected";

  badge.appendChild(check);
  badge.appendChild(label);
  root.appendChild(badge);
}

function appendLockBadge(root, classes) {
  const badge = document.createElement("span");
  badge.className = classes.lockBadge;
  badge.setAttribute("aria-hidden", "true");
  root.appendChild(badge);
}

function appendLeaderBadge(root, classes) {
  const badge = document.createElement("span");
  badge.className = classes.leaderBadge;
  badge.setAttribute("role", "img");
  badge.setAttribute("aria-label", "Leader");
  badge.setAttribute("title", "Leader");
  root.appendChild(badge);
}

export function createPlayerCardElement(inputModel, options = {}) {
  const variant = options.variant || PLAYER_CARD_VARIANTS.score;
  const model = buildPlayerCardModel(inputModel);
  const classes = getPlayerCardClassNames(variant, model);

  const shell = document.createElement("span");
  shell.className = `${classes.shell}${model.theme ? ` theme-${model.theme}` : ""}`;
  shell.dataset.playerCardVariant = variant;
  if (model.id) shell.dataset.playerId = model.id;

  const inner = document.createElement("span");
  inner.className = classes.inner;

  const art = document.createElement("span");
  art.className = classes.art;
  if (!model.isWaiting) {
    const img = document.createElement("img");
    img.className = classes.artImage;
    img.src = model.artSrc;
    img.alt = "";
    art.appendChild(img);
  }
  inner.appendChild(art);

  const showLowerThird = Boolean(model.name || model.roleLabel);
  if (showLowerThird) {
    const lowerThird = document.createElement("span");
    lowerThird.className = classes.lowerThird;

    if (model.name) {
      const name = document.createElement("span");
      name.className = classes.name;
      name.textContent = model.name;
      lowerThird.appendChild(name);
    }

    if (model.roleLabel) {
      const role = document.createElement("span");
      role.className = classes.role;
      role.textContent = model.roleLabel;
      lowerThird.appendChild(role);
    }

    inner.appendChild(lowerThird);
  }

  shell.appendChild(inner);

  if (model.isSelected) appendSelectedBadge(shell, classes);
  if (model.isLeader) appendLeaderBadge(shell, classes);
  if (model.isWaiting) {
    const spinner = document.createElement("span");
    spinner.className = classes.spinner;
    spinner.setAttribute("aria-hidden", "true");
    shell.appendChild(spinner);
  }
  if (variant === PLAYER_CARD_VARIANTS.picker) appendLockBadge(shell, classes);

  return shell;
}
