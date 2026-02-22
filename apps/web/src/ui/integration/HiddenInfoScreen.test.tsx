import { render } from "@testing-library/react";
import { App } from "../App";

describe("Hidden info handoff screen", () => {
  it("renders pass-device controls in the app shell", () => {
    render(<App />);

    expect(document.getElementById("screen-pass")).toBeInTheDocument();
    expect(document.getElementById("pass-message")).toBeInTheDocument();
    expect(document.getElementById("pass-ready")).toBeInTheDocument();
  });
});
