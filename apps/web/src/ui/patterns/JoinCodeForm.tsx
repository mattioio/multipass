import { Button } from "../components/Button";
import { AvatarPickerGrid } from "../components/AvatarPickerGrid";
import { HonorificToggle } from "../components/HonorificToggle";

export interface JoinCodeFormProps {
  inputId?: string;
  hintId?: string;
  pickerId?: string;
  submitButtonId?: string;
}

export function JoinCodeForm({
  inputId = "join-code",
  hintId = "join-step-hint",
  pickerId = "join-avatar-picker",
  submitButtonId = "join-room"
}: JoinCodeFormProps) {
  return (
    <>
      <label>
        Room code
        <input id={inputId} type="text" maxLength={4} placeholder="ABCD" />
      </label>
      <p id={hintId} className="subtext">Enter your room code to continue.</p>
      <div id="join-avatar-picker-stack" className="avatar-picker-stack">
        <HonorificToggle id="join-honorific-toolbar" inputId="join-honorific-toggle" hidden />
        <AvatarPickerGrid id={pickerId} hidden />
      </div>
      <div className="button-row">
        <Button id={submitButtonId}>Continue</Button>
      </div>
    </>
  );
}
