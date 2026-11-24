/**
 * Measuring and wrapping text in terminal cells.
 */
import type { TextStyle } from "./style.js";

export interface TextRun {
  text: string;
  style: TextStyle;
}

export interface TextSegment {
  text: string;
  style: TextStyle;
  width: number;
}

export interface TextLine {
  segments: TextSegment[];
  width: number;
}

export type WrapMode =
  "wrap" | "truncate" | "truncate-start" | "truncate-middle" | "none";

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const width_cache = new Map<string, number>();

const ZERO_WIDTH = /^(?:\p{Mn}|\p{Me}|\p{Cf}|\p{Cc}|[​-‏︀-️])+$/u;
const EMOJI = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Is the code point east-asian wide or fullwidth? */
function is_wide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    cp === 0x2329 ||
    cp === 0x232a ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1f64f) ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  );
}

/** Width of a single grapheme cluster in terminal cells (0, 1 or 2) */
export function graphemeWidth(grapheme: string): number {
  let width = width_cache.get(grapheme);
  if (width !== undefined) return width;

  const cp = grapheme.codePointAt(0)!;

  if (ZERO_WIDTH.test(grapheme)) width = 0;
  else if (is_wide(cp)) width = 2;
  else if (EMOJI.test(grapheme) && (grapheme.includes("️") || cp >= 0x1f000))
    width = 2;
  else width = 1;

  if (width_cache.size > 10_000) width_cache.clear();
  width_cache.set(grapheme, width);
  return width;
}

