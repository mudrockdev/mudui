import { describe, expect, test } from "bun:test";
import { renderTest } from "../../../src/lib/testing/index.ts";
import PSelect from "./PSelect.svelte";
import PSelectDisabled from "./PSelectDisabled.svelte";
import PMulti from "./PMulti.svelte";
import PTabs from "./PTabs.svelte";
import PTable from "./PTable.svelte";
import PScroll from "./PScroll.svelte";
import PLog from "./PLog.svelte";

const mk = (C: any, init: any, w = 30, h = 8) => {
  const ctl: any = {};
  const t = renderTest(C, { width: w, height: h, props: { init, ctl } });
  return { t, s: ctl.s };
};
const lines = (frame: string) =>
  frame.split("\n").map((l) => l.replace(/[│┃]/g, "").trim());

describe("ScrollView", () => {
  test("grow inside a sized parent gives a scrollable viewport", () => {
    // root <box height="100%"> at 30x8: header, ScrollView grow (20 lines), footer
    const { t } = mk(PScroll, { grow: 1, count: 20 }, 30, 8);
    expect(t.frame()).toContain("footer"); // viewport = 6 rows, footer stays visible
    expect(t.frame()).toContain("┃"); // a scrollbar
    t.press("Tab", "ArrowDown");
    expect(lines(t.frame())[1]).toBe("line 1");
    t.unmount();
  });
});

describe("Select", () => {
  const dis = (v: string) => ({ label: v, value: v, disabled: true });

  test("End moves to the last enabled item when the last item is disabled", () => {
    const { t } = mk(PSelect, { items: ["a", "b", "c", dis("d")] });
    t.press("End");
    expect(t.frame()).toContain("value: c");
    t.unmount();
  });

  test("Home moves to the first enabled item when the first item is disabled", () => {
    const { t } = mk(PSelect, { items: [dis("a"), "b", "c", "d"], value: "d" });
    t.press("Home");
    expect(t.frame()).toContain("value: b");
    t.unmount();
  });

  test("PageDown that lands past the last enabled item stops on it", () => {
    const { t } = mk(PSelect, { items: ["a", "b", "c", dis("d")], height: 4 });
    t.press("PageDown");
    expect(t.frame()).toContain("value: c");
    t.unmount();
  });

  test("a disabled Select ignores the wheel", () => {
    const t = renderTest(PSelectDisabled, { width: 30, height: 6 });
    t.wheel(2, 1, "down");
    expect(t.frame()).toContain("value: b");
    t.unmount();
  });
});

describe("MultiSelect", () => {
  test.failing("toggle-all (a) leaves disabled items' checked state alone", () => {
    const { t } = mk(PMulti, {
      items: ["a", { label: "b", value: "b", disabled: true }, "c"],
      value: ["b"],
    });
    t.press("a");
    expect(t.frame()).toContain("[x] b");
    t.press("a");
    expect(t.frame()).toContain("[x] b");
    t.unmount();
  });
});

describe("Tabs", () => {
  test("arrows skip a disabled tab", () => {
    const { t } = mk(
      PTabs,
      { items: ["A", { label: "B", value: "B", disabled: true }, "C"], value: "A" },
      40,
      3,
    );
    t.press("ArrowRight");
    expect(t.frame()).toContain("value: C");
    t.unmount();
  });

  test("without a value, the first enabled tab is selected", () => {
    const { t } = mk(PTabs, { items: [{ label: "A", value: "A", disabled: true }, "B"] }, 40, 3);
    expect(t.frame()).toContain("value: B");
    t.unmount();
  });

  test("a number key beyond the tab count does nothing", () => {
    const { t } = mk(PTabs, { items: ["A", "B"], value: "B" }, 30, 3);
    t.press("3");
    expect(t.frame()).toContain("value: B");
    t.unmount();
  });

  test("when the tabs overflow, the strip scrolls so the active tab is whole", () => {
    const { t } = mk(
      PTabs,
      { items: ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta"], value: "Zeta" },
      20,
      3,
    );
    expect(t.frame().split("\n")[0]).toBe("‹ Epsilon │ Zeta");
    t.press("1"); // back to the first tab: scrolls back, more tabs to the right
    const strip = t.frame().split("\n")[0];
    expect(strip.startsWith(" Alpha │ Beta")).toBe(true);
    expect(strip.endsWith("›")).toBe(true);
    t.unmount();
  });
});

describe("Table", () => {
  const columns = [
    { key: "name", title: "Name", grow: true },
    { key: "size", title: "Size", align: "right" },
  ];
  const rows = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ name: `file ${i}`, size: i }));

  test.failing("bound selected is clamped when rows shrink below it", () => {
    const { t, s } = mk(PTable, { columns, rows: rows(30), selected: 25, height: 5 }, 40, 12);
    t.frame();
    s.rows = rows(10);
    expect(t.frame()).toContain("▌file 9");
    expect(t.frame()).toContain("selected: 9");
    t.unmount();
  });

  test.failing("a newline in a cell keeps the row on one line", () => {
    const cols = [{ key: "a", title: "A" }, { key: "b", title: "B" }];
    const { t } = mk(PTable, { columns: cols, rows: [{ a: "ab\ncd", b: "end" }, { a: "xxxxx", b: "end" }] }, 30, 6);
    const f = t.frame().split("\n");
    expect(f[2]).toContain("end");
    expect(f[3]).toContain("xxxxx");
    t.unmount();
  });

  test.failing("a tab in a cell keeps columns aligned", () => {
    const cols = [{ key: "a", title: "A" }, { key: "b", title: "B" }];
    const { t } = mk(PTable, { columns: cols, rows: [{ a: "x\ty", b: "end" }, { a: "xxxx", b: "end" }] }, 30, 6);
    const f = t.frame().split("\n");
    expect(f[2].indexOf("end")).toBe(f[3].indexOf("end"));
    t.unmount();
  });
});

describe("LogView", () => {
  test.failing("a detached view does not follow new lines up to a stale offset after the log is cleared", () => {
    const { t, s } = mk(PLog, { height: 4, count: 50 }, 30, 8);
    t.press("Tab", "PageUp"); // detached, top = line 43
    expect(lines(t.frame())[1]).toBe("line 43");
    s.count = 0;
    t.frame();
    s.count = 30;
    const after_refill = lines(t.frame())[1]; // line 26
    s.count = 60;
    const top = lines(t.frame())[1];
    // either stays where it was (detached) or follows the end; currently stops at line 43
    expect([after_refill, "line 56"]).toContain(top);
    t.unmount();
  });
});
