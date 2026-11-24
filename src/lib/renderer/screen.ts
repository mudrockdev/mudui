/**
 * A grid of terminal cells, and the ANSI output needed to display it.
 */
import type { Rect } from "./geometry.js";
import {
  DEFAULT_COLOR,
  TRUECOLOR,
  type Color,
  type TextStyle,
} from "./style.js";

const BOLD = 1;
const DIM = 2;
const ITALIC = 4;
const UNDERLINE = 8;
const INVERSE = 16;
const STRIKE = 32;

export type ColorDepth = "truecolor" | "256" | "16" | "none";

function attrs_of(style: TextStyle): number {
  return (
    (style.bold ? BOLD : 0) |
    (style.dim ? DIM : 0) |
    (style.italic ? ITALIC : 0) |
    (style.underline ? UNDERLINE : 0) |
    (style.inverse ? INVERSE : 0) |
    (style.strike ? STRIKE : 0)
  );
}

/** Converts a color to one that fits the given depth */
function downgrade(color: Color, depth: ColorDepth): Color {
  if (color < 0 || depth === "truecolor") return color;
  if (depth === "none") return DEFAULT_COLOR;
  if (color & TRUECOLOR) {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    if (depth === "16") {
      const bright = Math.max(r, g, b) > 170;
      const index = (r > 85 ? 1 : 0) | (g > 85 ? 2 : 0) | (b > 85 ? 4 : 0);
      return (
        index +
        (bright && index !== 0
          ? 8
          : index === 0 && Math.max(r, g, b) > 64
            ? 8
            : 0)
      );
    }
    if (r === g && g === b) {
      if (r < 8) return 16;
      if (r > 248) return 231;
      return Math.round(((r - 8) / 247) * 24) + 232;
    }
    const q = (v: number) => Math.round((v / 255) * 5);
    return 16 + 36 * q(r) + 6 * q(g) + q(b);
  }
  if (depth === "16" && color > 15)
    return color >= 232 ? (color > 243 ? 7 : 8) : 7;
  return color;
}

function color_sgr(color: Color, background: boolean): string {
  if (color & TRUECOLOR) {
    return `${background ? 48 : 38};2;${(color >> 16) & 0xff};${(color >> 8) & 0xff};${color & 0xff}`;
  }
  if (color < 8) return String((background ? 40 : 30) + color);
  if (color < 16) return String((background ? 100 : 90) + color - 8);
  return `${background ? 48 : 38};5;${color}`;
}

/** The SGR sequence that sets the given style from a reset state */
export function sgr(
  fg: Color,
  bg: Color,
  attrs: number,
  depth: ColorDepth = "truecolor",
): string {
  const codes = ["0"];
  if (attrs & BOLD) codes.push("1");
  if (attrs & DIM) codes.push("2");
  if (attrs & ITALIC) codes.push("3");
  if (attrs & UNDERLINE) codes.push("4");
  if (attrs & INVERSE) codes.push("7");
  if (attrs & STRIKE) codes.push("9");
  fg = downgrade(fg, depth);
  bg = downgrade(bg, depth);
  if (fg >= 0) codes.push(color_sgr(fg, false));
  if (bg >= 0) codes.push(color_sgr(bg, true));
  return `\x1b[${codes.join(";")}m`;
}

export class Screen {
  readonly width: number;
  readonly height: number;
  readonly chars: string[];
  /** 1 for normal cells, 2 for the first half of a wide character, 0 for its second half */
  readonly widths: Uint8Array;
  readonly fg: Int32Array;
  readonly bg: Int32Array;
  readonly attrs: Uint8Array;

  constructor(width: number, height: number) {
    this.width = Math.max(0, width);
    this.height = Math.max(0, height);
    const size = this.width * this.height;
    this.chars = new Array(size).fill(" ");
    this.widths = new Uint8Array(size).fill(1);
    this.fg = new Int32Array(size).fill(DEFAULT_COLOR);
    this.bg = new Int32Array(size).fill(DEFAULT_COLOR);
    this.attrs = new Uint8Array(size);
  }

