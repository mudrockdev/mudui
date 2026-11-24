import { describe, expect, test } from "bun:test";
import { normalizeWhitespace } from "../src/lib/bun/plugin.ts";
import { renderTest } from "../src/lib/testing/index.ts";
import Formatted from "./fixtures/Formatted.svelte";

describe("template whitespace", () => {
  test("line breaks in template text become spaces", () => {
    expect(normalizeWhitespace("<txt>{a}\n    {b}</txt>")).toBe(
      "<txt>{a} {b}</txt>",
    );
    expect(normalizeWhitespace("<txt>a  \n\t b</txt>")).toBe("<txt>a b</txt>");
  });

  test("leaves attributes, expressions, scripts and plain spaces alone", () => {
    const source =
      '<script>\nlet x = "a\\n b";\n</script>\n<txt title="a\n b">{"x\\ny"}  {x}</txt>';
    const out = normalizeWhitespace(source);
    expect(out).toContain('<script>\nlet x = "a\\n b";\n</script>');
    expect(out).toContain('title="a\n b"');
    expect(out).toContain('{"x\\ny"}  {x}');
  });

  test("formatter-wrapped components render like their one-line versions", () => {
    const t = renderTest(Formatted, { width: 40, height: 6 });
    expect(t.frame()).toBe(
      [
        "[ Open ]",
        "Leading and trailing whitespace",
        "one two three",
        "dynamic",
        "line breaks stay",
      ].join("\n"),
    );
    t.unmount();
  });
});
