import { resolvePickerGames } from "../picker.js";

describe("picker game resolver", () => {
  it("hydrates known games with catalog metadata", () => {
    const [resolved] = resolvePickerGames([
      { id: "tic_tac_toe_blitz", name: "Tic Tac Toe Blitz" }
    ]);

    expect(resolved.bannerKey).toBe("tic_tac_toe_blitz");
    expect(resolved.comingSoon).toBe(false);
  });

  it("keeps unknown games intact", () => {
    const [resolved] = resolvePickerGames([
      { id: "my_custom_game", name: "Custom" }
    ]);

    expect(resolved.id).toBe("my_custom_game");
    expect(resolved.name).toBe("Custom");
  });
});
