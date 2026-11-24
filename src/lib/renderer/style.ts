/**
 * Turns element attributes (and the CSS-like `style` attribute) into computed styles.
 *
 * Attribute names are case- and dash-insensitive, so `paddingX`, `padding-x` and
 * `paddingx` are the same thing. Attributes take precedence over `style`.
 */
import type { TElement } from "./nodes.js";
import type { WrapMode } from "./text.js";

/**
 * An encoded color: `-1` is the terminal default, `0..255` are palette
 * indices, and truecolor values are `0x1000000 | 0xRRGGBB`.
 */
export type Color = number;

export const DEFAULT_COLOR = -1;
export const TRUECOLOR = 0x1000000;

const NAMED: Record<string, number> = {
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  gray: 8,
  grey: 8,
};

export function parseColor(value: unknown): Color | undefined {
  if (value == null || value === false || value === "") return undefined;
  if (typeof value === "number")
    return value >= 0 && value <= 255 ? value | 0 : undefined;

  const v = String(value)
    .trim()
    .toLowerCase()
    .replace(/[-_\s]/g, "");
  if (v === "default" || v === "none" || v === "inherit") return DEFAULT_COLOR;
  if (v in NAMED) return NAMED[v];

  // brightred, redbright
  const bright = /^bright(\w+)$/.exec(v)?.[1] ?? /^(\w+)bright$/.exec(v)?.[1];
  if (bright !== undefined && bright in NAMED)
    return bright === "black" ? 8 : NAMED[bright] + 8;

  if (/^\d+$/.test(v)) {
    const n = Number(v);
    return n <= 255 ? n : undefined;
  }

  let m = /^#([0-9a-f]{3})$/.exec(v);
  if (m) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return TRUECOLOR | (r << 16) | (g << 8) | b;
  }

  m = /^#([0-9a-f]{6})$/.exec(v);
  if (m) return TRUECOLOR | parseInt(m[1], 16);

  m = /^rgb\((\d+),(\d+),(\d+)\)$/.exec(v);
  if (m) {
    const [r, g, b] = m.slice(1).map((n) => Math.min(255, Number(n)));
    return TRUECOLOR | (r << 16) | (g << 8) | b;
  }

  return undefined;
}

export interface TextStyle {
  fg?: Color;
  bg?: Color;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strike?: boolean;
}

export const TEXT_STYLE_KEYS = [
  "fg",
  "bg",
  "bold",
  "dim",
  "italic",
  "underline",
  "inverse",
  "strike",
] as const;

/** Merges `own` over `inherited`, returning `inherited` itself if nothing changes */
export function mergeTextStyle(
  inherited: TextStyle,
  own: TextStyle,
): TextStyle {
  let out: TextStyle | null = null;
  for (const key of TEXT_STYLE_KEYS) {
    const value = own[key];
    if (value !== undefined && value !== inherited[key]) {
      out ??= { ...inherited };
      (out as any)[key] = value;
    }
  }
  return out ?? inherited;
}

export type Dimension = { value: number; percent: boolean } | undefined;

export interface BorderChars {
  tl: string;
  t: string;
  tr: string;
  r: string;
  br: string;
  b: string;
  bl: string;
  l: string;
}

export const BORDERS: Record<string, BorderChars> = {
  single: {
    tl: "┌",
    t: "─",
    tr: "┐",
    r: "│",
    br: "┘",
    b: "─",
    bl: "└",
    l: "│",
  },
  round: { tl: "╭", t: "─", tr: "╮", r: "│", br: "╯", b: "─", bl: "╰", l: "│" },
  double: {
    tl: "╔",
    t: "═",
    tr: "╗",
    r: "║",
    br: "╝",
    b: "═",
    bl: "╚",
    l: "║",
  },
  bold: { tl: "┏", t: "━", tr: "┓", r: "┃", br: "┛", b: "━", bl: "┗", l: "┃" },
  dashed: {
    tl: "┌",
    t: "╌",
    tr: "┐",
    r: "╎",
    br: "┘",
    b: "╌",
    bl: "└",
    l: "╎",
  },
  ascii: { tl: "+", t: "-", tr: "+", r: "|", br: "+", b: "-", bl: "+", l: "|" },
};

export type Align = "start" | "center" | "end" | "stretch";
export type Justify =
  "start" | "center" | "end" | "between" | "around" | "evenly";
export type Edges = [top: number, right: number, bottom: number, left: number];