  /** Clears the cell, fixing up wide characters that it was part of */
  #clear_wide(x: number, y: number) {
    const i = y * this.width + x;
    if (this.widths[i] === 0 && x > 0) {
      this.chars[i - 1] = " ";
      this.widths[i - 1] = 1;
    }
    if (this.widths[i] === 2 && x + 1 < this.width) {
      this.chars[i + 1] = " ";
      this.widths[i + 1] = 1;
    }
  }

  /**
   * Writes a grapheme at (x, y). Cells outside `clip` are left alone. Unset style
   * colors keep the cell's existing colors, so text inherits box backgrounds.
   */
  put(
    x: number,
    y: number,
    grapheme: string,
    width: number,
    style: TextStyle,
    clip: Rect,
  ): void {
    if (y < clip.y || y >= clip.y + clip.height || y < 0 || y >= this.height)
      return;
    if (x < clip.x || x >= clip.x + clip.width || x < 0 || x >= this.width)
      return;

    if (width === 2 && (x + 1 >= clip.x + clip.width || x + 1 >= this.width)) {
      // half of a wide character would be clipped: show a space instead
      grapheme = " ";
      width = 1;
    }

    this.#clear_wide(x, y);
    if (width === 2) this.#clear_wide(x + 1, y);

    const i = y * this.width + x;
    this.chars[i] = grapheme;
    this.widths[i] = width;
    if (style.fg !== undefined) this.fg[i] = style.fg;
    if (style.bg !== undefined) this.bg[i] = style.bg;
    this.attrs[i] = attrs_of(style);

    if (width === 2) {
      this.chars[i + 1] = "";
      this.widths[i + 1] = 0;
      this.fg[i + 1] = this.fg[i];
      this.bg[i + 1] = this.bg[i];
      this.attrs[i + 1] = this.attrs[i];
    }
  }

  /** Fills the area with spaces of the given background */
  fill(rect: Rect, bg: Color): void {
    const x0 = Math.max(0, rect.x);
    const y0 = Math.max(0, rect.y);
    const x1 = Math.min(this.width, rect.x + rect.width);
    const y1 = Math.min(this.height, rect.y + rect.height);
    for (let y = y0; y < y1; y++) {
      if (x0 > 0) this.#clear_wide(x0, y);
      if (x1 < this.width) this.#clear_wide(x1 - 1, y);
      for (let x = x0; x < x1; x++) {
        const i = y * this.width + x;
        this.chars[i] = " ";
        this.widths[i] = 1;
        this.bg[i] = bg;
        this.fg[i] = DEFAULT_COLOR;
        this.attrs[i] = 0;
      }
    }
  }

  /** The plain text of a row, without styles */
  line(y: number): string {
    let out = "";
    for (let x = 0; x < this.width; x++) out += this.chars[y * this.width + x];
    return out;
  }

  /** Plain text of the whole screen, with trailing whitespace removed from each line */
  toString(): string {
    const lines: string[] = [];
    for (let y = 0; y < this.height; y++) lines.push(this.line(y).trimEnd());
    while (lines.length && lines[lines.length - 1] === "") lines.pop();
    return lines.join("\n");
  }

  /** The style of the cell at (x, y) */
  styleAt(
    x: number,
    y: number,
  ): {
    fg: Color;
    bg: Color;
    bold: boolean;
    dim: boolean;
    italic: boolean;
    underline: boolean;
    inverse: boolean;
    strike: boolean;
  } {
    const i = y * this.width + x;
    const a = this.attrs[i];
    return {
      fg: this.fg[i],
      bg: this.bg[i],
      bold: !!(a & BOLD),
      dim: !!(a & DIM),
      italic: !!(a & ITALIC),
      underline: !!(a & UNDERLINE),
      inverse: !!(a & INVERSE),
      strike: !!(a & STRIKE),
    };
  }

  /** A row as text with SGR sequences, ending with a reset */
  ansiLine(y: number, depth: ColorDepth = "truecolor"): string {
    let out = "";
    let current = "";
    // the style of the previous cell: only build an SGR sequence when it changes
    let fg = NaN;
    let bg = NaN;
    let attrs = NaN;
    for (let x = 0; x < this.width; x++) {
      const i = y * this.width + x;
      if (this.widths[i] === 0) continue;
      if (this.fg[i] !== fg || this.bg[i] !== bg || this.attrs[i] !== attrs) {
        fg = this.fg[i];
        bg = this.bg[i];
        attrs = this.attrs[i];
        const style = sgr(fg, bg, attrs, depth);
        if (style !== current) {
          out += style;
          current = style;
        }
      }
      out += this.chars[i];
    }
    return out + "\x1b[0m";
  }

  /**
   * The output that turns `previous` (what's on the terminal) into this screen,
   * using absolute cursor positioning. With no previous screen, everything is drawn.
   */
  diff(
    previous: Screen | null,
    depth: ColorDepth = "truecolor",
    origin_row = 0,
  ): string {
    const full =
      !previous ||
      previous.width !== this.width ||
      previous.height !== this.height;
    let out = "";
    let current = "";
    let cursor_x = -1;
    let cursor_y = -1;
    // the style last written: only build an SGR sequence when it changes
    let fg = NaN;
    let bg = NaN;
    let attrs = NaN;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        if (this.widths[i] === 0) continue;

        if (
          !full &&
          previous!.chars[i] === this.chars[i] &&
          previous!.widths[i] === this.widths[i] &&
          previous!.fg[i] === this.fg[i] &&
          previous!.bg[i] === this.bg[i] &&
          previous!.attrs[i] === this.attrs[i] &&
          // a wide char that was overwritten on its second half must be redrawn
          (this.widths[i] !== 2 || previous!.widths[i + 1] === 0)
        ) {
          continue;
        }

        if (cursor_y !== y || cursor_x !== x) {
          out += `\x1b[${origin_row + y + 1};${x + 1}H`;
        }

        if (this.fg[i] !== fg || this.bg[i] !== bg || this.attrs[i] !== attrs) {
          fg = this.fg[i];
          bg = this.bg[i];
          attrs = this.attrs[i];
          const style = sgr(fg, bg, attrs, depth);
          if (style !== current) {
            out += style;
            current = style;
          }
        }

        out += this.chars[i];
        cursor_x = x + this.widths[i];
        cursor_y = y;
      }
    }

    if (out) out += "\x1b[0m";
    return out;
  }
}
