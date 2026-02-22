import { AvatarPickerGrid } from "../components/AvatarPickerGrid";
import { HonorificToggle } from "../components/HonorificToggle";

export interface JoinCodeFormProps {
  inputId?: string;
  hintId?: string;
  pickerId?: string;
}

export function JoinCodeForm({
  inputId = "join-code",
  hintId = "join-step-hint",
  pickerId = "join-avatar-picker"
}: JoinCodeFormProps) {
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
        />
      </div>
      <p id={hintId} className="subtext join-code-status" aria-live="polite">Enter 4-letter code</p>
      <div id="join-avatar-picker-stack" className="avatar-picker-stack">
        <HonorificToggle id="join-honorific-toolbar" inputId="join-honorific-toggle" hidden />
        <AvatarPickerGrid id={pickerId} hidden />
      </div>
    </>
  );
}
