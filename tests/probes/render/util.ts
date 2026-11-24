import { TElement, TRoot, TText } from "../../../src/lib/renderer/nodes.ts";
import { computeLayout } from "../../../src/lib/renderer/layout.ts";
import { paintScreen } from "../../../src/lib/renderer/paint.ts";
import type { Screen } from "../../../src/lib/renderer/screen.ts";

type Child = TElement | string;

export function el(
  name: string,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): TElement {
  const e = new TElement(name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  for (const c of children)
    e.insertBefore(typeof c === "string" ? new TText(c) : c, null);
  return e;
}

export function root(...children: Child[]): TRoot {
  const r = new TRoot();
  for (const c of children)
    r.insertBefore(typeof c === "string" ? new TText(c) : c, null);
  return r;
}

export function paintRoot(r: TElement, width: number, height: number): Screen {
  return paintScreen(computeLayout(r, width, height), width, height);
}

export function draw(r: TElement, width: number, height: number): string {
  return paintRoot(r, width, height).toString();
}

/** Every cell (char, width, fg, bg, attrs) as a comparable string */
export function cells(s: Screen): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.width * s.height; i++)
    out.push(
      `${s.chars[i]}|${s.widths[i]}|${s.fg[i]}|${s.bg[i]}|${s.attrs[i]}`,
    );
  return out;
}
