/**
 * DOM-like events dispatched through the mudui element tree.
 */
import type { TElement } from "../renderer/nodes.js";
import type { KeyInput, MouseInput } from "./input.js";

export class TuiEvent {
  readonly type: string;
  readonly bubbles: boolean;
  target: TElement | null = null;
  currentTarget: TElement | null = null;
  defaultPrevented = false;
  #stopped = false;
  #stopped_immediate = false;

  constructor(type: string, bubbles = true) {
    this.type = type;
    this.bubbles = bubbles;
  }

  preventDefault(): void {
    this.defaultPrevented = true;
  }

  stopPropagation(): void {
    this.#stopped = true;
  }

  stopImmediatePropagation(): void {
    this.#stopped = true;
    this.#stopped_immediate = true;
  }

  get propagationStopped(): boolean {
    return this.#stopped;
  }

  get immediatePropagationStopped(): boolean {
    return this.#stopped_immediate;
  }
}

export class KeyEvent extends TuiEvent {
  readonly key: string;
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;
  readonly meta: boolean;
  readonly sequence: string;

  constructor(type: string, input: KeyInput) {
    super(type);
    this.key = input.key;
    this.ctrl = input.ctrl;
    this.alt = input.alt;
    this.shift = input.shift;
    this.meta = input.meta;
    this.sequence = input.sequence;
  }

  // DOM-style aliases
  get ctrlKey() {
    return this.ctrl;
  }
  get altKey() {
    return this.alt;
  }
  get shiftKey() {
    return this.shift;
  }
  get metaKey() {
    return this.meta;
  }

  /** Whether this is a printable character without ctrl/alt/meta */
  get printable(): boolean {
    return (
      !this.ctrl &&
      !this.alt &&
      !this.meta &&
      [...this.key].length === 1 &&
      this.key >= " "
    );
  }

  /** Matches a description like `'q'`, `'ctrl+s'` or `'shift+Tab'` */
  is(description: string): boolean {
    const parts = description.split("+");
    let name = parts.pop()!;
    if (name === "" && description.endsWith("+")) name = "+";
    const mods = new Set(parts.map((p) => p.toLowerCase()));
    if (name.toLowerCase() === "space") name = " ";
    if (this.key.toLowerCase() !== name.toLowerCase()) return false;

    if (name.length === 1) {
      // for letters, shift is implied by an uppercase description (`'G'` = `'shift+g'`)
      const shift = mods.has("shift") || name !== name.toLowerCase();
      if (/\p{L}/u.test(name) && shift !== this.shift) return false;
    } else if (mods.has("shift") !== this.shift) {
      return false;
    }

    return (
      mods.has("ctrl") === this.ctrl &&
      mods.has("alt") === this.alt &&
      mods.has("meta") === this.meta
    );
  }
}

export class MouseEvent extends TuiEvent {
  readonly x: number;
  readonly y: number;
  readonly button: MouseInput["button"];
  readonly ctrl: boolean;
  readonly alt: boolean;
  readonly shift: boolean;

  constructor(type: string, input: MouseInput) {
    super(type);
    this.x = input.x;
    this.y = input.y;
    this.button = input.button;
    this.ctrl = input.ctrl;
    this.alt = input.alt;
    this.shift = input.shift;
  }

  /** Coordinates relative to `currentTarget`'s top-left corner */
  get localX(): number {
    return this.x - (this.currentTarget?.layout?.x ?? 0);
  }
  get localY(): number {
    return this.y - (this.currentTarget?.layout?.y ?? 0);
  }
}

export class WheelEvent extends MouseEvent {
  /** `-1` when scrolling up, `1` when scrolling down */
  readonly deltaY: number;

  constructor(input: MouseInput) {
    super("wheel", input);
    this.deltaY = input.action === "wheelup" ? -1 : 1;
  }
}

export class PasteEvent extends TuiEvent {
  constructor(readonly text: string) {
    super("paste");
  }
}

export class FocusEvent extends TuiEvent {
  constructor(
    type: "focus" | "blur" | "focusin" | "focusout",
    readonly relatedTarget: TElement | null,
  ) {
    super(type, type === "focusin" || type === "focusout");
  }
}

export class LayoutEvent extends TuiEvent {
  constructor(
    readonly width: number,
    readonly height: number,
    readonly contentWidth: number,
    readonly contentHeight: number,
    readonly x: number,
    readonly y: number,
  ) {
    super("layout", false);
  }
}

/**
 * Dispatches `event` at `target`, bubbling up through its ancestors if the event
 * bubbles. Returns `false` if the default was prevented.
 */
export function dispatchEvent(target: TElement, event: TuiEvent): boolean {
  event.target = target;

  for (
    let node: TElement | null = target;
    node;
    node = node.parent as TElement | null
  ) {
    if (node.kind !== "element") break;
    const listeners = node.listeners.get(event.type);
    if (listeners && listeners.size > 0) {
      event.currentTarget = node;
      for (const listener of [...listeners]) {
        listener.call(node, event);
        if (event.immediatePropagationStopped) break;
      }
    }
    if (!event.bubbles || event.propagationStopped) break;
  }

  event.currentTarget = null;
  return !event.defaultPrevented;
}
