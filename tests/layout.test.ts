import { describe, expect, test } from "bun:test";
import { renderTest } from "../src/lib/testing/index.ts";
import { DEFAULT_COLOR, parseColor } from "../src/lib/renderer/style.ts";
import { dedent } from "./helpers.ts";
import Layout from "./fixtures/Layout.svelte";

function frame(variant: string, width = 20, height = 6) {
  const t = renderTest(Layout, { width, height, props: { variant } });
  const out = t.frame();
  return { out, t };
}

describe("layout", () => {
  const cases: Record<string, string> = {
    "row-grow": "abmid             cd",
    "justify-between": "L         M        R",
    center: "\n         hi",
    gap: "one\n\ntwo",
    percent: "A    B",
    absolute: `
			underneath text here
			  +---+
			  |X  |
			  +---+`,
    scroll: "row1\nrow2",
    truncate: "abcdefg…\n…fghijkl\nabcd…jkl",
    wide: "日本語\nテキス\nト",
    "inline-styles": "plain bold u",
    "style-attr": `
			╭────────╮
			│  s     │
			╰────────╯`,
    hidden: "shown",
    "loose-text": "loose text and txt",
    fill: "ab========\n----------",
    margin: `
			┌───────┐
			│       │
			│ m     │
			│       │
			└───────┘`,
  };

  for (const [variant, expected] of Object.entries(cases)) {
    test(variant, () => {
      const { out, t } = frame(variant);
      expect(out).toBe(
        expected.startsWith("\n\t") ? dedent(expected) : expected,
      );
      t.unmount();
    });
  }

  test("border, padding, title and wrapping", () => {
    const { out, t } = frame("border-padding", 20, 10);
    expect(out).toBe(
      dedent(`
				┌─ T ──────┐
				│ a long   │
				│ line of  │
				│ text     │
				│ that     │
				│ wraps    │
				└──────────┘`),
    );
    t.unmount();
  });

  test("box backgrounds are painted and inherited by text", () => {
    const { t } = frame("row-grow");
    const screen = t.screen();
    const blue = parseColor("blue");
    expect(screen.styleAt(2, 0).bg).toBe(blue!); // "m" of "mid"
    expect(screen.styleAt(10, 0).bg).toBe(blue!); // empty space in the growing box
    expect(screen.styleAt(0, 0).bg).toBe(DEFAULT_COLOR);
    t.unmount();
  });

  test("inline text styles", () => {
    const { t } = frame("inline-styles");
    const screen = t.screen();
    expect(screen.styleAt(0, 0).bold).toBe(false);
    expect(screen.styleAt(6, 0).bold).toBe(true);
    expect(screen.styleAt(6, 0).fg).toBe(parseColor("red")!);
    expect(screen.styleAt(11, 0).underline).toBe(true);
    t.unmount();
  });

  test("records element geometry", () => {
    const { t } = frame("absolute");
    const overlay = [...t.app.root.descendants()].find(
      (el) => el.attributes.get("border") === "ascii",
    )!;
    expect(overlay.layout).toMatchObject({ x: 2, y: 1, width: 5, height: 3 });
    t.unmount();
  });

  test("re-layouts on resize", () => {
    const { t } = frame("justify-between", 20);
    t.resize(10, 3);
    expect(t.frame()).toBe("L    M   R");
    t.unmount();
  });
});
