import { describe, expect, test } from "bun:test";
import { renderTest } from "../../../src/lib/testing/index.ts";
import Display from "./Display.svelte";

const render = (variant: string, p: any, width = 20, height = 1) => {
  const t = renderTest(Display, { width, height, props: { variant, p } });
  const out = t.frame();
  t.unmount();
  return out;
};

describe("probe: display components", () => {
  test("ProgressBar with value NaN renders an empty bar, not 'undefined'/'NaN%'", () => {
    const out = render("progress", { value: NaN, showPercent: true });
    expect(out).not.toContain("undefined");
    expect(out).not.toContain("NaN");
    expect(out).toBe(render("progress", { value: 0, showPercent: true }));
  });

  test("ProgressBar with a label: shrinking the terminal matches a fresh render", () => {
    const p = { value: 0.5, label: "Label", showPercent: true };
    const t = renderTest(Display, { width: 60, height: 3, props: { variant: "progress", p } });
    t.frame();
    t.resize(25, 3);
    t.frame();
    t.resize(12, 3);
    const got = t.frame();
    t.unmount();
    // fresh: "Label ▌  50%"; after shrinking: "Labe █░  50%\nl"
    expect(got).toBe(render("progress", p, 12, 3));
  });

  test.failing("Sparkline with a NaN sample still draws the other samples", () => {
    const out = render("spark", { data: [1, NaN, 3] });
    expect(out.length).toBeGreaterThan(0);
    expect(out).toContain("█");
  });

  test.failing("Sparkline with width={0} draws nothing", () => {
    expect(render("spark", { data: [1, 2, 3], width: 0 })).toBe("");
  });
});