export interface ComputedStyle {
  hidden: boolean;
  direction: "row" | "column";
  gap: number;
  padding: Edges;
  margin: Edges;
  border: BorderChars | null;
  borderSides: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  borderStyle: TextStyle;
  title: string | null;
  titleAlign: "left" | "center" | "right";
  width: Dimension;
  height: Dimension;
  minWidth: Dimension;
  maxWidth: Dimension;
  minHeight: Dimension;
  maxHeight: Dimension;
  grow: number;
  shrink: number | undefined;
  align: Align;
  alignSelf: Align | undefined;
  justify: Justify;
  absolute: boolean;
  top: Dimension;
  right: Dimension;
  bottom: Dimension;
  left: Dimension;
  scrollX: number;
  scrollY: number;
  /** `scrollX` / `scrollY` is set: the box is a viewport onto its content on that axis */
  scrollsX: boolean;
  scrollsY: boolean;
  /** Background fill of the element's box */
  bg: Color | undefined;
  /** Text style declared on this element (inherited by descendants) */
  text: TextStyle;
  wrap: WrapMode;
  textAlign: "left" | "center" | "right";
  /** Repeated after the text to fill each line (`<txt fill="─">`) */
  fill: string | null;
  focusable: boolean;
}

const normalize = (name: string) => name.toLowerCase().replace(/[-_]/g, "");

/** Parses `"padding: 1 2; border: round"` into normalized key/value pairs */
function parse_style_attribute(style: string, into: Map<string, unknown>) {
  for (const declaration of style.split(";")) {
    const index = declaration.indexOf(":");
    if (index === -1) continue;
    const key = normalize(declaration.slice(0, index).trim());
    const value = declaration.slice(index + 1).trim();
    if (key) into.set(key, value);
  }
}

function to_number(value: unknown, fallback = 0): number {
  if (typeof value === "number")
    return Number.isFinite(value) ? value : fallback;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return fallback;
}

function to_bool(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === false || value === "false" || value === 0 || value === "0")
    return false;
  return true;
}

function to_dimension(value: unknown): Dimension {
  if (value == null || value === "auto" || value === "") return undefined;
  if (typeof value === "number")
    return { value: Math.max(0, value), percent: false };
  const s = String(value).trim();
  if (s.endsWith("%"))
    return { value: to_number(s.slice(0, -1)), percent: true };
  const n = to_number(s, NaN);
  return Number.isNaN(n)
    ? undefined
    : { value: Math.max(0, n), percent: false };
}

function to_edges(value: unknown): Edges {
  if (value == null || value === false) return [0, 0, 0, 0];
  const parts = (
    typeof value === "number" ? [value] : String(value).trim().split(/\s+/)
  ).map((v) => Math.max(0, Math.floor(to_number(v))));
  const [t, r = t, b = t, l = r] = parts;
  return [t, r, b, l];
}

function edges(attrs: Map<string, unknown>, prefix: string): Edges {
  const out = to_edges(attrs.get(prefix));
  const x = attrs.get(prefix + "x");
  const y = attrs.get(prefix + "y");
  if (x != null) out[1] = out[3] = to_number(x);
  if (y != null) out[0] = out[2] = to_number(y);
  const sides = ["top", "right", "bottom", "left"];
  for (let i = 0; i < 4; i++) {
    const v = attrs.get(prefix + sides[i]);
    if (v != null) out[i] = to_number(v);
  }
  return out;
}

function one_of<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T;
function one_of<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback?: T,
): T | undefined;
function one_of<T extends string>(
  value: unknown,
  options: readonly T[],
  fallback?: T,
) {
  if (value == null) return fallback;
  let v = String(value).toLowerCase();
  if (v === "flex-start") v = "start";
  if (v === "flex-end") v = "end";
  if (v === "space-between") v = "between";
  if (v === "space-around") v = "around";
  if (v === "space-evenly") v = "evenly";
  return (options as readonly string[]).includes(v) ? v : fallback;
}

export function parseTextStyle(attrs: Map<string, unknown>): TextStyle {
  const style: TextStyle = {};
  const fg = parseColor(attrs.get("color") ?? attrs.get("fg"));
  if (fg !== undefined) style.fg = fg;
  for (const key of [
    "bold",
    "dim",
    "italic",
    "underline",
    "inverse",
    "strike",
  ] as const) {
    const v = to_bool(attrs.get(key));
    if (v !== undefined) style[key] = v;
  }
  const strike = to_bool(attrs.get("strikethrough"));
  if (strike !== undefined) style.strike = strike;
  return style;
}

const cache = new WeakMap<
  TElement,
  { version: number; style: ComputedStyle; attrs: Map<string, unknown> }
>();

/** Normalized attributes of the element, with `style` expanded */
export function normalizedAttributes(element: TElement): Map<string, unknown> {
  return compute(element).attrs;
}

export function computeStyle(element: TElement): ComputedStyle {
  return compute(element).style;
}

