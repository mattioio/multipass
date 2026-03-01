import { Button } from "./Button";

export function AppActionDock() {
  return (
    <div id="app-fixed-footer" className="app-action-dock hidden" aria-hidden="true">
      <div id="app-dock-slot-landing" className="app-fixed-footer-slot app-dock-slot app-dock-slot-landing hidden">
        <Button id="app-dock-landing-primary" className="app-dock-btn" type="button">Start</Button>
        <Button id="app-dock-landing-secondary" variant="ghost" className="app-dock-btn hidden" type="button">
          Join room
        </Button>
      </div>

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
