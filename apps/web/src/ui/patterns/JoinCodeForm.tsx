import {
  useMemo,
  useRef,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { normalizeRoomCode } from "../../legacy/hashRoute.js";
import playerAvatar from "../../assets/player.svg";
import playerAvatarAlt from "../../assets/player2.svg";
import { HonorificToggle } from "../components/HonorificToggle";
import { PlayerCardShell } from "../components/PlayerCardShell";

const JOIN_CODE_LENGTH = 4;
const JOIN_CODE_DISALLOWED_CHARS_REGEX = /[IO]/g;
const AVATAR_OPTIONS = [
  { id: "yellow", name: "Yellow", themeClass: "theme-yellow" },
  { id: "red", name: "Red", themeClass: "theme-red" },
  { id: "green", name: "Green", themeClass: "theme-green" },
  { id: "blue", name: "Blue", themeClass: "theme-blue" }
] as const;

function sanitizeJoinCode(rawCode: string): string {
  return normalizeRoomCode(rawCode)
    .replace(JOIN_CODE_DISALLOWED_CHARS_REGEX, "")
    .slice(0, JOIN_CODE_LENGTH);
}

function emitCode(
  nextCodeRaw: string,
  onCodeChange?: (code: string) => void,
  onCodeComplete?: (code: string) => void
) {
  const nextCode = sanitizeJoinCode(nextCodeRaw);
  onCodeChange?.(nextCode);
  if (nextCode.length === JOIN_CODE_LENGTH) {
    onCodeComplete?.(nextCode);
  }
}

export interface JoinCodeFormProps {
  inputId?: string;
  hintId?: string;
  pickerId?: string;
  code?: string;
  statusMessage?: string;
  validating?: boolean;
  step?: "code" | "avatar";
  selectedAvatarId?: string | null;
  disabledAvatarIds?: string[];
  honorific?: "mr" | "mrs";
  lockedAvatarId?: string | null;
  lockedAvatarLabel?: string | null;
  lockedAvatarArtSrc?: string | null;
  onCodeChange?: (code: string) => void;
  onCodeComplete?: (code: string) => void;
  onAvatarSelect?: (avatarId: string) => void;
  onHonorificChange?: (honorific: "mr" | "mrs") => void;
}

export function JoinCodeForm({
  inputId = "join-code",
  hintId = "join-step-hint",
  pickerId = "join-avatar-picker",
  code = "",
  statusMessage = "Enter 4-letter code",
  validating = false,
  step = "code",
  selectedAvatarId = null,
  disabledAvatarIds = [],
  honorific = "mr",
  lockedAvatarId = null,
  lockedAvatarLabel = null,
  lockedAvatarArtSrc = null,
  onCodeChange,
  onCodeComplete,
  onAvatarSelect,
  onHonorificChange
}: JoinCodeFormProps) {
  const slotRefs = useRef<Array<HTMLInputElement | null>>([]);
  const normalizedCode = useMemo(() => sanitizeJoinCode(code), [code]);
  const slotValues = useMemo(() => {
    return Array.from({ length: JOIN_CODE_LENGTH }, (_, index) => normalizedCode[index] || "");
  }, [normalizedCode]);
  const isCodeStep = step === "code";
  const defaultArtSrc = honorific === "mrs" ? playerAvatarAlt : playerAvatar;
  const honorificPrefix = honorific === "mrs" ? "Mrs" : "Mr";

  const setCodeFromSlotMutation = (nextSlotValues: string[]) => {
    emitCode(nextSlotValues.join(""), onCodeChange, onCodeComplete);
  };

  const focusSlot = (index: number) => {
    const target = slotRefs.current[index];
    if (!target) return;
    target.focus();
    target.select();
  };

  const handleSlotInput = (index: number, rawValue: string) => {
    if (!isCodeStep || validating) return;
    const sanitizedValue = sanitizeJoinCode(rawValue);
    const nextSlotValues = [...slotValues];
    for (let cursor = index; cursor < JOIN_CODE_LENGTH; cursor += 1) {
      nextSlotValues[cursor] = "";
    }

    if (sanitizedValue.length === 0) {
      setCodeFromSlotMutation(nextSlotValues);
      return;
    }

    for (let cursor = 0; cursor < sanitizedValue.length && index + cursor < JOIN_CODE_LENGTH; cursor += 1) {
      nextSlotValues[index + cursor] = sanitizedValue[cursor];
    }

    setCodeFromSlotMutation(nextSlotValues);
    const nextFocusIndex = Math.min(index + sanitizedValue.length, JOIN_CODE_LENGTH - 1);
    if (nextFocusIndex > index) {
      focusSlot(nextFocusIndex);
    }
  };

  const handleSlotInputEvent = (index: number, event: FormEvent<HTMLInputElement>) => {
    handleSlotInput(index, event.currentTarget.value);
  };

  const handleSlotBackspace = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (!isCodeStep || validating) return;
    if (event.key !== "Backspace" || slotValues[index]) return;
    if (index <= 0) return;
    event.preventDefault();
    const nextSlotValues = [...slotValues];
    nextSlotValues[index - 1] = "";
    setCodeFromSlotMutation(nextSlotValues);
    focusSlot(index - 1);
  };

  const handleSlotPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    if (!isCodeStep || validating) return;
    event.preventDefault();
    const pasted = sanitizeJoinCode(event.clipboardData.getData("text"));
    const nextSlotValues = [...slotValues];
    for (let cursor = index; cursor < JOIN_CODE_LENGTH; cursor += 1) {
      nextSlotValues[cursor] = "";
    }
    for (let cursor = 0; cursor < pasted.length && index + cursor < JOIN_CODE_LENGTH; cursor += 1) {
      nextSlotValues[index + cursor] = pasted[cursor];
    }
    setCodeFromSlotMutation(nextSlotValues);
    const nextFocusIndex = Math.min(index + pasted.length, JOIN_CODE_LENGTH - 1);
    focusSlot(nextFocusIndex);
  };

  return (
    <>
      <div className="join-code-group">
        <p className="join-code-label">Room code</p>
        <div className="join-code-cluster" role="group" aria-label="Room code">
          <input
            id="join-code-slot-0"
            className="join-code-slot"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label="Room code letter 1 of 4"
            value={slotValues[0]}
            disabled={!isCodeStep || validating}
            ref={(node) => {
              slotRefs.current[0] = node;
            }}
            onInput={(event) => handleSlotInputEvent(0, event)}
            onKeyDown={(event) => handleSlotBackspace(0, event)}
            onPaste={(event) => handleSlotPaste(0, event)}
          />
          <input
            id="join-code-slot-1"
            className="join-code-slot"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label="Room code letter 2 of 4"
            value={slotValues[1]}
            disabled={!isCodeStep || validating}
            ref={(node) => {
              slotRefs.current[1] = node;
            }}
            onInput={(event) => handleSlotInputEvent(1, event)}
            onKeyDown={(event) => handleSlotBackspace(1, event)}
            onPaste={(event) => handleSlotPaste(1, event)}
          />
          <input
            id="join-code-slot-2"
            className="join-code-slot"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label="Room code letter 3 of 4"
            value={slotValues[2]}
            disabled={!isCodeStep || validating}
            ref={(node) => {
              slotRefs.current[2] = node;
            }}
            onInput={(event) => handleSlotInputEvent(2, event)}
            onKeyDown={(event) => handleSlotBackspace(2, event)}
            onPaste={(event) => handleSlotPaste(2, event)}
          />
          <input
            id="join-code-slot-3"
            className="join-code-slot"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label="Room code letter 4 of 4"
            value={slotValues[3]}
            disabled={!isCodeStep || validating}
            ref={(node) => {
              slotRefs.current[3] = node;
            }}
            onInput={(event) => handleSlotInputEvent(3, event)}
            onKeyDown={(event) => handleSlotBackspace(3, event)}
            onPaste={(event) => handleSlotPaste(3, event)}
          />
        </div>
        <input
          id={inputId}
          className="join-code-canonical"
          type="text"
          maxLength={4}
          autoComplete="one-time-code"
          tabIndex={-1}
          aria-hidden="true"
          value={normalizedCode}
          onChange={(event) => {
            if (!isCodeStep || validating) return;
            emitCode(event.currentTarget.value, onCodeChange, onCodeComplete);
          }}
        />
      </div>
      <p id={hintId} className="subtext join-code-status" aria-live="polite">{statusMessage}</p>
      <div id="join-avatar-picker-stack" className="avatar-picker-stack">
        <HonorificToggle
          id="join-honorific-toolbar"
          inputId="join-honorific-toggle"
          hidden={isCodeStep}
          checked={honorific === "mrs"}
          onChange={(checked) => onHonorificChange?.(checked ? "mrs" : "mr")}
        />
        <div id={pickerId} className={`avatar-picker local-avatar-grid${isCodeStep ? " hidden" : ""}`}>
          {AVATAR_OPTIONS.map((avatar) => {
            const isLocked = lockedAvatarId === avatar.id;
            const isSelected = !isLocked && selectedAvatarId === avatar.id;
            const isDisabled = isLocked || disabledAvatarIds.includes(avatar.id);
            const displayName = isLocked && lockedAvatarLabel
              ? lockedAvatarLabel
              : `${honorificPrefix} ${avatar.name}`;
            const artSrc = isLocked
              ? (lockedAvatarArtSrc || playerAvatar)
              : defaultArtSrc;

            return (
              <button
                key={avatar.id}
                className={`avatar-option square-option ${avatar.themeClass}${isSelected ? " selected" : ""}${isLocked ? " p1-locked" : ""}`}
                data-avatar={avatar.id}
                data-selected={String(isSelected)}
                aria-pressed={isSelected}
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled ? "true" : undefined}
                aria-label={isLocked ? `${displayName}, already selected` : displayName}
                onClick={() => onAvatarSelect?.(avatar.id)}
              >
                <PlayerCardShell
                  variant="picker"
                  themeClass={avatar.themeClass}
                  name={displayName}
                  artSrc={artSrc}
                  selected={isSelected}
                  locked={isLocked}
                />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
