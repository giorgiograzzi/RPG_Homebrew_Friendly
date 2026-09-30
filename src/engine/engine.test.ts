import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "./index";

describe("setup", () => {
  it("il motore si importa senza UI", () => {
    expect(ENGINE_VERSION).toBe(1);
  });
});
