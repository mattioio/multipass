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
  checked = false,
  onChange,
  disabled = false
}: HonorificToggleProps) {
  const classes = ["avatar-picker-toolbar", className, hidden ? "hidden" : ""].filter(Boolean).join(" ");

  return (
    <div id={id} className={classes}>
      <div
        className={`honorific-segmented${checked ? " honorific-segmented--mrs" : ""}`}
        role="radiogroup"
        aria-label="Player title"
      >
        <input
          id={inputId}
          type="checkbox"
          className="honorific-segmented-input"
          data-honorific-toggle="true"
          aria-label="Use Mrs player title"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.currentTarget.checked)}
        />
        <button
          type="button"
          className={`honorific-seg${!checked ? " honorific-seg--active" : ""}`}
          aria-pressed={!checked}
          disabled={disabled}
          onClick={() => onChange?.(false)}
        >
          Mr
        </button>
        <button
          type="button"
          className={`honorific-seg${checked ? " honorific-seg--active" : ""}`}
          aria-pressed={checked}
          disabled={disabled}
          onClick={() => onChange?.(true)}
        >
          Mrs
        </button>
        <span className="honorific-seg-indicator" aria-hidden="true" />
      </div>
    </div>
  );
}
