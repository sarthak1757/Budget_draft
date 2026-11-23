import { describe, expect, it } from "vitest";
import { GAME_MOMENT } from "./motion";

describe("motion config", () => {
  it("keeps every game moment between 150 and 400ms", () => {
    for (const seconds of Object.values(GAME_MOMENT)) {
      expect(seconds).toBeGreaterThanOrEqual(0.15);
      expect(seconds).toBeLessThanOrEqual(0.4);
    }
  });
});
