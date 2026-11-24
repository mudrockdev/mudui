import { describe, expect, test } from "bun:test";
import { fuzzyMatch, highlight } from "../src/lib/fuzzy.ts";
import { renderTest } from "../src/lib/testing/index.ts";
import Kit from "./fixtures/Kit.svelte";

const kit = (
  show: string,
  width = 50,
  height = 12,
  props: Record<string, unknown> = {},
) => renderTest(Kit, { width, height, props: { show, ...props } });

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("TextArea", () => {
  test("multi-line editing", () => {
    const t = kit("textarea", 70);
    t.type("one");
    t.press("Enter");
    t.type("two");
    t.press("Enter");
    t.type("three");
    expect(t.frame()).toContain('value: "one\\ntwo\\nthree"');

    // up keeps the column, backspace at line start merges lines
    t.press("ArrowUp", "Home", "Backspace");
    expect(t.frame()).toContain('value: "onetwo\\nthree"');
    t.press("End", "Delete");
    expect(t.frame()).toContain('value: "onetwothree"');
    t.press("ctrl+a", "ctrl+k");
    expect(t.frame()).toContain('value: ""');

    t.paste("a\nb");
    t.press("ctrl+s");
    expect(t.frame()).toContain('submitted: "a\\nb"');
    t.unmount();
  });

  test("scrolls vertically and shows line numbers", () => {
    const t = kit("textarea", 70);
    for (const word of ["l1", "l2", "l3", "l4"]) {
      t.type(word);
      if (word !== "l4") t.press("Enter");
    }
    const rows = t.frame().split("\n").slice(0, 3);
    expect(rows).toEqual(["2 l2", "3 l3", "4 l4"]);
    t.press("ctrl+Home");
    expect(t.frame().split("\n")[0]).toBe("1 l1");
    t.unmount();
  });

  test("scrolls horizontally on long lines", () => {
    const t = kit("textarea", 70);
    t.type("abcdefghijklmnop");
    // 10 text columns: 9 characters, plus the cursor cell at the end
    expect(t.frame().split("\n")[0]).toBe("1 hijklmnop");
    t.press("Home");
    expect(t.frame().split("\n")[0]).toBe("1 abcdefghij");
    t.unmount();
  });
});

describe("Switch", () => {
  test("toggles with keys and clicks", () => {
    const t = kit("switch");
    expect(t.frame()).toContain("●━━ off Wi-Fi");
    t.press(" ");
    expect(t.frame()).toContain("━━● on  Wi-Fi");
    t.press("ArrowLeft");
    expect(t.frame()).toContain("on: false");
    t.clickText("Wi-Fi");
    expect(t.frame()).toContain("on: true");
    t.unmount();
  });
});

describe("RadioGroup", () => {
  test("arrows select, skipping disabled items and wrapping", () => {
    const t = kit("radio");
    expect(t.frame()).toContain("(●) Medium");
    t.press("ArrowDown");
    expect(t.frame()).toContain("size: h");
    t.press("ArrowDown");
    expect(t.frame()).toContain("size: s");
    t.clickText("Huge");
    expect(t.frame()).toContain("(●) Huge");
    t.clickText("Large");
    expect(t.frame()).toContain("size: h");
    t.unmount();
  });
});

describe("MultiSelect", () => {
  test("space toggles, a toggles all enabled items", () => {
    const t = kit("multi");
    t.press(" ", "ArrowDown", " ");
    expect(t.frame()).toContain("toppings: cheese,olives");
    t.press("ArrowDown", " "); // disabled
    expect(t.frame()).toContain("toppings: cheese,olives");
    t.press("a");
    expect(t.frame()).toContain("toppings: cheese,olives,basil");
    t.press("a");
    expect(t.frame().endsWith("toppings:")).toBe(true);
    t.clickText("basil");
    expect(t.frame()).toContain("[x] basil");
    t.unmount();
  });
});

describe("Slider", () => {
  test("keys, clicks and the wheel change the value in steps", () => {
    const t = kit("slider");
    t.press("ArrowRight", "ArrowRight");
    expect(t.frame()).toContain("volume: 60");
    t.press("PageDown");
    expect(t.frame()).toContain("volume: 10");
    t.press("End");
    expect(t.frame()).toContain("volume: 100");
    t.press("Home");
    expect(t.frame()).toContain("volume: 0");
    // the track starts after "Vol " (x = 4)
    t.click(4, 0);
    expect(t.frame()).toContain("volume: 0");
    t.wheel(10, 0, "up");
    expect(t.frame()).toContain("volume: 5");
    t.unmount();
  });
});

describe("Collapsible", () => {
  test("shows content when open", () => {
    const t = kit("collapsible");
    expect(t.frame()).not.toContain("hidden content");
    t.press("Enter");
    expect(t.frame()).toContain("▾ Details\n  hidden content");
    t.press("ArrowLeft");
    expect(t.frame()).toContain("open: false");
    t.unmount();
  });
});

