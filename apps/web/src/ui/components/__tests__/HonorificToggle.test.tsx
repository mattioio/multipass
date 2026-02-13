import { render, screen } from "@testing-library/react";
import { HonorificToggle } from "../HonorificToggle";

describe("HonorificToggle", () => {
  it("renders Mr/Mrs switch with runtime data hook", () => {
    render(<HonorificToggle id="host-honorific-toolbar" inputId="host-honorific-toggle" />);

    expect(screen.getByText("Mr")).toBeInTheDocument();
    expect(screen.getByText("Mrs")).toBeInTheDocument();
    expect(screen.getByLabelText("Use Mrs player title")).toHaveAttribute("data-honorific-toggle", "true");
  });

  it("supports hidden state for step-gated flows", () => {
    render(<HonorificToggle id="join-honorific-toolbar" hidden />);

    expect(document.getElementById("join-honorific-toolbar")).toHaveClass("hidden");
  });
});
