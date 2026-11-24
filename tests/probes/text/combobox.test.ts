import { describe, expect, test } from "bun:test";
import { renderTest } from "../../../src/lib/testing/index.ts";
import CB from "./CB.svelte";
import { reset } from "./state.svelte.ts";

const bold = (t: ReturnType<typeof renderTest>, y: number, w = 30) => {
  const screen = t.screen();
  let out = "";
  for (let x = 0; x < w; x++) out += screen.styleAt(x, y).bold ? "^" : " ";
  return out.trimEnd();
};

describe("Combobox match highlighting", () => {
  test.failing(
    "highlight lines up with the match after a character whose lowercase is longer (İ)",
    () => {
      reset({ items: ["x İstanbul Ankara", "zzz"] });
      const t = renderTest(CB, { width: 40, height: 8 });
      t.type("ankara");
      const row = t.frame().split("\n")[1];
      const marks = bold(t, 1);
      t.unmount();
      expect(row).toBe("❯ x İstanbul Ankara");
      // "Ankara" is at columns 13-18
      expect(marks).toBe(" ".repeat(13) + "^^^^^^"); // actual: columns 14-18 ("nkara"), off by one
    },
  );

  test.failing(
    "a combining mark isn't dropped when the match ends on its base letter",
    () => {
      reset({ items: ["café latte", "tea"] });
      const t = renderTest(CB, { width: 40, height: 8 });
      t.type("cafe");
      const row = t.frame().split("\n")[1];
      t.unmount();
      expect(row).toBe("❯ café latte"); // actual: "❯ cafe latte" — the accent is lost
    },
  );
});
