import { render } from "@testing-library/react";
import { App } from "../App";

describe("Poker Dice inline score guide", () => {
  it("renders inline score rows and removes legacy info modal controls", () => {
    render(<App />);

    const layout = document.getElementById("poker-dice-layout");
    expect(layout?.querySelector(".poker-dice-score-guide")).toBeInTheDocument();
    expect(layout?.querySelectorAll(".poker-dice-score-row[data-poker-category]")).toHaveLength(8);

    expect(layout?.querySelector('[data-poker-category="royal_flush"]')).toBeInTheDocument();
    expect(layout?.querySelector('[data-poker-category="flush"]')).toBeInTheDocument();
    expect(layout?.querySelector('[data-poker-category="five_kind"]')).toBeInTheDocument();
    expect(layout?.querySelector('[data-poker-category="four_kind"]')).toBeInTheDocument();
    expect(layout?.querySelector('[data-poker-category="full_house"]')).toBeInTheDocument();
    expect(layout?.querySelector('[data-poker-category="three_kind"]')).toBeInTheDocument();
    expect(layout?.querySelector('[data-poker-category="two_pair"]')).toBeInTheDocument();
    expect(layout?.querySelector('[data-poker-category="one_pair"]')).toBeInTheDocument();
    expect(layout?.querySelector('[data-poker-category="high_card"]')).not.toBeInTheDocument();

    expect(document.getElementById("poker-dice-projected")).toBeNull();
    expect(document.getElementById("poker-dice-info")).toBeNull();
    expect(document.getElementById("poker-dice-info-modal")).toBeNull();
  });
});
