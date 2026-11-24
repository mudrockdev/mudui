import { describe, expect, test } from "bun:test";
import { el, root, draw, paintRoot } from "./util.ts";

describe("probe: layout", () => {
  test.failing(
    "percent width is not applied twice when measuring height (column)",
    () => {
      // txt is 10 wide (50% of 20) and wraps to 3 lines there; the sibling must follow it
      const out = draw(
        root(
          el(
            "box",
            { width: 20 },
            el("txt", { width: "50%" }, "hello world foo bar"),
            el("txt", {}, "next"),
          ),
        ),
        20,
        8,
      );
      expect(out).toBe("hello\nworld foo\nbar\nnext");
    },
  );

  test.failing(
    "percent width is not applied twice when measuring height (row)",
    () => {
      const out = draw(
        root(
          el(
            "box",
            { width: 20 },
            el(
              "box",
              { row: true },
              el("txt", { width: "50%" }, "hello world foo bar"),
              el("txt", {}, "x"),
            ),
            el("txt", {}, "next"),
          ),
        ),
        20,
        8,
      );
      // same as with width={10}: no blank line before "next"
      expect(out).toBe("hello     x\nworld foo\nbar\nnext");
    },
  );

  test.failing(
    "percent-width bordered box is not taller than its content",
    () => {
      const out = draw(
        root(
          el(
            "box",
            { width: 20 },
            el(
              "box",
              { width: "50%", border: true },
              el("txt", {}, "hello world foo bar"),
            ),
            el("txt", {}, "next"),
          ),
        ),
        20,
        10,
      );
      expect(out).toBe(
        [
          "┌────────┐",
          "│hello   │",
          "│world   │",
          "│foo bar │",
          "└────────┘",
          "next",
        ].join("\n"),
      );
    },
  );

  test.failing(
    "text shrunk to zero width in a row does not inflate the row height",
    () => {
      const out = draw(
        root(
          el(
            "box",
            {},
            el(
              "box",
              { row: true },
              el("txt", {}, "hello world foo"),
              el("box", { width: 10 }, el("txt", {}, "XXXXXXXXXX")),
            ),
            el("txt", {}, "below"),
          ),
        ),
        10,
        20,
      );
      expect(out).toBe("XXXXXXXXXX\nbelow");
    },
  );

  test.failing(
    "fractional paddingLeft/marginLeft/marginTop are rounded like `padding`",
    () => {
      // `padding={1.5}` is floored; the longhands are not, giving fractional cell coordinates
      expect(
        draw(
          root(el("box", { paddingLeft: 1.5 }, el("txt", {}, "hello"))),
          10,
          2,
        ),
      ).toBe(
        draw(
          root(el("box", { paddingLeft: 1 }, el("txt", {}, "hello"))),
          10,
          2,
        ),
      );
      expect(
        draw(
          root(el("box", {}, el("txt", { marginLeft: 0.5 }, "hello"))),
          10,
          2,
        ),
      ).toBe("hello");
      expect(
        draw(
          root(
            el("box", { row: true }, el("txt", { marginTop: 0.5 }, "hello")),
          ),
          10,
          2,
        ),
      ).toBe("hello");
    },
  );

  test.failing(
    "negative longhand margin/padding is clamped like the shorthand",
    () => {
      const shorthand = draw(
        root(
          el("box", {}, el("txt", {}, "aaa"), el("txt", { margin: -1 }, "bbb")),
        ),
        10,
        3,
      );
      const longhand = draw(
        root(
          el(
            "box",
            {},
            el("txt", {}, "aaa"),
            el("txt", { marginTop: -1 }, "bbb"),
          ),
        ),
        10,
        3,
      );
      expect(shorthand).toBe("aaa\nbbb");
      expect(longhand).toBe(shorthand);
    },
  );

  test.failing(
    "a title that doesn't fit is not drawn as blank cells in the border",
    () => {
      for (const width of [5, 6]) {
        const out = draw(
          root(el("box", { border: true, title: "Hello", width, height: 2 })),
          width,
          2,
        );
        const top = out.split("\n")[0];
        expect(top).not.toContain(" ");
      }
    },
  );

  test.failing(
    "justify around/evenly with one child centers it like justify=center",
    () => {
      const at = (justify: string) =>
        draw(
          root(el("box", { row: true, justify, width: 6 }, el("txt", {}, "x"))),
          6,
          1,
        );
      expect(at("evenly")).toBe(at("center"));
      expect(at("around")).toBe(at("center"));
    },
  );

  test.failing(
    "attributes win over style for aliased keys (style color vs fg attribute)",
    () => {
      const s = paintRoot(
        root(el("txt", { style: "color: red", fg: "blue" }, "x")),
        5,
        1,
      );
      expect(s.styleAt(0, 0).fg).toBe(4); // blue
    },
  );

  test.failing("box text decorations are not applied to its border", () => {
    const s = paintRoot(
      root(
        el(
          "box",
          { border: true, underline: true, strike: true, width: 6, height: 3 },
          el("txt", {}, "x"),
        ),
      ),
      6,
      3,
    );
    expect(s.styleAt(1, 1).underline).toBe(true); // the text is underlined
    expect(s.styleAt(0, 0).underline).toBe(false); // the border corner is not
    expect(s.styleAt(0, 0).strike).toBe(false);
  });
});
