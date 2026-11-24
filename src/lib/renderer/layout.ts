/**
 * A small flexbox-like layout engine working in whole terminal cells.
 *
 * `<box>` elements are flex containers (column by default), `<txt>` elements hold
 * inline, wrapping text, and loose text inside a box becomes an anonymous text
 * block. Each frame, the element tree is turned into a tree of layout nodes, which
 * is measured, positioned and finally painted.
 */
import type { Rect } from "./geometry.js";
import { TElement, TText } from "./nodes.js";
import {
  computeStyle,
  mergeTextStyle,
  resolve,
  type ComputedStyle,
  type Dimension,
  type TextStyle,
} from "./style.js";
import {
  layoutText,
  maxContentWidth,
  stringWidth,
  type TextLine,
  type TextRun,
} from "./text.js";

export interface LayoutNode {
  /** `null` for anonymous text blocks */
  element: TElement | null;
  style: ComputedStyle;
  text: boolean;
  runs: TextRun[];
  /** Text style inherited by this node's content */
  inherited: TextStyle;
  children: LayoutNode[];
  rect: Rect;
  inner: Rect;
  lines: TextLine[];
  contentWidth: number;
  contentHeight: number;
  measured: Map<number, { width: number; height: number }>;
}

const TEXT_ELEMENTS = new Set(["txt", "text", "span"]);

export function isTextElement(element: TElement): boolean {
  return TEXT_ELEMENTS.has(element.name);
}

const ANONYMOUS_STYLE: ComputedStyle = computeStyle(new TElement("txt"));

function node(
  element: TElement | null,
  style: ComputedStyle,
  inherited: TextStyle,
): LayoutNode {
  return {
    element,
    style,
    text: false,
    runs: [],
    inherited,
    children: [],
    rect: { x: 0, y: 0, width: 0, height: 0 },
    inner: { x: 0, y: 0, width: 0, height: 0 },
    lines: [],
    contentWidth: 0,
    contentHeight: 0,
    measured: new Map(),
  };
}

function own_text_style(style: ComputedStyle): TextStyle {
  return style.bg === undefined ? style.text : { ...style.text, bg: style.bg };
}

function collect_runs(
  element: TElement,
  inherited: TextStyle,
  runs: TextRun[],
) {
  for (const child of element.children()) {
    if (child instanceof TText) {
      if (child.data) runs.push({ text: child.data, style: inherited });
    } else if (child instanceof TElement) {
      const style = computeStyle(child);
      if (style.hidden) continue;
      collect_runs(
        child,
        mergeTextStyle(inherited, own_text_style(style)),
        runs,
      );
    }
  }
}

function clear_layout(element: TElement) {
  element.layout = null;
  element.lines = null;
  for (const child of element.descendants()) {
    child.layout = null;
    child.lines = null;
  }
}

/** Builds the layout tree for `element` and its descendants */
export function build(
  element: TElement,
  inherited: TextStyle = {},
): LayoutNode | null {
  const style = computeStyle(element);

  if (style.hidden) {
    clear_layout(element);
    return null;
  }

  if (isTextElement(element)) {
    const own = mergeTextStyle(inherited, own_text_style(style));
    const n = node(element, style, own);
    n.text = true;
    collect_runs(element, own, n.runs);
    // nested inline elements are part of this element's box
    for (const child of element.descendants()) child.layout = null;
    return n;
  }

  const text_style = mergeTextStyle(inherited, style.text);
  const n = node(element, style, text_style);
  let pending: string[] = [];

  const flush = () => {
    const text = pending.join("").trim();
    pending = [];
    if (!text) return;
    const anon = node(null, ANONYMOUS_STYLE, text_style);
    anon.text = true;
    anon.runs = [{ text, style: text_style }];
    n.children.push(anon);
  };

  for (const child of element.children()) {
    if (child instanceof TText) {
      pending.push(child.data);
    } else if (child instanceof TElement) {
      flush();
      const c = build(child, text_style);
      if (c) n.children.push(c);
    }
  }
  flush();

  return n;
}

