import { Button } from "./Button";

export function AppActionDock() {
  return (
    <div id="app-fixed-footer" className="app-action-dock hidden" aria-hidden="true">
      <div id="app-dock-slot-local" className="app-fixed-footer-slot app-dock-slot hidden">
        <Button id="app-dock-local-continue" className="app-dock-btn" type="button">Pick a player</Button>
      </div>

      <div id="app-dock-slot-host" className="app-fixed-footer-slot app-dock-slot hidden">
        <Button id="app-dock-host-create" className="app-dock-btn" type="button">Pick a player</Button>
      </div>

      <div id="app-dock-slot-join" className="app-fixed-footer-slot app-dock-slot hidden">
        <Button id="app-dock-join-room" className="app-dock-btn" type="button">Continue</Button>
      </div>

      <div id="app-dock-slot-winner" className="app-fixed-footer-slot app-dock-slot hidden">
        <Button id="app-dock-winner-next" className="app-dock-btn" type="button">Next game</Button>
      </div>
    </div>
  );
}