export function graphemes(text: string): string[] {
  // fast path for plain ASCII
  if (/^[\x20-\x7e]*$/.test(text)) return text.split("");
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/** Width of a string in terminal cells */
export function stringWidth(text: string): number {
  if (/^[\x20-\x7e]*$/.test(text)) return text.length;
  let width = 0;
  for (const g of graphemes(text)) width += graphemeWidth(g);
  return width;
}

/** Truncates `text` so that it fits in `width` cells, adding an ellipsis if anything was cut */
export function truncate(text: string, width: number, ellipsis = "…"): string {
  if (stringWidth(text) <= width) return text;
  if (width <= 0) return "";
  let out = "";
  let w = 0;
  const limit = width - stringWidth(ellipsis);
  for (const g of graphemes(text)) {
    const gw = graphemeWidth(g);
    if (w + gw > limit) break;
    out += g;
    w += gw;
  }
  return out + ellipsis;
}

/** Pads (or truncates) `text` to exactly `width` cells */
export function fit(
  text: string,
  width: number,
  align: "left" | "right" | "center" = "left",
): string {
  const t = truncate(text, width);
  const pad = width - stringWidth(t);
  if (align === "right") return " ".repeat(pad) + t;
  if (align === "center") {
    const left = Math.floor(pad / 2);
    return " ".repeat(left) + t + " ".repeat(pad - left);
  }
  return t + " ".repeat(pad);
}

interface Glyph {
  g: string;
  w: number;
  style: TextStyle;
}

/** Splits runs into logical lines (at `\n`) of glyphs */
function to_logical_lines(runs: TextRun[]): Glyph[][] {
  const lines: Glyph[][] = [[]];
  for (const run of runs) {
    for (const g of graphemes(
      run.text.replace(/\r\n?/g, "\n").replace(/\t/g, "  "),
    )) {
      if (g === "\n") {
        lines.push([]);
        continue;
      }
      lines[lines.length - 1].push({
        g,
        w: graphemeWidth(g),
        style: run.style,
      });
    }
  }
  return lines;
}

function glyphs_width(glyphs: Glyph[]): number {
  let w = 0;
  for (const glyph of glyphs) w += glyph.w;
  return w;
}

function to_line(glyphs: Glyph[]): TextLine {
  const segments: TextSegment[] = [];
  let width = 0;
  for (const glyph of glyphs) {
    const last = segments[segments.length - 1];
    if (last && last.style === glyph.style) {
      last.text += glyph.g;
      last.width += glyph.w;
    } else {
      segments.push({ text: glyph.g, style: glyph.style, width: glyph.w });
    }
    width += glyph.w;
  }
  return { segments, width };
}

const is_space = (glyph: Glyph) => glyph.g === " ";

function wrap_line(glyphs: Glyph[], width: number): Glyph[][] {
  if (glyphs_width(glyphs) <= width) return [glyphs];

  const out: Glyph[][] = [];
  let line: Glyph[] = [];
  let line_width = 0;

  const push = () => {
    while (line.length && is_space(line[line.length - 1]))
      line_width -= line.pop()!.w;
    out.push(line);
    line = [];
    line_width = 0;
  };

  let i = 0;
  while (i < glyphs.length) {
    // collect the next token: a run of spaces or a word
    const space = is_space(glyphs[i]);
    let j = i;
    while (j < glyphs.length && is_space(glyphs[j]) === space) j++;
    const token = glyphs.slice(i, j);
    const token_width = glyphs_width(token);
    i = j;

    if (space) {
      // spaces at the start of a wrapped line are dropped
      if (line.length === 0 && out.length > 0) continue;
      for (const glyph of token) {
        if (line_width + glyph.w > width) break;
        line.push(glyph);
        line_width += glyph.w;
      }
      continue;
    }

    if (line_width + token_width <= width) {
      line.push(...token);
      line_width += token_width;
      continue;
    }

    if (token_width <= width && line.length > 0) {
      push();
      line.push(...token);
      line_width = token_width;
      continue;
    }

    // the word doesn't fit on a line of its own: break it
    for (const glyph of token) {
      if (line_width + glyph.w > width && line.length > 0) push();
      line.push(glyph);
      line_width += glyph.w;
    }
  }

  if (line.length > 0 || out.length === 0) push();
  return out;
}

function truncate_line(
  glyphs: Glyph[],
  width: number,
  mode: WrapMode,
): Glyph[] {
  if (glyphs_width(glyphs) <= width) return glyphs;
  if (width <= 0) return [];

  const ellipsis = (style: TextStyle): Glyph => ({ g: "…", w: 1, style });

  const take = (list: Glyph[], max: number) => {
    const out: Glyph[] = [];
    let w = 0;
    for (const glyph of list) {
      if (w + glyph.w > max) break;
      out.push(glyph);
      w += glyph.w;
    }
    return out;
  };

  if (mode === "truncate-start") {
    const tail = take([...glyphs].reverse(), width - 1).reverse();
    return [ellipsis(glyphs[0].style), ...tail];
  }

  if (mode === "truncate-middle") {
    const left = take(glyphs, Math.ceil((width - 1) / 2));
    const right = take(
      [...glyphs].reverse(),
      Math.floor((width - 1) / 2),
    ).reverse();
    return [
      ...left,
      ellipsis(left[left.length - 1]?.style ?? glyphs[0].style),
      ...right,
    ];
  }

  const head = take(glyphs, width - 1);
  return [...head, ellipsis(head[head.length - 1]?.style ?? glyphs[0].style)];
}

/** Lays out runs of text into lines no wider than `width` (except in `none` mode) */
export function layoutText(
  runs: TextRun[],
  width: number,
  mode: WrapMode = "wrap",
): TextLine[] {
  const logical = to_logical_lines(runs);
  const lines: TextLine[] = [];

  for (const glyphs of logical) {
    if (mode === "wrap") {
      for (const line of wrap_line(glyphs, Math.max(1, width)))
        lines.push(to_line(line));
    } else if (mode === "none") {
      lines.push(to_line(glyphs));
    } else {
      lines.push(to_line(truncate_line(glyphs, width, mode)));
    }
  }

  return lines;
}

/** The width the text would take up without any wrapping */
export function maxContentWidth(runs: TextRun[]): number {
  let max = 0;
  for (const glyphs of to_logical_lines(runs))
    max = Math.max(max, glyphs_width(glyphs));
  return max;
}