function compute(element: TElement) {
  const cached = cache.get(element);
  if (cached && cached.version === element.version) return cached;

  const attrs = new Map<string, unknown>();
  const style_attr = element.attributes.get("style");
  if (typeof style_attr === "string") parse_style_attribute(style_attr, attrs);
  for (const [key, value] of element.attributes) {
    if (key === "style" || key === "class") continue;
    attrs.set(normalize(key), value);
  }

  const text = parseTextStyle(attrs);
  const bg = parseColor(
    attrs.get("bg") ?? attrs.get("background") ?? attrs.get("backgroundcolor"),
  );

  const border_value = attrs.get("border") ?? attrs.get("borderstyle");
  let border: BorderChars | null = null;
  if (
    border_value !== undefined &&
    border_value !== false &&
    border_value !== "none"
  ) {
    border =
      border_value === "" || border_value === true
        ? BORDERS.single
        : (BORDERS[String(border_value).toLowerCase()] ?? BORDERS.single);
  }

  const border_style: TextStyle = {};
  const border_color = parseColor(attrs.get("bordercolor"));
  if (border_color !== undefined) border_style.fg = border_color;
  if (to_bool(attrs.get("borderdim"))) border_style.dim = true;

  const side = (name: string) => to_bool(attrs.get("border" + name)) ?? true;

  const direction =
    to_bool(attrs.get("row")) === true
      ? "row"
      : one_of(
          attrs.get("direction") ?? attrs.get("flexdirection"),
          ["row", "column"],
          "column",
        );

  const grow_value = attrs.get("grow") ?? attrs.get("flexgrow");
  const shrink_value = attrs.get("shrink") ?? attrs.get("flexshrink");

  const position = attrs.get("position");

  const style: ComputedStyle = {
    hidden:
      to_bool(attrs.get("hidden")) === true || attrs.get("display") === "none",
    direction,
    gap: Math.max(0, to_number(attrs.get("gap"))),
    padding: edges(attrs, "padding"),
    margin: edges(attrs, "margin"),
    border,
    borderSides: {
      top: side("top"),
      right: side("right"),
      bottom: side("bottom"),
      left: side("left"),
    },
    borderStyle: border_style,
    title:
      attrs.get("title") == null || attrs.get("title") === ""
        ? null
        : String(attrs.get("title")),
    titleAlign: one_of(
      attrs.get("titlealign"),
      ["left", "center", "right"],
      "left",
    ),
    width: to_dimension(attrs.get("width")),
    height: to_dimension(attrs.get("height")),
    minWidth: to_dimension(attrs.get("minwidth")),
    maxWidth: to_dimension(attrs.get("maxwidth")),
    minHeight: to_dimension(attrs.get("minheight")),
    maxHeight: to_dimension(attrs.get("maxheight")),
    grow:
      grow_value === "" || grow_value === true
        ? 1
        : Math.max(0, to_number(grow_value)),
    shrink:
      shrink_value === undefined
        ? undefined
        : shrink_value === "" || shrink_value === true
          ? 1
          : Math.max(0, to_number(shrink_value)),
    align: one_of(
      attrs.get("align") ?? attrs.get("alignitems"),
      ["start", "center", "end", "stretch"],
      "stretch",
    ),
    alignSelf: one_of(attrs.get("alignself"), [
      "start",
      "center",
      "end",
      "stretch",
    ]),
    justify: one_of(
      attrs.get("justify") ?? attrs.get("justifycontent"),
      ["start", "center", "end", "between", "around", "evenly"],
      "start",
    ),
    absolute:
      position === "absolute" || to_bool(attrs.get("absolute")) === true,
    top: to_dimension(attrs.get("top")),
    right: to_dimension(attrs.get("right")),
    bottom: to_dimension(attrs.get("bottom")),
    left: to_dimension(attrs.get("left")),
    scrollX: Math.max(0, Math.floor(to_number(attrs.get("scrollx")))),
    scrollY: Math.max(0, Math.floor(to_number(attrs.get("scrolly")))),
    scrollsX: attrs.get("scrollx") != null && attrs.get("scrollx") !== false,
    scrollsY: attrs.get("scrolly") != null && attrs.get("scrolly") !== false,
    bg,
    text,
    wrap: one_of(
      attrs.get("wrap") ?? attrs.get("textwrap"),
      ["wrap", "truncate", "truncate-start", "truncate-middle", "none"],
      "wrap",
    ),
    textAlign: one_of(
      attrs.get("textalign") ?? attrs.get("align"),
      ["left", "center", "right"],
      "left",
    ),
    fill:
      attrs.get("fill") == null || attrs.get("fill") === ""
        ? null
        : String(attrs.get("fill")),
    focusable:
      to_bool(attrs.get("focusable")) === true ||
      (attrs.has("tabindex") && to_number(attrs.get("tabindex"), -1) >= 0),
  };

  const entry = { version: element.version, style, attrs };
  cache.set(element, entry);
  return entry;
}

/** Resolves a dimension against the size of the containing box */
export function resolve(dim: Dimension, base: number): number | undefined {
  if (!dim) return undefined;
  return Math.floor(dim.percent ? (dim.value / 100) * base : dim.value);
}
