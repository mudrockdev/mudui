import { expect, test } from "bun:test";
import { renderTest } from "../../../src/lib/testing/index.ts";
import Thrower from "./Thrower.svelte";

test("an error in an event handler fails the test", () => {
  const t = renderTest(Thrower, { width: 20, height: 3 });
  expect(() => t.press("Enter")).toThrow("boom");
});

test("a later test still runs", () => {
  expect(1).toBe(1);
});
