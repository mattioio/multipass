import { Button } from "../components/Button";
import { FruitPickerGrid } from "../components/FruitPickerGrid";

export interface JoinCodeFormProps {
  inputId?: string;
  hintId?: string;
  pickerId?: string;
  submitButtonId?: string;
}

export function JoinCodeForm({
  inputId = "join-code",
  hintId = "join-step-hint",
  pickerId = "join-fruit-picker",
  submitButtonId = "join-room"
}: JoinCodeFormProps) {
  return (
    <>
      <label>
        Room code
        <input id={inputId} type="text" maxLength={4} placeholder="ABCD" />
      </label>
      <p id={hintId} className="subtext">Enter your room code to continue.</p>
      <FruitPickerGrid id={pickerId} hidden />
      <div className="button-row">
        <Button id={submitButtonId}>Continue</Button>
      </div>
    </>
  );
}
