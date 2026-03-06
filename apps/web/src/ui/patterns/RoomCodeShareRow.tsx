export interface RoomCodeShareRowProps {
  roomCodeId?: string;
  roomCodeValue?: string;
  shareButtonId?: string;
  shareLabel?: string;
  shareDisabled?: boolean;
  onShare?: () => void;
}

export function RoomCodeShareRow({
  roomCodeId = "room-code",
  roomCodeValue = "----",
  shareButtonId = "share-room-link",
  shareLabel = "Share",
  shareDisabled = false,
  onShare
}: RoomCodeShareRowProps) {
  return (
    <div className="hero-room-main">
      <div id="room-code-pill" className="code-pill">
        <span id={roomCodeId} className="code-hero">{roomCodeValue}</span>
      </div>
      <button
        id={shareButtonId}
        className="ghost hero-share-action"
        type="button"
        onClick={onShare}
        disabled={shareDisabled}
      >
        {shareLabel}
      </button>
    </div>
  );
}
