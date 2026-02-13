export function buildJoinDeepLink(rawCode: string | null | undefined, currentHref?: string): string | null;

export function copyTextWithFallback(
  text: string,
  options?: {
    clipboard?: { writeText?: (text: string) => Promise<void> };
    document?: Document;
  }
): Promise<boolean>;

export function copyRoomInviteLink(options?: {
  roomCode?: string | null;
  currentHref?: string;
  showToast?: (message: string) => void;
  copy?: (text: string) => Promise<boolean>;
}): Promise<{
  ok: boolean;
  reason: "invalid_code" | "copy_failed" | null;
  link: string | null;
}>;
