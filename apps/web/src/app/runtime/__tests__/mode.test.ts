import { resolveRuntimeMode } from "../mode";

describe("runtime mode resolution", () => {
  it("always returns react", () => {
    expect(resolveRuntimeMode()).toBe("react");
  });
});
