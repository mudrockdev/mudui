import { describe, expect, test } from "bun:test";
import { stringWidth } from "../../../src/lib/renderer/text.ts";

describe("probe: text width", () => {
  // These are single code points with East_Asian_Width=W (Emoji_Presentation=Yes);
  // terminals draw them two cells wide.
  test.failing.each(["✅", "❌", "⚡", "⭐", "✨", "☕", "⌛", "⏳", "❗", "➕"])(
    "BMP emoji %s is two cells wide",
    (ch) => {
      expect(stringWidth(ch)).toBe(2);
    },
  );
});
