import { describe, expect, test } from "bun:test";
import { InputParser, keySequence } from "../src/lib/runtime/input.ts";
import { KeyEvent } from "../src/lib/runtime/events.ts";

const parse = (data: string) => new InputParser().feed(data);
const keys = (data: string) =>
  parse(data).map((e) => {
    if (e.kind !== "key") return e.kind;
    const mods = ["ctrl", "alt", "shift"].filter((m) => (e as any)[m]);
    return [...mods, e.key].join("+");
  });

describe("input parser", () => {
  test("printable characters and graphemes", () => {
    expect(keys("aB日👍🏽")).toEqual(["a", "shift+B", "日", "👍🏽"]);
  });

  test("control keys", () => {
    expect(keys("\r\t\x7f\x03\x1b")).toEqual([
      "Enter",
      "Tab",
      "Backspace",
      "ctrl+c",
      "Escape",
    ]);
  });

  test("escape sequences", () => {
    expect(keys("\x1b[A\x1b[B\x1b[C\x1b[D")).toEqual([
      "ArrowUp",
      "ArrowDown",
      "ArrowRight",
      "ArrowLeft",
    ]);
    expect(
      keys("\x1b[1;5C\x1b[1;2A\x1b[Z\x1b[3~\x1b[5~\x1bOP\x1b[15~"),
    ).toEqual([
      "ctrl+ArrowRight",
      "shift+ArrowUp",
      "shift+Tab",
      "Delete",
      "PageUp",
      "F1",
      "F5",
    ]);
    expect(keys("\x1bx")).toEqual(["alt+x"]);
  });

  test("mouse events", () => {
    expect(parse("\x1b[<0;5;3M\x1b[<0;5;3m\x1b[<65;1;1M")).toEqual([
      {
        kind: "mouse",
        x: 4,
        y: 2,
        button: "left",
        action: "press",
        shift: false,
        alt: false,
        ctrl: false,
      },
      {
        kind: "mouse",
        x: 4,
        y: 2,
        button: "left",
        action: "release",
        shift: false,
        alt: false,
        ctrl: false,
      },
      {
        kind: "mouse",
        x: 0,
        y: 0,
        button: "none",
        action: "wheeldown",
        shift: false,
        alt: false,
        ctrl: false,
      },
    ]);
  });

  test("bracketed paste, across chunks", () => {
    const parser = new InputParser();
    expect(parser.feed("\x1b[200~hello ")).toEqual([]);
    expect(parser.feed("world\x1b[201~x")).toEqual([
      { kind: "paste", text: "hello world" },
      expect.objectContaining({ kind: "key", key: "x" }),
    ]);
  });

  test("keySequence round-trips through the parser", () => {
    for (const description of [
      "Enter",
      "shift+Tab",
      "ctrl+c",
      "alt+x",
      "ArrowUp",
      "ctrl+ArrowLeft",
      "F5",
      "q",
      "G",
      "Delete",
    ]) {
      const [event] = parse(keySequence(description));
      expect(event.kind).toBe("key");
      expect(new KeyEvent("keydown", event as any).is(description)).toBe(true);
    }
  });

  test("KeyEvent.is matches modifiers exactly", () => {
    const [ctrl_s] = parse("\x13");
    const event = new KeyEvent("keydown", ctrl_s as any);
    expect(event.is("ctrl+s")).toBe(true);
    expect(event.is("s")).toBe(false);
    const [upper] = parse("G");
    expect(new KeyEvent("keydown", upper as any).is("g")).toBe(false);
    expect(new KeyEvent("keydown", upper as any).is("shift+g")).toBe(true);
  });
});
