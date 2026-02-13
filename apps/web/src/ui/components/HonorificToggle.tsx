export interface HonorificToggleProps {
  id?: string;
  inputId?: string;
  className?: string;
  hidden?: boolean;
}

export function HonorificToggle({
  id,
  inputId,
  className = "",
  hidden = false
}: HonorificToggleProps) {
  const classes = ["avatar-picker-toolbar", className, hidden ? "hidden" : ""].filter(Boolean).join(" ");

  return (
    <div id={id} className={classes}>
      <div className="honorific-toggle" aria-label="Toggle player title">
        <span className="honorific-label" aria-hidden="true">Mr</span>
        <label className="switch">
          <input id={inputId} data-honorific-toggle="true" type="checkbox" aria-label="Use Mrs player title" />
          <span className="slider"></span>
        </label>
        <span className="honorific-label" aria-hidden="true">Mrs</span>
      </div>
    </div>
  );
}
