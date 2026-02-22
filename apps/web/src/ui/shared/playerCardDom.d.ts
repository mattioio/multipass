import type { PlayerCardModel } from "./playerCardContract";

export function createPlayerCardElement(
  inputModel: Partial<PlayerCardModel>,
  options?: { variant?: "picker" | "score" | "compact" }
): HTMLSpanElement;
