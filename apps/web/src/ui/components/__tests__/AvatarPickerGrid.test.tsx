import { fireEvent, render, screen } from "@testing-library/react";
import { AvatarPickerGrid } from "../AvatarPickerGrid";

describe("AvatarPickerGrid", () => {
  it("renders all avatar options", () => {
    render(<AvatarPickerGrid id="test-avatar-grid" />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("marks selected and disabled options", () => {
    render(
      <AvatarPickerGrid
        id="test-avatar-grid"
        selectedId="yellow"
        disabledIds={["green"]}
      />
    );

    const yellow = screen.getByRole("button", { name: /mr yellow/i });
    const green = screen.getByRole("button", { name: /mr green/i });
    const red = screen.getByRole("button", { name: /mr red/i });

    expect(yellow).toHaveAttribute("aria-pressed", "true");
    expect(yellow.querySelector(".avatar-selected-badge")).toBeInTheDocument();
    expect(red.querySelector(".avatar-selected-badge")).not.toBeInTheDocument();
    expect(green).toBeDisabled();
  });

  it("forwards selection events", () => {
    const handleSelect = vi.fn();
    render(<AvatarPickerGrid id="test-avatar-grid" onSelect={handleSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /mr red/i }));
    expect(handleSelect).toHaveBeenCalledWith("red");
  });
});
