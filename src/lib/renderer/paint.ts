/**
 * Paints a laid out tree onto a `Screen`, and records each element's final
 * geometry (used for hit testing and `layout` events).
 */
import { intersect, type Rect } from "./geometry.js";
import type { LayoutNode } from "./layout.js";
import { Screen } from "./screen.js";
import { mergeTextStyle, type TextStyle } from "./style.js";
import { graphemeWidth, graphemes, stringWidth, truncate } from "./text.js";

function record(n: LayoutNode, clip: Rect | null) {
  if (!n.element) return;
  n.element.layout = {
    ...n.rect,
    inner: n.inner,
    contentWidth: n.contentWidth,
    contentHeight: n.contentHeight,
    clip,
  };
  n.element.lines = n.text ? n.lines : null;
}

function write(
  screen: Screen,
  x: number,
  y: number,
  text: string,
  style: TextStyle,
  clip: Rect,
): number {
  for (const g of graphemes(text)) {
    const w = graphemeWidth(g);
    if (w === 0) continue;
    screen.put(x, y, g, w, style, clip);
    x += w;
  }
  return x;
}

function paint_border(n: LayoutNode, screen: Screen, clip: Rect) {
  const s = n.style;
  const b = s.border!;
  const sides = s.borderSides;
  const style = mergeTextStyle(n.inherited, s.borderStyle);
  const { x, y, width, height } = n.rect;
  if (width <= 0 || height <= 0) return;
  const right = x + width - 1;
  const bottom = y + height - 1;

  if (sides.top) {
    for (let i = x; i <= right; i++) screen.put(i, y, b.t, 1, style, clip);
    if (sides.left) screen.put(x, y, b.tl, 1, style, clip);
    if (sides.right) screen.put(right, y, b.tr, 1, style, clip);
  }
  if (sides.bottom) {
    for (let i = x; i <= right; i++) screen.put(i, bottom, b.b, 1, style, clip);
    if (sides.left) screen.put(x, bottom, b.bl, 1, style, clip);
    if (sides.right) screen.put(right, bottom, b.br, 1, style, clip);
  }
  const top = sides.top ? y + 1 : y;
  const end = sides.bottom ? bottom - 1 : bottom;
  for (let j = top; j <= end; j++) {
    if (sides.left) screen.put(x, j, b.l, 1, style, clip);
    if (sides.right) screen.put(right, j, b.r, 1, style, clip);
  }

  if (s.title && sides.top && width > 4) {
    const room = width - 4;
    const title = ` ${truncate(s.title, room - 2)} `;
    const tw = stringWidth(title);
    const offset =
      s.titleAlign === "center"
        ? Math.floor((width - tw) / 2)
        : s.titleAlign === "right"
          ? width - tw - 2
          : 2;
    write(screen, x + offset, y, title, { ...style, bold: true }, clip);
  }
}

function write_chars(
  screen: Screen,
  x: number,
  y: number,
  chars: string[],
  style: TextStyle,
  clip: Rect,
): number {
  for (const g of chars) {
    const w = graphemeWidth(g);
    if (w === 0) continue;
    screen.put(x, y, g, w, style, clip);
    x += w;
  }
  return x;
}

function paint_text(n: LayoutNode, screen: Screen, clip: Rect) {
  const inner = n.inner;
  const lines = n.lines;
  // only the rows that are both inside the text box and visible
  const first = Math.max(0, clip.y - inner.y);
  const last = Math.min(
    lines.length,
    inner.height,
    clip.y + clip.height - inner.y,
  );
  for (let row = first; row < last; row++) {
    const line = lines[row];
    const y = inner.y + row;
    const free = inner.width - line.width;
    let x =
      n.style.textAlign === "center"
        ? inner.x + Math.max(0, Math.floor(free / 2))
        : n.style.textAlign === "right"
          ? inner.x + Math.max(0, free)
          : inner.x;
    for (const segment of line.segments)
      x = segment.chars
        ? write_chars(screen, x, y, segment.chars, segment.style, clip)
        : write(screen, x, y, segment.text, segment.style, clip);
  }
}

export function paint(n: LayoutNode, screen: Screen, clip: Rect): void {
  const visible = intersect(n.rect, clip);
  record(n, visible);

  if (!visible) {
    // still record geometry for descendants, so stale layouts don't linger
    for (const child of n.children)
      paint(child, screen, { x: 0, y: 0, width: 0, height: 0 });
    return;
  }

  const s = n.style;

  if (s.bg !== undefined) screen.fill(visible, s.bg);

  if (s.border) paint_border(n, screen, visible);

  if (n.text) {
    paint_text(
      n,
      screen,
      intersect(n.inner, visible) ?? { x: 0, y: 0, width: 0, height: 0 },
    );
    return;
  }

  // children are clipped to the padding box (inside the border)
  const b = s.border;
  const sides = s.borderSides;
  const padding_box = {
    x: n.rect.x + (b && sides.left ? 1 : 0),
    y: n.rect.y + (b && sides.top ? 1 : 0),
    width:
      n.rect.width - (b ? (sides.left ? 1 : 0) + (sides.right ? 1 : 0) : 0),
    height:
      n.rect.height - (b ? (sides.top ? 1 : 0) + (sides.bottom ? 1 : 0) : 0),
  };
  const child_clip = intersect(padding_box, visible) ?? {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };

  for (const child of n.children)
    if (!child.style.absolute) paint(child, screen, child_clip);
  for (const child of n.children)
    if (child.style.absolute) paint(child, screen, child_clip);
}

/** Paints the tree onto a new screen of the given size */
export function paintScreen(
  tree: LayoutNode | null,
  width: number,
  height: number,
): Screen {
  const screen = new Screen(width, height);
  if (tree) paint(tree, screen, { x: 0, y: 0, width, height });
  return screen;
}
