/**
 * The layout pass keeps laid out text (and parsed styles) between frames.
 * These make sure a change that keeps the same text still shows up.
 */
import { describe, expect, test } from "bun:test";
import { renderTest } from "../src/lib/testing/index.ts";
import { parseColor } from "../src/lib/renderer/style.ts";
import Cached from "./fixtures/Cached.svelte";

const setup = () => renderTest(Cached, { width: 40, height: 10 });

function style_at(t: ReturnType<typeof setup>, text: string) {
  const at = t.find(text)!;
  const screen = t.screen();
  const i = at.y * screen.width + at.x;
  return { fg: screen.fg[i], bold: (screen.attrs[i] & 1) !== 0 };
}

describe("text kept between frames", () => {
  test("a color change on unchanged text is painted", () => {
    const t = setup();
    expect(style_at(t, "the quick").fg).toBe(parseColor("red")!);
    t.press("c");
    expect(style_at(t, "the quick").fg).toBe(parseColor("blue")!);
    t.press("c");
    expect(style_at(t, "the quick").fg).toBe(parseColor("red")!);
    t.unmount();
  });

  test("a nested style change is painted", () => {
    const t = setup();
    expect(style_at(t, "nested").bold).toBe(false);
    t.press("b");
    expect(style_at(t, "nested").bold).toBe(true);
    expect(style_at(t, "plain").bold).toBe(false);
    t.unmount();
  });

  test("wrap mode and width changes re-wrap the same text", () => {
    const t = setup();
    expect(t.frame()).toContain("the quick brown fox jumps");
    t.press("n"); // 12 columns
    expect(t.frame()).toContain("the quick\nbrown fox\njumps");
    t.press("w"); // truncate
    expect(t.frame().split("\n")[0]).toBe("the quick b…");
    t.press("n", "w"); // back to 30 columns, wrapping
    expect(t.frame()).toContain("the quick brown fox jumps");
    t.unmount();
  });

  test("fill toggles without leaving dots behind in the shared lines", () => {
    const t = setup();
    t.press("f");
    expect(t.frame()).toContain("dots" + ".".repeat(26));
    t.press("f");
    expect(t.frame()).not.toContain("dots.");
    t.press("f");
    expect(t.frame()).toContain("dots" + ".".repeat(26)); // not 52 dots
    expect(t.frame()).not.toContain(".".repeat(27));
    t.unmount();
  });

  test("anonymous text blocks update", () => {
    const t = setup();
    expect(t.frame()).toContain("loose text");
    t.press("l");
    expect(t.frame()).toContain("other words");
    expect(t.frame()).not.toContain("loose text");
    t.unmount();
  });
});