describe("Combobox", () => {
  test("filters with fuzzy matching and chooses with Enter", () => {
    const t = kit("combobox");
    t.type("bry");
    const frame = t.frame();
    expect(frame).toContain("❯ blueberry");
    expect(frame).not.toContain("apple");
    t.press("Enter");
    expect(t.frame()).toContain("picked: blueberry");
    t.unmount();
  });

  test("arrows move the highlight; Escape clears the query", () => {
    const t = kit("combobox");
    t.type("ap");
    t.press("ArrowDown", "Enter");
    expect(t.frame()).toContain("picked: apricot");
    t.press("Escape");
    expect(t.frame()).toContain("Search…");
    t.type("zzz");
    expect(t.frame()).toContain("No matches");
    t.unmount();
  });
});

describe("CommandPalette", () => {
  test("runs the chosen command and closes", () => {
    const t = kit("palette", 60, 14);
    t.press("ctrl+k");
    expect(t.frame()).toContain("File: Open file");
    expect(t.frame()).toContain("ctrl+o");
    t.type("theme");
    t.press("Enter");
    expect(t.frame()).toContain("ran: theme");
    expect(t.frame()).not.toContain("Commands");
    t.press("ctrl+k", "Escape");
    expect(t.frame()).not.toContain("Commands");
    t.unmount();
  });
});

describe("Tree", () => {
  test("expands, collapses and navigates", () => {
    const t = kit("tree", 70);
    t.press("ArrowRight");
    expect(t.frame()).toContain("▾ src");
    expect(t.frame()).toContain("├─ ▸ lib");
    expect(t.frame()).toContain("└─   app.ts");
    t.press("ArrowRight", "ArrowRight", "ArrowRight");
    expect(t.frame()).toContain("│  └─   index.ts");
    expect(t.frame()).toContain("selected: index");
    t.press("ArrowLeft");
    expect(t.frame()).toContain("selected: lib");
    t.press("ArrowLeft");
    expect(t.frame()).toContain("expanded: src chosen");
    t.press("End", "Enter");
    expect(t.frame()).toContain("chosen: README.md");
    t.unmount();
  });
});

describe("LogView", () => {
  test("only renders visible lines, follows the end, and scrolls back", () => {
    const t = kit("log", 30, 6, { logLines: 1000 });
    const lines = () =>
      t
        .frame()
        .split("\n")
        .map((l) => l.replace(/[│┃]/g, "").trim());
    expect(lines()).toEqual(["line 997", "line 998", "line 999"]);
    const rendered = [...t.app.root.descendants()].filter(
      (el) => el.name === "txt" && el.textContent.startsWith("line"),
    );
    expect(rendered).toHaveLength(3);
    t.press("Tab", "g");
    expect(lines()[0]).toBe("line 0");
    t.unmount();
  });
});

describe("charts", () => {
  test("sparkline and bar chart", () => {
    const t = kit("charts", 40);
    const [spark, padded, cpu, memory, io] = t.frame().split("\n");
    expect(spark).toBe("▁▂▃▄▅▆▇█");
    expect(padded).toBe("   ▅▅▅▁█");
    expect(cpu).toBe("cpu    ██████████████▌                50");
    expect(memory).toBe("memory █████████████████████████████ 100");
    expect(io.replace(/\s+/g, " ")).toBe("io 0");
    t.unmount();
  });
});

describe("toasts", () => {
  test("show, stack and dismiss on click", () => {
    const t = kit("toast");
    t.press("ctrl+t", "ctrl+y");
    let frame = t.frame();
    expect(frame).toContain("✓ Saved!");
    expect(frame).toContain("✗ Upload");
    expect(frame).toContain("Failed");
    t.clickText("Saved!");
    frame = t.frame();
    expect(frame).not.toContain("Saved!");
    expect(frame).toContain("Upload");
    t.unmount();
  });
});

describe("dialogs", () => {
  test("confirm resolves with the choice", async () => {
    const t = kit("dialog");
    t.press("ctrl+o");
    expect(t.frame()).toContain("Delete it?");
    t.press("Enter");
    await tick();
    expect(t.frame()).toContain("answer: confirm:true");
    expect(t.frame()).not.toContain("Delete it?");

    t.press("ctrl+o", "Escape");
    await tick();
    expect(t.frame()).toContain("answer: confirm:false");
    t.unmount();
  });

  test("prompt resolves with the input, or null", async () => {
    const t = kit("dialog");
    t.press("ctrl+p");
    expect(t.frame()).toContain("Your name?");
    t.type("ex");
    t.press("Enter");
    await tick();
    expect(t.frame()).toContain("answer: prompt:Alex");

    t.press("ctrl+p", "Escape");
    await tick();
    expect(t.frame()).toContain("answer: prompt:null");
    t.unmount();
  });
});

describe("fuzzyMatch", () => {
  test("matches subsequences and prefers contiguous and word-start matches", () => {
    expect(fuzzyMatch("bry", "blueberry")).not.toBeNull();
    expect(fuzzyMatch("xyz", "blueberry")).toBeNull();
    expect(fuzzyMatch("save", "File: Save")!.score).toBeGreaterThan(
      fuzzyMatch("save", "s-a-v-e")!.score,
    );
    expect(fuzzyMatch("fs", "File: Save")!.score).toBeGreaterThan(
      fuzzyMatch("fs", "fixes")!.score,
    );
    expect(highlight("apple", fuzzyMatch("pl", "apple")!.positions)).toEqual([
      { text: "ap", match: false },
      { text: "pl", match: true },
      { text: "e", match: false },
    ]);
  });
});
