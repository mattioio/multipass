import { fireEvent, render, screen } from "@testing-library/react";
import { FruitPickerGrid } from "../FruitPickerGrid";

describe("FruitPickerGrid", () => {
  it("renders all fruit options", () => {
    render(<FruitPickerGrid id="test-fruit-grid" />);
    expect(screen.getAllByRole("button")).toHaveLength(4);
  });

  it("marks selected and disabled options", () => {
    render(
      <FruitPickerGrid
        id="test-fruit-grid"
        selectedId="banana"
        disabledIds={["kiwi"]}
      />
    );

    const banana = screen.getByRole("button", { name: /mr yellow/i });
    const kiwi = screen.getByRole("button", { name: /mr green/i });

    expect(banana).toHaveAttribute("aria-pressed", "true");
    expect(kiwi).toBeDisabled();
  });

  it("forwards selection events", () => {
    const handleSelect = vi.fn();
    render(<FruitPickerGrid id="test-fruit-grid" onSelect={handleSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /mr red/i }));
    expect(handleSelect).toHaveBeenCalledWith("strawberry");
  });
});
