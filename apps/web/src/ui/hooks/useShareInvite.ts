import { useCallback } from "react";
import { copyRoomInviteLink } from "../../legacy/shareLink.js";

export interface UseShareInviteOptions {
  roomCode: string | null | undefined;
  showToast?: (message: string) => void;
}

export function useShareInvite({ roomCode, showToast }: UseShareInviteOptions) {
  const onShare = useCallback(async () => {
    return copyRoomInviteLink({ roomCode, showToast });
  }, [roomCode, showToast]);

  return {
    onShare
  };
}
