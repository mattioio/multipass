import { Button } from "../components/Button";

export interface LobbyActionsProps {
  readyButtonId?: string;
  endButtonId?: string;
}

export function LobbyActions({ readyButtonId = "ready-cta", endButtonId = "end-game" }: LobbyActionsProps) {
  return (
    <>
      <Button id={readyButtonId} className="cta-main">Pick a game</Button>
      <Button id={endButtonId} variant="danger" className="hidden">End game</Button>
    </>
  );
}
