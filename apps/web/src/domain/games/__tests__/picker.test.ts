import { resolvePickerGames } from "../picker.js";

describe("picker game resolver", () => {
  it("hydrates known games with catalog metadata", () => {
    const [resolved] = resolvePickerGames([
      { id: "tic_tac_toe", name: "Tic Tac Toe" }
    ]);

    expect(resolved.bannerKey).toBe("tic_tac_toe");
    expect(resolved.comingSoon).toBe(false);
  });

  it("hydrates word fight as coming soon", () => {
    const [resolved] = resolvePickerGames([
      { id: "word_fight", name: "Word Fight" }
    ]);

    expect(resolved.bannerKey).toBe("word_fight");
    expect(resolved.comingSoon).toBe(true);
  });

  it("keeps unknown games intact", () => {
    const [resolved] = resolvePickerGames([
      { id: "my_custom_game", name: "Custom" }
    ]);

    expect(resolved.id).toBe("my_custom_game");
    expect(resolved.name).toBe("Custom");
  });
});
