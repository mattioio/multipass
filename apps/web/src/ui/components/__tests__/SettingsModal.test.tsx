import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsModal } from "../SettingsModal";

describe("SettingsModal", () => {
  it("opens, closes, and returns focus", () => {
    const trigger = document.createElement("button");
    trigger.textContent = "Open settings";
    document.body.appendChild(trigger);

    const onClose = vi.fn();
    const { rerender } = render(<SettingsModal open={true} onClose={onClose} returnFocusTo={trigger} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<SettingsModal open={false} onClose={onClose} returnFocusTo={trigger} />);
    expect(document.activeElement).toBe(trigger);

    trigger.remove();
  });
});
