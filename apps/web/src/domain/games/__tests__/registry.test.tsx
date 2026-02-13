import { render, screen } from "@testing-library/react";
import {
  assertValidGameRegistry,
  getGameDefinitionOrFallback,
  listGameDefinitions
} from "../registry";

describe("game registry", () => {
  it("contains unique valid game definitions", () => {
    expect(() => assertValidGameRegistry()).not.toThrow();

    const ids = listGameDefinitions({ includeUnavailable: true }).map((game) => game.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("returns safe fallback for unknown game ids", () => {
    const fallback = getGameDefinitionOrFallback("unknown_game_id");
    expect(fallback.isAvailable).toBe(false);

    const Component = fallback.Component;
    render(
      <Component
        gameId="unknown_game_id"
        name="Unknown"
        runtime={{ uiState: "error", state: {}, error: "Unknown" }}
      />
    );

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });
});
