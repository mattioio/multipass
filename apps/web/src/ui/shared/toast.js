export function createToastController() {
  const toastEl = document.getElementById("toast");
  const actionToastEl = document.getElementById("action-toast");
  const actionToastText = document.getElementById("action-toast-text");
  const actionToastCta = document.getElementById("action-toast-cta");

  function showToast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.remove("hidden");
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => toastEl.classList.add("hidden"), 2400);
  }

  function showActionToast(message, ctaLabel, onClick) {
    if (!actionToastEl || !actionToastText || !actionToastCta) return;
    actionToastText.textContent = message;
    actionToastCta.textContent = ctaLabel;
    actionToastCta.onclick = onClick;
    actionToastEl.classList.remove("hidden");
  }

  function hideActionToast() {
    if (!actionToastEl || !actionToastCta) return;
    actionToastEl.classList.add("hidden");
    actionToastCta.onclick = null;
    actionToastCta.disabled = false;
  }

  return {
    showToast,
    showActionToast,
    hideActionToast,
    actionToastCta
  };
}
