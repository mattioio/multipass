import { normalizeRoomCode } from "./hashRoute.js";

export function buildJoinDeepLink(rawCode, currentHref = window.location.href) {
  const code = normalizeRoomCode(rawCode);
  if (code.length !== 4) return null;
  const url = new URL(currentHref);
  url.hash = `join=${code}`;
  return url.toString();
}

export async function copyTextWithFallback(text, options = {}) {
  if (!text) return false;

  const clipboard = options.clipboard || navigator.clipboard;
  const documentRef = options.document || document;

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch (err) {
      // fallback below
    }
  }

  const textarea = documentRef.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  documentRef.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;
  try {
    copied = Boolean(documentRef.execCommand("copy"));
  } catch (err) {
    copied = false;
  }

  textarea.remove();
  return copied;
}

export async function copyRoomInviteLink({
  roomCode,
  currentHref = window.location.href,
  showToast,
  copy = copyTextWithFallback
} = {}) {
  const link = buildJoinDeepLink(roomCode, currentHref);
  if (!link) {
    showToast?.("Room code unavailable.");
    return { ok: false, reason: "invalid_code", link: null };
  }

  const copied = await copy(link);
  if (copied) {
    showToast?.("Link copied");
    return { ok: true, reason: null, link };
  }

  showToast?.("Couldn't copy invite link.");
  return { ok: false, reason: "copy_failed", link };
}
