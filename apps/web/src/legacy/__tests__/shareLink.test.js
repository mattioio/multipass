import { buildJoinDeepLink, copyRoomInviteLink, copyTextWithFallback } from "../shareLink.js";

describe("share link helpers", () => {
  it("builds canonical #join=CODE deep links", () => {
    expect(buildJoinDeepLink("fvbj", "https://example.com/#lobby")).toBe(
      "https://example.com/#join=FVBJ"
    );
    expect(buildJoinDeepLink("12", "https://example.com/#lobby")).toBeNull();
  });

  it("copies invite link and shows success toast", async () => {
    const copy = vi.fn().mockResolvedValue(true);
    const showToast = vi.fn();

    const result = await copyRoomInviteLink({
      roomCode: "FVBJ",
      currentHref: "https://example.com/#lobby",
      copy,
      showToast
    });

    expect(copy).toHaveBeenCalledWith("https://example.com/#join=FVBJ");
    expect(showToast).toHaveBeenCalledWith("Link copied");
    expect(result).toEqual({
      ok: true,
      reason: null,
      link: "https://example.com/#join=FVBJ"
    });
  });

  it("shows copy failure toast when clipboard copy fails", async () => {
    const copy = vi.fn().mockResolvedValue(false);
    const showToast = vi.fn();

    const result = await copyRoomInviteLink({
      roomCode: "FVBJ",
      currentHref: "https://example.com/#lobby",
      copy,
      showToast
    });

    expect(showToast).toHaveBeenCalledWith("Couldn't copy invite link.");
    expect(result).toEqual({
      ok: false,
      reason: "copy_failed",
      link: "https://example.com/#join=FVBJ"
    });
  });

  it("does not call native share APIs", async () => {
    const nativeShare = navigator.share;
    const shareSpy = vi.fn();
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: shareSpy
    });

    try {
      await copyRoomInviteLink({
        roomCode: "FVBJ",
        currentHref: "https://example.com/#lobby",
        copy: vi.fn().mockResolvedValue(true),
        showToast: vi.fn()
      });
      expect(shareSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, "share", {
        configurable: true,
        value: nativeShare
      });
    }
  });

  it("uses clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const execCommand = vi.fn();

    const copied = await copyTextWithFallback("hello", {
      clipboard: { writeText },
      document: {
        createElement: vi.fn(),
        body: { appendChild: vi.fn() },
        execCommand
      }
    });

    expect(copied).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("falls back to execCommand when clipboard API fails", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const textarea = {
      value: "",
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
      remove: vi.fn()
    };
    const createElement = vi.fn().mockReturnValue(textarea);
    const appendChild = vi.fn();
    const execCommand = vi.fn().mockReturnValue(true);

    const copied = await copyTextWithFallback("hello", {
      clipboard: { writeText },
      document: {
        createElement,
        body: { appendChild },
        execCommand
      }
    });

    expect(copied).toBe(true);
    expect(createElement).toHaveBeenCalledWith("textarea");
    expect(appendChild).toHaveBeenCalledWith(textarea);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(textarea.remove).toHaveBeenCalled();
  });
});
