import { describe, expect, test } from "bun:test";
import { renderTest } from "../../../src/lib/testing/index.ts";
import TI from "./TI.svelte";
import { s, reset } from "./state.svelte.ts";

describe("TextInput", () => {
  test.failing("text longer than maxLength (set from outside) can still be deleted", () => {
    reset({ value: "abcdef" });
    const t = renderTest(TI, { width: 20, height: 3, props: { maxLength: 3 } });
    t.frame();
    t.press("Backspace");
    const value = s.value;
    t.unmount();
    expect(value).toBe("abcde"); // actual: "abcdef" — the edit is rejected because 5 > maxLength
  });

  test.failing("pasting a tab doesn't glue the surrounding words together", () => {
    reset({ value: "" });
    const t = renderTest(TI, { width: 20, height: 3, props: {} });
    t.paste("foo\tbar");
    const value = s.value;
    t.unmount();
    // newlines become spaces; tabs are silently dropped
    expect(value).not.toBe("foobar");
  });
});
