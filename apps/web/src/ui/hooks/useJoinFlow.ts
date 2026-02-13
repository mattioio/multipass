import { useMemo } from "react";
import { normalizeRoomCode } from "../../legacy/hashRoute.js";

export function useJoinFlow(inputCode: string) {
  const normalizedCode = useMemo(() => normalizeRoomCode(inputCode), [inputCode]);

  return {
    normalizedCode,
    canValidate: normalizedCode.length === 4
  };
}
