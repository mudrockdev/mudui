/**
 * Bugs found by using the components in a real app (examples/taskboard), so
 * they stay fixed.
 */
import { describe, expect, test } from "bun:test";
import { NodeTerminal, render, toastStore } from "../src/lib/index.ts";
import Counter from "./fixtures/Counter.svelte";
import { renderTest } from "../src/lib/testing/index.ts";
import Growing from "./fixtures/Growing.svelte";

const grow = (which: string, width: number, height: number, count = 30) =>
  renderTest(Growing, { width, height, props: { which, count } });

const lines = (frame: string) => frame.split("\n");

describe("components that grow into a sized parent", () => {
  test("LogView keeps the newest line visible after the terminal shrinks", () => {
    const t = grow("log", 40, 20);
    t.resize(40, 10);
    const frame = t.frame();
    expect(frame).toEqual(grow("log", 40, 10).frame());
    expect(frame).toContain("line 29");
    expect(lines(frame).at(-1)).toBe("footer");
    t.unmount();
  });

  test("Tree with grow fills the space instead of 10 rows, and fits after a shrink", () => {
    const t = grow("tree", 40, 20);
    expect(t.frame()).toContain("node 16"); // 18 rows between header and footer
    expect(lines(t.frame()).at(-1)).toBe("footer");
    t.resize(40, 8);
    expect(t.frame()).toEqual(grow("tree", 40, 8).frame());
    expect(lines(t.frame()).at(-1)).toBe("footer");
    t.unmount();
  });

  test("Select with grow scrolls inside the space and keeps the footer on screen", () => {
    const t = grow("select", 40, 8);
    expect(lines(t.frame()).at(-1)).toBe("footer");
    t.press("End");
    expect(t.frame()).toContain("item 29");
    expect(lines(t.frame()).at(-1)).toBe("footer");
    t.unmount();
  });

  test("ScrollView scrolls a focused element into view", () => {
    const t = grow("scroll", 40, 6, 10); // 4 rows for 10 buttons
    for (let i = 0; i < 8; i++) t.press("Tab");
    expect(t.frame()).toContain("item 7");
    expect(t.frame()).not.toContain("item 0");
    t.press("shift+Tab", "shift+Tab", "shift+Tab", "shift+Tab", "shift+Tab");
    expect(t.frame()).toContain("item 2");
    t.unmount();
  });

  test("ScrollView maxHeight: as tall as the content, at most maxHeight", () => {
    expect(lines(grow("maxheight", 30, 20, 3).frame())).toEqual([
      "header",
      "item 0",
      "item 1",
      "item 2",
      "footer",
    ]);
    const t = grow("maxheight", 30, 20, 30);
    expect(lines(t.frame())[6]).toBe("footer"); // header + 5 rows
    t.unmount();
  });
});

describe("squeezed rows", () => {
  test("badges, buttons and slider labels keep their text; the track and plain text give way", () => {
    const t = grow("squeeze", 40, 4);
    const row = lines(t.frame())[1];
    expect(row).toContain(" badge ");
    expect(row).toContain("[ Save ]");
    expect(row).toContain("Volume");
    expect(lines(t.frame())[2]).not.toBe("footer"); // the long text wrapped
    t.resize(30, 6);
    expect(t.frame()).toEqual(grow("squeeze", 30, 6).frame());
    t.unmount();
  });
});

describe("Toaster", () => {
  test("only shows the newest toasts that fit, so the first row stays visible", () => {
    const t = grow("toasts", 50, 10);
    const toasts = toastStore(t.app);
    for (let i = 1; i <= 5; i++) toasts.show(`message ${i}`, { duration: 0 });
    const frame = t.frame();
    expect(lines(frame)[0]).toBe("header");
    expect(frame).toContain("message 5");
    expect(frame).not.toContain("message 1");
    t.resize(50, 30); // more room: more toasts
    expect(t.frame()).toContain("message 1");
    t.unmount();
  });
});

describe("the terminal going away (window closed, ssh dropped)", () => {
  // a tty whose writes fail with EIO once it's closed, like a deleted pty
  function dead_tty() {
    const { PassThrough } = require("node:stream") as typeof import("node:stream");
    const stdin = Object.assign(new PassThrough(), {
      isTTY: true,
      isRaw: false,
      setRawMode(this: { isRaw: boolean }, raw: boolean) {
        if (closed) throw new Error("setRawMode failed with errno: 5");
        this.isRaw = raw;
        return this;
      },
    });
    let closed = false;
    const stdout = Object.assign(new PassThrough(), {
      isTTY: true,
      columns: 40,
      rows: 10,
    });
    stdout.resume();
    const write = stdout.write.bind(stdout);
    stdout.write = ((chunk: string) => {
      if (closed) throw Object.assign(new Error("EIO: i/o error, write"), { code: "EIO" });
      return write(chunk);
    }) as typeof stdout.write;
    return {
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: stdout as unknown as NodeJS.WriteStream,
      close() {
        closed = true;
        stdin.end();
      },
    };
  }

  test("closed input exits the app, and waitUntilExit settles despite EIO", async () => {
    const tty = dead_tty();
    const app = render(Counter, {
      terminal: new NodeTerminal(tty),
      handleErrors: false,
    });
    const exited = app.waitUntilExit();
    tty.close();
    await exited; // used to throw from restore() and never resolve
    expect(app.exited).toBe(true);
    expect(tty.stdin.isPaused()).toBe(true);
  });

  test("SIGHUP after the tty is gone still exits cleanly", async () => {
    const tty = dead_tty();
    const app = render(Counter, {
      terminal: new NodeTerminal(tty),
      handleErrors: false,
    });
    const exited = app.waitUntilExit();
    tty.close();
    process.emit("SIGHUP", "SIGHUP");
    await exited;
    expect(app.exited).toBe(true);
  });
});
