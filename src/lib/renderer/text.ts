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
  /** `text` split into grapheme clusters, when known (saves splitting it again to paint it) */
  chars?: string[];
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

/** Widths of single UTF-16 code unit graphemes (-1: not computed yet) */
const bmp_width = new Int8Array(0x10000).fill(-1);

/** Width of a single grapheme cluster in terminal cells (0, 1 or 2) */
export function graphemeWidth(grapheme: string): number {
  if (grapheme.length === 1) {
    const code = grapheme.charCodeAt(0);
    const known = bmp_width[code];
    if (known >= 0) return known;
    return (bmp_width[code] = measure_grapheme(grapheme));
  }
  let width = width_cache.get(grapheme);
  if (width !== undefined) return width;
  width = measure_grapheme(grapheme);
  if (width_cache.size > 10_000) width_cache.clear();
  width_cache.set(grapheme, width);
  return width;
}

function measure_grapheme(grapheme: string): number {
  let width: number;

  const cp = grapheme.codePointAt(0)!;

  if (ZERO_WIDTH.test(grapheme)) width = 0;
  else if (is_wide(cp)) width = 2;
  else if (EMOJI.test(grapheme) && (grapheme.includes("️") || cp >= 0x1f000))
    width = 2;
  else width = 1;
  return width;
}

const ASCII = /^[\x20-\x7e]*$/;
/** Segmented non-ASCII strings: the same text tends to be drawn again and again */
const segment_cache = new Map<string, string[]>();

/** Like `graphemes`, but the result may be shared: don't modify it */
function split(text: string): string[] {
  if (ASCII.test(text)) return text.split("");
  let out = segment_cache.get(text);
  if (out) return out;
  out = Array.from(segmenter.segment(text), (s) => s.segment);
  if (text.length <= 256) {
    if (segment_cache.size >= 2048) segment_cache.clear();
    segment_cache.set(text, out);
  }
  return out;
}

export function graphemes(text: string): string[] {
  const out = split(text);
  // a cached array is shared: hand out a copy
  return segment_cache.get(text) === out ? out.slice() : out;
}

/** Width of a string in terminal cells */
export function stringWidth(text: string): number {
  if (ASCII.test(text)) return text.length;
  let width = 0;
  for (const g of split(text)) width += graphemeWidth(g);
  return width;
}

/** Truncates `text` so that it fits in `width` cells, adding an ellipsis if anything was cut */
export function truncate(text: string, width: number, ellipsis = "…"): string {
  if (stringWidth(text) <= width) return text;
  if (width <= 0) return "";
  let out = "";
  let w = 0;
  const limit = width - stringWidth(ellipsis);
  for (const g of split(text)) {
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
    for (const g of split(
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
  let last: (TextSegment & { chars: string[] }) | undefined;
  for (const glyph of glyphs) {
    if (last && last.style === glyph.style) {
      last.text += glyph.g;
      last.width += glyph.w;
      last.chars.push(glyph.g);
    } else {
      last = {
        text: glyph.g,
        style: glyph.style,
        width: glyph.w,
        chars: [glyph.g],
      };
      segments.push(last);
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

function lay_out(logical: Glyph[][], width: number, mode: WrapMode) {
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

/** Lays out runs of text into lines no wider than `width` (except in `none` mode) */
export function layoutText(
  runs: TextRun[],
  width: number,
  mode: WrapMode = "wrap",
): TextLine[] {
  return lay_out(to_logical_lines(runs), width, mode);
}

/** The width the text would take up without any wrapping */
export function maxContentWidth(runs: TextRun[]): number {
  let max = 0;
  for (const glyphs of to_logical_lines(runs))
    max = Math.max(max, glyphs_width(glyphs));
  return max;
}

function same_style(a: TextStyle, b: TextStyle): boolean {
  if (a === b) return true;
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.inverse === b.inverse &&
    a.strike === b.strike
  );
}

/**
 * Runs of text split into glyphs once, with the laid out lines memoized per
 * width. The layout pass keeps one per text block across frames and reuses it
 * while the text and its styles stay the same, so unchanged text isn't split
 * and wrapped again every frame.
 *
 * The returned lines are shared: don't modify them.
 */
export class PreparedText {
  readonly runs: TextRun[];
  /** The width the text would take up without any wrapping */
  readonly natural: number;
  readonly #logical: Glyph[][];
  #layouts = new Map<number, TextLine[]>();
  #mode: WrapMode | null = null;

  constructor(runs: TextRun[]) {
    this.runs = runs;
    this.#logical = to_logical_lines(runs);
    let natural = 0;
    for (const glyphs of this.#logical)
      natural = Math.max(natural, glyphs_width(glyphs));
    this.natural = natural;
  }

  /** Whether `runs` has the same text and styles as this */
  matches(runs: TextRun[]): boolean {
    const own = this.runs;
    if (own.length !== runs.length) return false;
    for (let i = 0; i < runs.length; i++) {
      if (own[i].text !== runs[i].text) return false;
      if (!same_style(own[i].style, runs[i].style)) return false;
    }
    return true;
  }

  /** Same as `layoutText(runs, width, mode)` */
  layout(width: number, mode: WrapMode = "wrap"): TextLine[] {
    if (mode !== this.#mode) {
      this.#mode = mode;
      this.#layouts.clear();
    }
    // every line fits in `natural`, so any width beyond it gives the same lines
    const key = mode === "none" ? 0 : Math.min(width, this.natural);
    let lines = this.#layouts.get(key);
    if (!lines) {
      if (this.#layouts.size >= 8) this.#layouts.clear();
      lines = lay_out(this.#logical, key, mode);
      this.#layouts.set(key, lines);
    }
    return lines;
  }
}
