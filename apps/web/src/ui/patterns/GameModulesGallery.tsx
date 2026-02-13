import { getGameDefinitionOrFallback, listGameDefinitions } from "../../domain/games";
import type { GameUiState } from "../../types";

export interface GameModulesGalleryProps {
  state?: GameUiState;
  includeUnknownFallback?: boolean;
}

export function GameModulesGallery({ state = "idle", includeUnknownFallback = true }: GameModulesGalleryProps) {
  const games = listGameDefinitions({ includeUnavailable: true });
  const fallback = includeUnknownFallback ? getGameDefinitionOrFallback("mystery_unknown") : null;
  const FallbackComponent = fallback?.Component ?? null;

  return (
    <div className="devkit-grid devkit-grid-games">
      {games.map((game) => {
        const Component = game.Component;
        return (
          <Component
            key={game.id}
            gameId={game.id}
            name={game.name}
            runtime={{ uiState: state, state: {} }}
          />
        );
      })}
      {FallbackComponent ? (
        <FallbackComponent
          key="mystery_unknown"
          gameId="mystery_unknown"
          name="Unknown game"
          runtime={{ uiState: "error", state: {}, error: "Unknown game type" }}
        />
      ) : null}
    </div>
  );
}
