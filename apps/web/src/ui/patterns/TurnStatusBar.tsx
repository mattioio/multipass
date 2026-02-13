export interface TurnStatusBarProps {
  id?: string;
  className?: string;
  live?: "off" | "polite" | "assertive";
}

export function TurnStatusBar({
  id = "turn-indicator",
  className = "turn-indicator turn-passive",
  live = "polite"
}: TurnStatusBarProps) {
  return <div id={id} className={className} aria-live={live}></div>;
}
