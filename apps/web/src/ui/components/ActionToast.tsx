import { Button } from "./Button";

export function ActionToast() {
  return (
    <div id="action-toast" className="action-toast hidden">
      <span id="action-toast-text"></span>
      <Button id="action-toast-cta" variant="small">Agree</Button>
    </div>
  );
}
