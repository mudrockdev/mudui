import { describe, expect, test } from "bun:test";
import { Screen, sgr } from "../src/lib/renderer/screen.ts";
import { parseColor } from "../src/lib/renderer/style.ts";
import { renderTest } from "../src/lib/testing/index.ts";
import { Emulator } from "./helpers.ts";
import Counter from "./fixtures/Counter.svelte";

const all = { x: 0, y: 0, width: 100, height: 100 };

function write(screen: Screen, x: number, y: number, text: string, style = {}) {
  for (const ch of text) screen.put(x++, y, ch, 1, style, all);
}

describe("screen", () => {
  test("diff only redraws changed cells", () => {
    const a = new Screen(10, 2);
    write(a, 0, 0, "hello");
    const b = new Screen(10, 2);
    write(b, 0, 0, "help!");
    const out = b.diff(a);
    expect(out).toContain("\x1b[1;4H");
    expect(out).toContain("p!");
    expect(out).not.toContain("hel");
    expect(b.diff(b)).toBe("");
  });

  test("diff output reproduces the screen in an emulator", () => {
    const emulator = new Emulator(12, 3);
    let previous: Screen | null = null;
    for (const lines of [
      ["abc", "日本"],
      ["abX", " 本語"],
      ["", "x"],
    ]) {
      const screen = new Screen(12, 3);
      lines.forEach((line, y) => {
        let x = 0;
        for (const ch of line) {
          const w = /[　-鿿]/.test(ch) ? 2 : 1;
          screen.put(x, y, ch, w, {}, all);
          x += w;
        }
      });
      emulator.write(screen.diff(previous));
      expect(emulator.toString()).toBe(screen.toString());
      previous = screen;
    }
  });

  test("wide characters overwritten by narrow ones are cleaned up", () => {
    const screen = new Screen(4, 1);
    screen.put(0, 0, "日", 2, {}, all);
    screen.put(1, 0, "x", 1, {}, all);
    expect(screen.toString()).toBe(" x");
  });

  test("sgr sequences and color downgrading", () => {
    const orange = parseColor("#ff8800")!;
    expect(sgr(parseColor("red")!, -1, 1)).toBe("\x1b[0;1;31m");
    expect(sgr(parseColor("brightBlue")!, parseColor("green")!, 0)).toBe(
      "\x1b[0;94;42m",
    );
    expect(sgr(orange, -1, 0)).toBe("\x1b[0;38;2;255;136;0m");
    expect(sgr(orange, -1, 0, "256")).toBe("\x1b[0;38;5;214m");
    expect(sgr(orange, -1, 0, "none")).toBe("\x1b[0m");
  });

  test("a running app writes frames that an emulator can display", () => {
    const t = renderTest(Counter, { width: 30, height: 8 });
    const emulator = new Emulator(30, 8);
    emulator.write(t.terminal.output);
    expect(emulator.toString()).toBe(t.frame());
    t.terminal.output = "";

    t.press("+", "+", "r");
    emulator.write(t.terminal.output);
    expect(emulator.toString()).toBe(t.frame());
    expect(emulator.toString()).toContain("two or more");
    t.unmount();
  });
});
