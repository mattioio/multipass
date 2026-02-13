export interface PlayerStatusStripProps {
  leftName: string;
  leftState: string;
  rightName: string;
  rightState: string;
  compact?: boolean;
}

export function PlayerStatusStrip({
  leftName,
  leftState,
  rightName,
  rightState,
  compact = false
}: PlayerStatusStripProps) {
  return (
    <div className={`player-status-strip${compact ? " compact" : ""}`}>
      <div className="player-status-col" aria-live="polite">
        <strong>{leftName}</strong>
        <span>{leftState}</span>
      </div>
      <div className="player-status-col" aria-live="polite">
        <strong>{rightName}</strong>
        <span>{rightState}</span>
      </div>
    </div>
  );
}
