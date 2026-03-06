export interface HonorificToggleProps {
  id?: string;
  inputId?: string;
  className?: string;
  hidden?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
}

export function HonorificToggle({
  id,
  inputId,
  className = "",
  hidden = false,
  checked,
  onChange,
  disabled = false
}: HonorificToggleProps) {
  const classes = ["avatar-picker-toolbar", className, hidden ? "hidden" : ""].filter(Boolean).join(" ");
  const isControlled = typeof checked === "boolean";

  return (
    <div id={id} className={classes}>
      <div className="honorific-toggle" aria-label="Toggle player title">
        <span className="honorific-label" aria-hidden="true">Mr</span>
        <label className="switch">
          <input
            id={inputId}
            data-honorific-toggle="true"
            type="checkbox"
            aria-label="Use Mrs player title"
            checked={isControlled ? checked : undefined}
            disabled={disabled}
            onChange={(event) => onChange?.(event.currentTarget.checked)}
          />
          <span className="slider"></span>
        </label>
        <span className="honorific-label" aria-hidden="true">Mrs</span>
      </div>
    </div>
  );
}
