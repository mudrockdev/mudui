import { describe, expect, test } from "bun:test";
import { parseColor } from "../../../src/lib/renderer/style.ts";
import { sgr } from "../../../src/lib/renderer/screen.ts";

describe("probe: colors", () => {
  test.failing("256-color palette indices downgrade to a matching 16-color", () => {
    // 16 is black, 196 red, 21 blue, 46 green in the 6x6x6 cube; all currently become 37 (white)
    expect(sgr(16, -1, 0, "16")).toBe("\x1b[0;30m");
    expect(sgr(196, -1, 0, "16")).toBe(sgr(parseColor("#ff0000")!, -1, 0, "16"));
    expect(sgr(21, -1, 0, "16")).toBe(sgr(parseColor("#0000ff")!, -1, 0, "16"));
    expect(sgr(46, -1, 0, "16")).toBe(sgr(parseColor("#00ff00")!, -1, 0, "16"));
  });

  test.failing("rgb() with a negative component is invalid, not silently made positive", () => {
    expect(parseColor("rgb(-1,0,0)")).toBeUndefined();
  });
});
