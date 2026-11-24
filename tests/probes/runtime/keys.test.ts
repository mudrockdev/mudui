import { expect, test } from "bun:test";
import { InputParser } from "../../../src/lib/runtime/input.ts";
import { renderTest } from "../../../src/lib/testing/index.ts";
import Keys from "./Keys.svelte";

test.failing("a mouse sequence split across two reads is parsed as one mouse event", () => {
  const parser = new InputParser();
  const events = [...parser.feed("\x1b[<0;12"), ...parser.feed(";5M")];
  // actual: alt+[ followed by the keys < 0 ; 1 2 ; 5 M
  expect(events.map((e) => e.kind)).toEqual(["mouse"]);
});

test.failing("a split mouse sequence does not type garbage into a focused TextInput", () => {
  const t = renderTest(Keys, { width: 60, height: 6, props: { mode: "input" } });
  t.input("\x1b[<0;12");
  t.input(";5M");
  t.input("\x1b[<0;12;5m");
  expect(t.frame().split("\n")[0]).toMatch(/text:$/); // actual: "text:<0;12;5M"
  t.unmount();
});

test.failing("space toggling a focused Checkbox does not also reach global handlers (Switch doesn't)", () => {
  const t = renderTest(Keys, { width: 60, height: 6, props: { mode: "checkbox" } });
  t.press("space");
  const f = t.frame();
  expect(f).toContain("checked:true");
  expect(f).toContain("global: "); // actual: "global:S"
  t.unmount();
});

test.failing("Enter pressing a focused Button does not also reach global handlers", () => {
  const t = renderTest(Keys, { width: 60, height: 6, props: { mode: "button" } });
  t.press("Enter");
  expect(t.frame()).toContain("global: "); // actual: "global:E"
  t.unmount();
});

test.failing("wheel over a Slider inside a ScrollView changes the slider without also scrolling", () => {
  const t = renderTest(Keys, { width: 60, height: 6, props: { mode: "scroll" } });
  const pos = t.find("●")!;
  t.wheel(pos.x, pos.y, "down");
  expect(t.frame()).toContain("v:49");
  // actual: the ScrollView scrolled by 2 too, so the slider is no longer visible
  expect(t.find("●") ?? t.find("◆")).not.toBeNull();
  t.unmount();
});
