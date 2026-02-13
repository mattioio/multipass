export interface RoomCodeShareRowProps {
  roomCodeId?: string;
  roomCodeValue?: string;
  shareButtonId?: string;
}

export function RoomCodeShareRow({
  roomCodeId = "room-code",
  roomCodeValue = "----",
  shareButtonId = "share-room-link"
}: RoomCodeShareRowProps) {
  return (
    <div className="hero-room-main">
      <div id="room-code-pill" className="code-pill">
        <span id={roomCodeId} className="code-hero">{roomCodeValue}</span>
      </div>
      <button id={shareButtonId} className="ghost hero-share-action" type="button">
        Share
      </button>
    </div>
  );
}
