import {
  AvatarTile,
  Button,
  Card,
  CardHeader,
  FruitPickerGrid,
  GameTile
} from "../components";

export function DevKitchenScreen() {
  return (
    <div className="devkit-layout">
      <div className="screen-head">
        <div>
          <h2 className="devkit-title">Component Kitchen Sink</h2>
          <p className="devkit-subtitle">Static snapshots of reusable UI components for dev review.</p>
        </div>
      </div>

      <section className="devkit-section">
        <h3>Buttons</h3>
        <div className="devkit-grid devkit-grid-buttons">
          <Button>Primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="small">Small</Button>
          <Button variant="danger">Danger</Button>
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
              <img src="/src/assets/local.svg" alt="" />
            </CardHeader>
            <h4 className="landing-title">Landing Card</h4>
            <p className="subtext">Landing style with icon header and CTA spacing.</p>
          </Card>
        </div>
      </section>

      <section className="devkit-section">
        <h3>Avatar Tiles</h3>
        <div className="devkit-grid devkit-grid-avatars">
          <AvatarTile fruitId="banana" label="Mr Yellow" themeClass="theme-banana" selected />
          <AvatarTile fruitId="strawberry" label="Mr Red" themeClass="theme-strawberry" />
          <AvatarTile fruitId="kiwi" label="Mr Green" themeClass="theme-kiwi" disabled />
          <AvatarTile fruitId="blueberry" label="Mr Blue" themeClass="theme-blueberry" />
        </div>
      </section>

      <section className="devkit-section">
        <h3>Fruit Picker Grid</h3>
        <FruitPickerGrid id="devkit-fruit-grid" selectedId="strawberry" disabledIds={["kiwi"]} />
      </section>

      <section className="devkit-section">
        <h3>Game Tile</h3>
        <div className="devkit-grid devkit-grid-games">
          <GameTile
            title="Tic Tac Toe"
            badge={<span className="game-chip choice-chip">Your choice</span>}
            cta={<Button className="game-cta">Play</Button>}
          />
        </div>
      </section>
    </div>
  );
}
