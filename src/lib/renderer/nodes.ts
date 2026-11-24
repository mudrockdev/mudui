/**
 * The node tree that Svelte's custom renderer builds. It is a tiny, DOM-like
 * structure (doubly linked children) with no knowledge of terminals; layout and
 * painting read from it, and every mutation notifies the root so that a new
 * frame can be scheduled.
 */

import type { Rect } from "./geometry.js";
import type { ComputedStyle } from "./style.js";
import type { TextLine } from "./text.js";

export type Listener = (event: any) => unknown;

export type TNode = TElement | TText | TComment | TFragment;

let next_id = 1;

abstract class TNodeBase {
  readonly id = next_id++;
  parent: TContainer | null = null;
  prev: TChild | null = null;
  next: TChild | null = null;

  /** The top-most ancestor (or the node itself) */
  get top(): TNode {
    let node: TNodeBase = this;
    while (node.parent) node = node.parent;
    return node as TNode;
  }

  /** Whether this node is attached to a mounted root */
  get connected(): boolean {
    return this.top instanceof TRoot;
  }

  /** Called whenever this subtree changes */
  protected invalidate(): void {
    const top = this.top;
    if (top instanceof TRoot) top.onchange?.();
  }
}

export abstract class TContainer extends TNodeBase {
  first: TChild | null = null;
  last: TChild | null = null;

  *children(): IterableIterator<TChild> {
    for (let node = this.first; node; node = node.next) yield node;
  }

  insertBefore(node: TNode, anchor: TChild | null): void {
    if (node instanceof TFragment) {
      // inserting a fragment moves all of its children
      let child = node.first;
      while (child) {
        const next: TChild | null = child.next;
        this.insertBefore(child, anchor);
        child = next;
      }
      return;
    }

    if (anchor && anchor.parent !== this) {
      throw new Error("mudui: anchor is not a child of the parent");
    }

    node.parent?.removeChild(node);

    node.parent = this;
    node.next = anchor;
    node.prev = anchor ? anchor.prev : this.last;

    if (node.prev) node.prev.next = node;
    else this.first = node;

    if (anchor) anchor.prev = node;
    else this.last = node;

    this.invalidate();
  }

  removeChild(node: TChild): void {
    if (node.parent !== this) return;

    if (node.prev) node.prev.next = node.next;
    else this.first = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.last = node.prev;

    node.parent = node.prev = node.next = null;
    this.invalidate();
  }
}

export class TFragment extends TContainer {
  readonly kind = "fragment";
}

export interface LayoutBox extends Rect {
  /** The area children are laid out in (inside border and padding) */
  inner: Rect;
  /** Total size of the in-flow content, which may exceed `inner` when it overflows */
  contentWidth: number;
  contentHeight: number;
  /** The visible area after clipping by ancestors (null if fully hidden) */
  clip: Rect | null;
}

export class TElement extends TContainer {
  readonly kind = "element";
  readonly name: string;
  readonly attributes = new Map<string, unknown>();
  readonly listeners = new Map<string, Set<Listener>>();

  /** Computed by the layout pass */
  layout: LayoutBox | null = null;
  /** Wrapped lines, computed by the layout pass for `<txt>` */
  lines: TextLine[] | null = null;

  /** Bumped whenever an attribute changes, used to cache parsed styles */
  version = 0;
  /** Parsed styles for `version` (internal, managed by `computeStyle`) */
  computed: {
    version: number;
    style: ComputedStyle;
    attrs: Map<string, unknown>;
  } | null = null;

  constructor(name: string) {
    super();
    this.name = name;
  }

  getAttribute(name: string): unknown {
    return this.attributes.get(name);
  }

  setAttribute(name: string, value: unknown): void {
    if (this.attributes.get(name) === value && this.attributes.has(name))
      return;
    this.attributes.set(name, value);
    this.version++;
    this.invalidate();
  }

  removeAttribute(name: string): void {
    if (this.attributes.delete(name)) {
      this.version++;
      this.invalidate();
    }
  }

  addEventListener(type: string, listener: Listener): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(listener);
  }

  removeEventListener(type: string, listener: Listener): void {
    this.listeners.get(type)?.delete(listener);
  }

  hasListener(type: string): boolean {
    return (this.listeners.get(type)?.size ?? 0) > 0;
  }

  /** Concatenated text of all descendant text nodes */
  get textContent(): string {
    let out = "";
    for (const child of this.children()) {
      if (child instanceof TText) out += child.data;
      else if (child instanceof TElement) out += child.textContent;
    }
    return out;
  }

  /** All descendant elements in tree order (a snapshot, taken when iteration starts) */
  *descendants(): IterableIterator<TElement> {
    const out: TElement[] = [];
    collectElements(this, out);
    yield* out;
  }

  /** Called by attachments etc. to request a new frame after out-of-band changes */
  requestRender(): void {
    this.invalidate();
  }
}

/** The root of a mounted app; owns the change notification */
export class TRoot extends TElement {
  onchange: (() => void) | null = null;

  constructor() {
    super("root");
  }
}

export class TText extends TNodeBase {
  readonly kind = "text";
  #data: string;

  constructor(data: string) {
    super();
    this.#data = data;
  }

  get data(): string {
    return this.#data;
  }

  set data(value: string) {
    if (value === this.#data) return;
    this.#data = value;
    this.invalidate();
  }
}

export class TComment extends TNodeBase {
  readonly kind = "comment";
  constructor(public data: string) {
    super();
  }
}

export type TChild = TElement | TText | TComment;

/** Appends the descendant elements of `element` to `out`, in tree order */
export function collectElements(element: TElement, out: TElement[]): void {
  for (let child = element.first; child; child = child.next) {
    if (child instanceof TElement) {
      out.push(child);
      collectElements(child, out);
    }
  }
}
