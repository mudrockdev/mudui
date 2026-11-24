import { describe, expect, test } from "bun:test";
import { renderTest } from "../src/lib/testing/index.ts";
import Focus from "./fixtures/Focus.svelte";
import Form from "./fixtures/Form.svelte";

const form = (show: string, width = 40, height = 12) =>
  renderTest(Form, { width, height, props: { show } });

describe("focus", () => {
  test("Tab and shift+Tab cycle through focusable elements, skipping disabled ones", () => {
    const t = renderTest(Focus, { width: 40, height: 5 });
    expect(t.focused()).toBeNull();
    t.press("Tab", "Enter");
    expect(t.frame()).toContain("pressed: one");
    t.press("Tab", "Tab", " ");
    expect(t.frame()).toContain("pressed: three");
    t.press("Tab", "Enter"); // wraps around past the disabled button
    expect(t.frame()).toContain("pressed: one");
    t.press("shift+Tab", "Enter");
    expect(t.frame()).toContain("pressed: three");
    t.unmount();
  });

  test("clicking focuses and activates", () => {
    const t = renderTest(Focus, { width: 40, height: 5 });
    t.clickText("Two");
    expect(t.frame()).toContain("pressed: two");
    t.press("Enter");
    expect(t.frame()).toContain("pressed: two");
    t.clickText("Off");
    expect(t.frame()).toContain("pressed: two");
    t.unmount();
  });

  test("global key handlers, and focus is dropped when the element goes away", () => {
    const t = renderTest(Focus, { width: 40, height: 5 });
    t.press("g", "g");
    expect(t.frame()).toContain("global: gg");
    t.clickText("Three");
    expect(t.focused()).not.toBeNull();
    t.press("ctrl+t");
    expect(t.frame()).not.toContain("Three");
    expect(t.focused()).toBeNull();
    t.unmount();
  });

  test("ctrl+c exits", () => {
    const t = renderTest(Focus, { width: 40, height: 5 });
    t.press("ctrl+c");
    expect(t.app.exited).toBe(true);
  });
});

describe("TextInput", () => {
  test("typing, editing and submitting", () => {
    const t = form("input", 60);
    expect(t.frame()).toContain("type here");
    t.type("hello");
    expect(t.frame()).toContain("value: [hello]");
    t.press("ArrowLeft", "ArrowLeft", "Backspace");
    t.type("L");
    expect(t.frame()).toContain("value: [heLlo]");
    t.press("Home", "Delete", "End");
    t.type("!");
    expect(t.frame()).toContain("value: [eLlo!]");
    t.press("ctrl+w");
    expect(t.frame()).toContain("value: []");
    t.paste("pasted\ntext");
    t.press("Enter");
    expect(t.frame()).toContain("submitted: [pasted text]");
    t.unmount();
  });

  test("scrolls horizontally to keep the cursor visible", () => {
    const t = form("input");
    t.type("abcdefghijklmnopqrstuvwxyz");
    const first = t.frame().split("\n")[0];
    expect(first.trim()).toBe("pqrstuvwxyz");
    t.press("Home");
    expect(t.frame().split("\n")[0].trim()).toBe("abcdefghijkl");
    t.unmount();
  });

  test("the cursor is drawn inverted", () => {
    const t = form("input");
    t.type("ab");
    t.press("ArrowLeft");
    const screen = t.screen();
    expect(screen.styleAt(1, 0).inverse).toBe(true);
    expect(screen.styleAt(0, 0).inverse).toBe(false);
    t.unmount();
  });
});

describe("Checkbox", () => {
  test("toggles with space, enter and click", () => {
    const t = form("checkbox");
    expect(t.frame()).toContain("[ ] Accept");
    t.press(" ");
    expect(t.frame()).toContain("[x] Accept");
    expect(t.frame()).toContain("checked: true");
    t.press("Enter");
    expect(t.frame()).toContain("checked: false");
    t.clickText("Accept");
    expect(t.frame()).toContain("checked: true");
    t.unmount();
  });
});

describe("Select", () => {
  test("arrow navigation skips disabled items and scrolls", () => {
    const t = form("select");
    expect(t.frame()).toContain("❯ apple");
    t.press("ArrowDown", "ArrowDown");
    expect(t.frame()).toContain("fruit: durian");
    expect(t.frame()).toContain("❯ durian");
    expect(t.frame()).not.toContain("apple"); // scrolled out of the 3-row window
    t.press("End");
    expect(t.frame()).toContain("fruit: elderberry");
    t.press("k", "Enter");
    expect(t.frame()).toContain("chosen: durian");
    t.unmount();
  });

  test("click chooses an item", () => {
    const t = form("select");
    t.clickText("banana");
    expect(t.frame()).toContain("fruit: banana chosen: banana");
    t.unmount();
  });
});

describe("Tabs", () => {
  test("switch with arrows, numbers and clicks", () => {
    const t = form("tabs");
    expect(t.frame()).toContain("tab: a");
    t.press("ArrowRight");
    expect(t.frame()).toContain("tab: b");
    t.press("3");
    expect(t.frame()).toContain("tab: c");
    t.press("ArrowRight");
    expect(t.frame()).toContain("tab: a");
    t.clickText("Beta");
    expect(t.frame()).toContain("tab: b");
    t.unmount();
  });
});

describe("ScrollView", () => {
  test("scrolls with keys and the wheel", () => {
    const t = form("scroll");
    t.press("Tab");
    const lines = () =>
      t
        .frame()
        .split("\n")
        .map((l) => l.replace(/[│┃]/g, "").trim());
    expect(lines()).toEqual(["line 0", "line 1", "line 2", "line 3"]);
    t.press("ArrowDown", "ArrowDown");
    expect(lines()[0]).toBe("line 2");
    t.press("End");
    expect(lines()).toEqual(["line 6", "line 7", "line 8", "line 9"]);
    t.wheel(1, 1, "up");
    expect(lines()[0]).toBe("line 4");
    t.press("Home");
    expect(lines()[0]).toBe("line 0");
    t.unmount();
  });

  test("shows a scrollbar", () => {
    const t = form("scroll");
    expect(t.frame()).toContain("┃");
    t.unmount();
  });
});

describe("Table", () => {
  test("renders columns and moves the selection", () => {
    const t = form("table", 40, 10);
    const frame = t.frame();
    expect(frame).toContain("Name     Size");
    expect(frame).toContain("item 0      0");
    t.press("PageDown", "ArrowDown");
    expect(t.frame()).toContain("row: 6");
    expect(t.frame()).toContain("item 6");
    expect(t.frame()).not.toContain("item 0 ");
    t.unmount();
  });
});

describe("Modal", () => {
  test("traps focus, closes with Escape and restores focus", () => {
    const t = form("modal", 40, 12);
    t.press("Enter");
    expect(t.frame()).toContain("Really?");
    expect(t.frame()).toContain("modal: true");

    // focus moved into the modal and cycles inside it
    const inside = new Set<unknown>();
    for (let i = 0; i < 4; i++) {
      t.press("Tab");
      inside.add(t.focused());
    }
    expect(inside.size).toBe(2);

    t.press("Escape");
    expect(t.frame()).toContain("modal: false");
    expect(t.frame()).not.toContain("Really?");

    // focus is back on the button that opened the modal
    t.press("Enter");
    expect(t.frame()).toContain("modal: true");
    t.unmount();
  });
});
