import { useMemo, useState } from "react";
import {
  AvatarTile,
  Button,
  Card,
  CardHeader,
  AvatarPickerGrid,
  GameTile
} from "../components";
import { GameModulesGallery } from "../patterns";
import type { GameUiState } from "../../types";

type DevKitFlag = "loading" | "disabled" | "selected" | "error" | "locked" | "waiting" | "reconnecting";

const ALL_FLAGS: DevKitFlag[] = ["loading", "disabled", "selected", "error", "locked", "waiting", "reconnecting"];

function parseFlagsFromQuery(search: string): Set<DevKitFlag> {
  const params = new URLSearchParams(search);
  const raw = params.get("devkit") || "";
  const values = raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const parsed = new Set<DevKitFlag>();
  for (const value of values) {
    if (ALL_FLAGS.includes(value as DevKitFlag)) {
      parsed.add(value as DevKitFlag);
    }
  }
  return parsed;
}

function deriveGameUiState(flags: Set<DevKitFlag>): GameUiState {
  if (flags.has("error")) return "error";
  if (flags.has("waiting")) return "waiting";
  if (flags.has("disabled") || flags.has("locked")) return "disabled";
  if (flags.has("selected")) return "complete";
  if (flags.has("loading") || flags.has("reconnecting")) return "active";
  return "idle";
}

export function DevKitchenScreen() {
  const initialFlags = useMemo(() => parseFlagsFromQuery(window.location.search), []);
  const [flags, setFlags] = useState<Set<DevKitFlag>>(initialFlags);

  const hasFlag = (flag: DevKitFlag) => flags.has(flag);
  const moduleState = deriveGameUiState(flags);

  const toggleFlag = (flag: DevKitFlag) => {
    setFlags((current) => {
      const next = new Set(current);
      if (next.has(flag)) {
        next.delete(flag);
      } else {
        next.add(flag);
      }
      return next;
    });
  };

  return (
    <div className="devkit-layout">
      <div className="screen-head">
        <div>
          <h2 className="devkit-title">Component Kitchen Sink</h2>
          <p className="devkit-subtitle">Static snapshots of reusable UI components for dev review.</p>
        </div>
      </div>

      <section className="devkit-section">
        <h3>State Knobs</h3>
        <div className="devkit-grid devkit-grid-buttons">
          {ALL_FLAGS.map((flag) => (
            <Button
              key={flag}
              type="button"
              variant={hasFlag(flag) ? "primary" : "ghost"}
              onClick={() => toggleFlag(flag)}
            >
              {flag}
            </Button>
          ))}
        </div>
      </section>

      <section className="devkit-section">
        <h3>Buttons</h3>
        <div className="devkit-grid devkit-grid-buttons">
          <Button disabled={hasFlag("disabled")}>Primary</Button>
          <Button variant="ghost" disabled={hasFlag("disabled")}>Ghost</Button>
          <Button variant="small" disabled={hasFlag("disabled")}>Small</Button>
          <Button variant="danger" disabled={hasFlag("disabled")}>Danger</Button>
        </div>
      </section>

      <section className="devkit-section">
        <h3>Cards</h3>
        <div className="devkit-grid devkit-grid-cards">
          <Card className="setup-card">
            <CardHeader className="setup-card-header setup-card-header-local">
              <span className="setup-card-tag">Local</span>
            </CardHeader>
            <h4>Setup Card</h4>
            <p className="subtext">Uses shared card shell and tagged header treatment.</p>
          </Card>
          <Card className="landing-card local-card">
            <CardHeader className="landing-card-header landing-card-header-local">
              <span className="landing-card-icon landing-card-icon-local" aria-hidden="true" />
            </CardHeader>
            <h4 className="landing-title">Landing Card</h4>
            <p className="subtext">Landing style with icon header and CTA spacing.</p>
          </Card>
        </div>
      </section>

      <section className="devkit-section">
        <h3>Avatar Tiles</h3>
        <div className="devkit-grid devkit-grid-avatars">
          <AvatarTile avatarId="yellow" label="Mr Yellow" themeClass="theme-yellow" selected={hasFlag("selected")} />
          <AvatarTile avatarId="red" label="Mr Red" themeClass="theme-red" />
          <AvatarTile avatarId="green" label="Mr Green" themeClass="theme-green" disabled={hasFlag("disabled") || hasFlag("locked")} />
          <AvatarTile avatarId="blue" label="Mr Blue" themeClass="theme-blue" />
        </div>
      </section>

      <section className="devkit-section">
        <h3>Avatar Picker Grid</h3>
        <AvatarPickerGrid
          id="devkit-avatar-grid"
          selectedId={hasFlag("selected") ? "red" : null}
          disabledIds={hasFlag("disabled") || hasFlag("locked") ? ["green"] : []}
        />
      </section>

      <section className="devkit-section">
        <h3>Game Tile States</h3>
        <div className="devkit-grid devkit-grid-games">
          <GameTile
            title="Tic Tac Toe"
            badge={hasFlag("waiting") ? <span className="game-chip waiting-chip">Waiting</span> : <span className="game-chip choice-chip">Your choice</span>}
            cta={<Button className="game-cta" disabled={hasFlag("disabled")}>{hasFlag("loading") ? "Loading..." : "Play"}</Button>}
          />
          <GameTile
            title="Connection"
            badge={hasFlag("error") ? <span className="game-chip blocked-chip">Error</span> : <span className="game-chip choice-chip">Healthy</span>}
            cta={<Button className="game-cta" variant="ghost">{hasFlag("reconnecting") ? "Reconnecting" : "Inspect"}</Button>}
          />
        </div>
      </section>

      <section className="devkit-section">
        <h3>Game Modules</h3>
        <GameModulesGallery state={moduleState} includeUnknownFallback />
      </section>
    </div>
  );
}