interface Chrome {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function chrome(style: ComputedStyle): Chrome {
  const [pt, pr, pb, pl] = style.padding;
  const b = style.border;
  const s = style.borderSides;
  return {
    top: pt + (b && s.top ? 1 : 0),
    right: pr + (b && s.right ? 1 : 0),
    bottom: pb + (b && s.bottom ? 1 : 0),
    left: pl + (b && s.left ? 1 : 0),
  };
}

function clamp(
  value: number,
  min: Dimension,
  max: Dimension,
  base: number,
): number {
  const lo = resolve(min, base);
  const hi = resolve(max, base);
  if (hi !== undefined) value = Math.min(value, hi);
  if (lo !== undefined) value = Math.max(value, lo);
  return Math.max(0, value);
}

const flow = (n: LayoutNode) => n.children.filter((c) => !c.style.absolute);

/** Natural size of the node when given `available` columns (and an optional definite height base) */
export function measure(
  n: LayoutNode,
  available: number,
): { width: number; height: number } {
  available = Math.max(0, Math.floor(available));
  const cached = n.measured.get(available);
  if (cached) return cached;

  const s = n.style;
  const c = chrome(s);
  const cx = c.left + c.right;
  const cy = c.top + c.bottom;
  const fixed_width = resolve(s.width, available);
  const fixed_height =
    s.height && !s.height.percent ? s.height.value : undefined;

  let result: { width: number; height: number };

  if (n.text) {
    const outer = fixed_width ?? available;
    const inner = Math.max(0, outer - cx);
    const natural = maxContentWidth(n.runs);
    const width = Math.min(natural, inner);
    const lines = layoutText(
      n.runs,
      s.wrap === "wrap" ? Math.max(1, width) : width,
      s.wrap,
    );
    const empty = n.runs.length === 0 && !s.fill;
    result = {
      width: clamp(
        fixed_width ?? width + cx,
        s.minWidth,
        s.maxWidth,
        available,
      ),
      height: clamp(
        fixed_height ?? (empty ? 0 : lines.length) + cy,
        s.minHeight,
        s.maxHeight,
        0,
      ),
    };
  } else {
    const outer = fixed_width ?? available;
    const inner = Math.max(0, outer - cx);
    const content = measure_content(n, inner);
    result = {
      width: clamp(
        fixed_width ?? Math.min(content.width + cx, available),
        s.minWidth,
        s.maxWidth,
        available,
      ),
      height: clamp(
        fixed_height ?? content.height + cy,
        s.minHeight,
        s.maxHeight,
        0,
      ),
    };
  }

  n.measured.set(available, result);
  return result;
}

/**
 * The starting size of a scroll container that grows along its parent's main
 * axis and scrolls on that axis: just its padding and border. Its content is
 * scrolled, so it takes its size from the free space; if it started from its
 * content size it could never be smaller than its content, and never scroll.
 * `undefined` for other items (and ones with an explicit size).
 */
function viewport_basis(item: LayoutNode, column: boolean): number | undefined {
  const s = item.style;
  if (s.grow <= 0) return undefined;
  if (column ? !s.scrollsY || s.height : !s.scrollsX || s.width)
    return undefined;
  const c = chrome(s);
  return column ? c.top + c.bottom : c.left + c.right;
}

const margin_x = (n: LayoutNode) => n.style.margin[1] + n.style.margin[3];
const margin_y = (n: LayoutNode) => n.style.margin[0] + n.style.margin[2];

function measure_content(
  n: LayoutNode,
  inner_width: number,
): { width: number; height: number } {
  const items = flow(n);
  if (items.length === 0) return { width: 0, height: 0 };
  const gaps = n.style.gap * (items.length - 1);

  if (n.style.direction === "column") {
    let width = 0;
    let height = gaps;
    for (const item of items) {
      const m = measure(item, inner_width - margin_x(item));
      width = Math.max(width, m.width + margin_x(item));
      height += (viewport_basis(item, true) ?? m.height) + margin_y(item);
    }
    return { width, height };
  }

  const widths = row_widths(n, items, inner_width);
  let width = gaps;
  let height = 0;
  items.forEach((item, i) => {
    width += widths[i] + margin_x(item);
    height = Math.max(height, measure(item, widths[i]).height + margin_y(item));
  });
  return { width, height };
}

/** Main-axis sizes of a row's items, after growing/shrinking into `inner_width` */
function row_widths(
  n: LayoutNode,
  items: LayoutNode[],
  inner_width: number,
): number[] {
  const gaps = n.style.gap * (items.length - 1);
  const basis = items.map((item) => {
    const fixed = resolve(item.style.width, inner_width);
    return (
      fixed ??
      viewport_basis(item, false) ??
      measure(item, Math.max(0, inner_width - margin_x(item))).width
    );
  });
  const available =
    inner_width - gaps - items.reduce((sum, item) => sum + margin_x(item), 0);
  return distribute(
    items,
    basis,
    available,
    // items with a fixed width keep it unless they explicitly allow shrinking
    (item) =>
      item.style.shrink ??
      (item.style.width && !item.style.width.percent ? 0 : 1),
    (item) => resolve(item.style.minWidth, inner_width) ?? 0,
    (item) => resolve(item.style.maxWidth, inner_width) ?? Infinity,
  );
}

/** Grows or shrinks `basis` so that it fills `available`, in whole cells */
function distribute(
  items: LayoutNode[],
  basis: number[],
  available: number,
  shrink_of: (item: LayoutNode) => number,
  min_of: (item: LayoutNode) => number,
  max_of: (item: LayoutNode) => number,
): number[] {
  const sizes = basis.map((b, i) =>
    Math.min(Math.max(b, min_of(items[i])), max_of(items[i])),
  );
  let free = available - sizes.reduce((a, b) => a + b, 0);
  const frozen = new Set<number>();

  for (let pass = 0; pass < 4 && Math.abs(free) > 0.001; pass++) {
    const growing = free > 0;
    const weights = items.map((item, i) => {
      if (frozen.has(i)) return 0;
      return growing
        ? item.style.grow
        : shrink_of(item) * Math.max(sizes[i], 1);
    });
    const total = weights.reduce((a, b) => a + b, 0);
    if (total === 0) break;

    let used = 0;
    items.forEach((item, i) => {
      if (weights[i] === 0) return;
      let size = sizes[i] + (free * weights[i]) / total;
      const lo = min_of(item);
      const hi = max_of(item);
      if (size <= lo) {
        size = lo;
        frozen.add(i);
      } else if (size >= hi) {
        size = hi;
        frozen.add(i);
      }
      used += size - sizes[i];
      sizes[i] = size;
    });
    free -= used;
  }

  return round_preserving_sum(sizes);
}

/** Rounds to integers while keeping the (rounded) total */
function round_preserving_sum(values: number[]): number[] {
  const floors = values.map((v) => Math.floor(Math.max(0, v) + 1e-9));
  let remainder =
    Math.round(values.reduce((a, b) => a + Math.max(0, b), 0)) -
    floors.reduce((a, b) => a + b, 0);
  const order = values
    .map((v, i) => ({ i, frac: Math.max(0, v) - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i]++;
    remainder--;
  }
  return floors;
}

function justify_offsets(
  justify: ComputedStyle["justify"],
  free: number,
  count: number,
): { start: number; between: number } {
  if (free <= 0 || count === 0) return { start: 0, between: 0 };
  switch (justify) {
    case "center":
      return { start: Math.floor(free / 2), between: 0 };
    case "end":
      return { start: free, between: 0 };
    case "between":
      return { start: 0, between: count > 1 ? free / (count - 1) : 0 };
    case "around":
      return { start: free / count / 2, between: free / count };
    case "evenly":
      return { start: free / (count + 1), between: free / (count + 1) };
    default:
      return { start: 0, between: 0 };
  }
}

function align_offset(align: ComputedStyle["align"], free: number): number {
  if (free <= 0) return 0;
  if (align === "center") return Math.floor(free / 2);
  if (align === "end") return free;
  return 0;
}

/** Pads each line with the fill character(s) up to the available width */
function fill_lines(n: LayoutNode) {
  const fill = n.style.fill!;
  const fill_width = stringWidth(fill);
  if (fill_width === 0) return;
  for (const line of n.lines) {
    const count = Math.floor((n.inner.width - line.width) / fill_width);
    if (count <= 0) continue;
    line.segments.push({
      text: fill.repeat(count),
      style: n.inherited,
      width: count * fill_width,
    });
    line.width += count * fill_width;
  }
}

/** Positions `n` at `rect` and lays out its descendants */
export function layout(n: LayoutNode, rect: Rect): void {
  n.rect = rect;
  const c = chrome(n.style);
  n.inner = {
    x: rect.x + c.left,
    y: rect.y + c.top,
    width: Math.max(0, rect.width - c.left - c.right),
    height: Math.max(0, rect.height - c.top - c.bottom),
  };

  if (n.text) {
    n.lines = layoutText(n.runs, n.inner.width, n.style.wrap);
    if (n.style.fill) fill_lines(n);
    n.contentWidth = n.lines.reduce(
      (max, line) => Math.max(max, line.width),
      0,
    );
    n.contentHeight = n.lines.length;
    return;
  }

  const inner = n.inner;
  const items = flow(n);
  const s = n.style;
  const gaps = s.gap * Math.max(0, items.length - 1);
  const scroll_x = s.scrollX;
  const scroll_y = s.scrollY;

  if (s.direction === "column") {
    const widths = items.map((item) => {
      const avail = Math.max(0, inner.width - margin_x(item));
      const fixed = resolve(item.style.width, inner.width);
      if (fixed !== undefined)
        return clamp(
          fixed,
          item.style.minWidth,
          item.style.maxWidth,
          inner.width,
        );
      const align = item.style.alignSelf ?? s.align;
      if (align === "stretch")
        return clamp(
          avail,
          item.style.minWidth,
          item.style.maxWidth,
          inner.width,
        );
      return Math.min(measure(item, avail).width, avail);
    });
    const basis = items.map((item, i) => {
      const fixed = resolve(item.style.height, inner.height);
      return (
        fixed ?? viewport_basis(item, true) ?? measure(item, widths[i]).height
      );
    });
    const available =
      inner.height -
      gaps -
      items.reduce((sum, item) => sum + margin_y(item), 0);
    const heights = distribute(
      items,
      basis,
      available,
      (item) => item.style.shrink ?? 0,
      (item) => resolve(item.style.minHeight, inner.height) ?? 0,
      (item) => resolve(item.style.maxHeight, inner.height) ?? Infinity,
    );

    const used =
      heights.reduce((a, b) => a + b, 0) +
      gaps +
      items.reduce((sum, item) => sum + margin_y(item), 0);
    const { start, between } = justify_offsets(
      s.justify,
      inner.height - used,
      items.length,
    );
    let y = inner.y + start - scroll_y;
    let content_width = 0;

    items.forEach((item, i) => {
      const [mt, , mb, ml] = item.style.margin;
      const align = item.style.alignSelf ?? s.align;
      const free = inner.width - margin_x(item) - widths[i];
      const x = inner.x + ml + align_offset(align, free) - scroll_x;
      const top = Math.round(y + mt);
      layout(item, { x, y: top, width: widths[i], height: heights[i] });
      content_width = Math.max(content_width, widths[i] + margin_x(item));
      y += mt + heights[i] + mb + s.gap + (i < items.length - 1 ? between : 0);
    });

    n.contentWidth = content_width;
    n.contentHeight = used;
  } else {
    const widths = row_widths(n, items, inner.width);
    const used =
      widths.reduce((a, b) => a + b, 0) +
      gaps +
      items.reduce((sum, item) => sum + margin_x(item), 0);
    const { start, between } = justify_offsets(
      s.justify,
      inner.width - used,
      items.length,
    );
    let x = inner.x + start - scroll_x;
    let content_height = 0;

    items.forEach((item, i) => {
      const [mt, mr, , ml] = item.style.margin;
      const align = item.style.alignSelf ?? s.align;
      const avail = Math.max(0, inner.height - margin_y(item));
      const fixed = resolve(item.style.height, inner.height);
      let height: number;
      if (fixed !== undefined) height = fixed;
      else if (align === "stretch") height = avail;
      else height = measure(item, widths[i]).height;
      height = clamp(
        height,
        item.style.minHeight,
        item.style.maxHeight,
        inner.height,
      );

      const free = avail - height;
      const y = inner.y + mt + align_offset(align, free) - scroll_y;
      const left = Math.round(x + ml);
      layout(item, { x: left, y, width: widths[i], height });
      content_height = Math.max(content_height, height + margin_y(item));
      x += ml + widths[i] + mr + s.gap + (i < items.length - 1 ? between : 0);
    });

    n.contentWidth = used;
    n.contentHeight = content_height;
  }

  // absolutely positioned children are placed relative to the padding box
  const pb = {
    x: rect.x + (s.border && s.borderSides.left ? 1 : 0),
    y: rect.y + (s.border && s.borderSides.top ? 1 : 0),
    width:
      rect.width -
      (s.border
        ? (s.borderSides.left ? 1 : 0) + (s.borderSides.right ? 1 : 0)
        : 0),
    height:
      rect.height -
      (s.border
        ? (s.borderSides.top ? 1 : 0) + (s.borderSides.bottom ? 1 : 0)
        : 0),
  };

  for (const item of n.children) {
    if (!item.style.absolute) continue;
    const st = item.style;
    const left = resolve(st.left, pb.width);
    const right = resolve(st.right, pb.width);
    const top = resolve(st.top, pb.height);
    const bottom = resolve(st.bottom, pb.height);

    let width = resolve(st.width, pb.width);
    if (width === undefined) {
      width =
        left !== undefined && right !== undefined
          ? Math.max(0, pb.width - left - right)
          : measure(item, Math.max(0, pb.width - (left ?? 0) - (right ?? 0)))
              .width;
    }
    let height = resolve(st.height, pb.height);
    if (height === undefined) {
      height =
        top !== undefined && bottom !== undefined
          ? Math.max(0, pb.height - top - bottom)
          : measure(item, width).height;
    }

    const x =
      pb.x + (left ?? (right !== undefined ? pb.width - right - width : 0));
    const y =
      pb.y + (top ?? (bottom !== undefined ? pb.height - bottom - height : 0));
    layout(item, { x, y, width, height });
  }
}

/** Builds, measures and lays out the tree under `root` */
export function computeLayout(
  root: TElement,
  width: number,
  height: number | undefined,
): LayoutNode | null {
  const tree = build(root);
  if (!tree) return null;
  const h = height ?? measure(tree, width).height;
  layout(tree, { x: 0, y: 0, width, height: h });
  return tree;
}
