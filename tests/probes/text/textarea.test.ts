import { describe, expect, test } from "bun:test";
import { renderTest } from "../../../src/lib/testing/index.ts";
import TA from "./TA.svelte";
import { s, reset } from "./state.svelte.ts";

const mount = (value: string, props: any, w: number, h: number) => {
  reset({ value });
  const t = renderTest(TA, { width: w, height: h, props });
  t.frame();
  return t;
};

describe("TextArea scroll state", () => {
  test.failing("horizontal scroll goes back left when the width grows enough to fit the line", () => {
    const t = mount("abcdefghijklmnop", { width: "50%" }, 20, 3);
    t.press("End"); // 10 columns: scrolled to "hijklmnop"
    t.resize(60, 3); // 30 columns: the whole line fits
    const got = t.frame();
    t.unmount();

    const f = mount("abcdefghijklmnop", { width: "50%" }, 60, 3);
    f.press("End");
    const want = f.frame();
    f.unmount();

    expect(want.split("\n")[0]).toBe("abcdefghijklmnop");
    expect(got).toBe(want); // actual: "hijklmnop"
  });

  test.failing("moving to a shorter line doesn't scroll it out of view", () => {
    const t = mount("abcdefghijklmnop\nabc\nline3", { width: 10 }, 20, 3);
    t.press("End", "ArrowDown"); // cursor at end of "abc"
    const lines = t.frame().split("\n");
    t.unmount();
    // the cursor (column 3) fits without scrolling, so "abc" should be visible
    expect(lines[1]).toBe("abc"); // actual: "" (left offset 3 hides it)
    expect(lines[0]).toBe("abcdefghij"); // actual: "defghijklm"
  });

  test.failing("vertical scroll goes back up when the value gets shorter from outside", () => {
    const t = mount("1\n2\n3\n4\n5\n6", { width: 10, height: 3 }, 20, 4);
    t.press("ctrl+End"); // shows 4,5,6
    s.value = "a\nb\nc\nd"; // cursor clamps to the last line
    const got = t.frame();
    t.unmount();

    const f = mount("a\nb\nc\nd", { width: 10, height: 3 }, 20, 4);
    f.press("ctrl+End");
    const want = f.frame();
    f.unmount();

    expect(want).toBe("b\nc\nd");
    expect(got).toBe(want); // actual: "d" followed by two empty rows
  });

  test.failing("a wide character under the cursor at the right edge is scrolled into view", () => {
    const t = mount("abcdefghi中", { width: 10 }, 20, 3);
    for (let i = 0; i < 9; i++) t.press("ArrowRight"); // cursor on 中 at column 9
    const frame = t.frame();
    const pos = t.find("中");
    t.unmount();
    // 中 needs columns 9-10 but the box is 10 wide: it (and the cursor) gets clipped
    expect(frame).toContain("中"); // actual: "abcdefghi"
    expect(pos).not.toBeNull();
  });

  test.failing("a wide character cut by the left scroll edge doesn't shift the rest of its line", () => {
    // End on the first line scrolls left by 5; on line 2, 中 #3 spans columns 4-5 and is cut
    const t = mount("0123456789abcd\n中中中中中中中中\nABCDEFGHIJKLMNOP", { width: 10 }, 20, 4);
    t.press("End");
    const frame = t.frame();
    const han = t.find("中");
    const g = t.find("G");
    t.unmount();
    expect(frame.split("\n")[2].startsWith("FGHIJ")).toBe(true);
    // text column 6 is shown at screen column 1 (where "G" is), so the next 中 belongs there
    expect(g!.x).toBe(1);
    expect(han!.x).toBe(1); // actual: 0 — the whole line is drawn one column too far left
  });
});

describe("TextArea maxLength", () => {
  test.failing("text longer than maxLength (set from outside) can still be deleted", () => {
    const t = mount("abcdef", { maxLength: 3 }, 20, 3);
    t.press("End", "Backspace");
    const value = s.value;
    t.unmount();
    expect(value).toBe("abcde"); // actual: "abcdef" — every edit is rejected
  });
});
