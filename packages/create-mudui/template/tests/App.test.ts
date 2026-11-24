import { expect, test } from "bun:test";
import { renderTest } from "mudui/testing";
import App from "../src/App.svelte";

test("increments the counter", () => {
  const t = renderTest(App, { width: 40, height: 10 });
  expect(t.frame()).toContain("Count: 0");

  t.press("Enter");
  expect(t.frame()).toContain("Count: 1");

  t.press("q");
  expect(t.app.exited).toBe(true);
});
