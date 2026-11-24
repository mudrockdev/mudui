/**
 * The app runtime: mounts a component with the mudui renderer, turns tree
 * changes into frames, and routes terminal input to elements as events.
 */
import { flushSync, mount, unmount, type Component } from "svelte";
import { createSubscriber } from "svelte/reactivity";
import { contains } from "../renderer/geometry.js";
import { computeLayout } from "../renderer/layout.js";
import { TElement, TRoot } from "../renderer/nodes.js";
import { paintScreen } from "../renderer/paint.js";
import renderer from "../renderer/index.js";
import { Screen } from "../renderer/screen.js";
import { computeStyle, normalizedAttributes } from "../renderer/style.js";
import { APP_KEY } from "./context.js";
import {
  FocusEvent,
  KeyEvent,
  LayoutEvent,
  MouseEvent,
  PasteEvent,
  WheelEvent,
  dispatchEvent,
} from "./events.js";
import { InputParser, type InputEvent, type KeyInput } from "./input.js";
import { NodeTerminal, type Terminal } from "./terminal.js";

export interface RenderOptions<
  Props extends Record<string, any> = Record<string, any>,
> {
  props?: Props;
  /** Extra context made available to the component tree */
  context?: Map<any, any>;
  /** Where to render. Defaults to the process' stdin/stdout */
  terminal?: Terminal;
  /** Use the alternate screen and fill the whole terminal (default `true`) */
  fullscreen?: boolean;
  /** Report mouse clicks and the wheel (default: same as `fullscreen`) */
  mouse?: boolean;
  /** Exit when ctrl+c is pressed and not prevented (default `true`) */
  exitOnCtrlC?: boolean;
  /** Maximum frames per second (default 60) */
  fps?: number;
  /** `auto` renders frames when things change, `manual` only when `render()` is called (default `auto`) */
  scheduler?: "auto" | "manual";
  /** Restore the terminal and exit on uncaught errors (default: `true` for the real terminal) */
  handleErrors?: boolean;
}

type KeyHandler = (event: KeyEvent) => void;

class TerminalSize {
  #app: App;
  #subscribe: () => void;

  constructor(app: App) {
    this.#app = app;
    this.#subscribe = createSubscriber((update) => app.onResize(update));
  }

  get columns(): number {
    this.#subscribe();
    return this.#app.terminal.columns;
  }

  get rows(): number {
    this.#subscribe();
    return this.#app.terminal.rows;
  }
}

export class App {
  readonly root = new TRoot();
  readonly terminal: Terminal;
  readonly fullscreen: boolean;
  readonly mouse: boolean;
  /** Reactive terminal size, for use in components */
  readonly size: TerminalSize;

  /** The last painted screen */
  screen: Screen = new Screen(0, 0);
  focused: TElement | null = null;

  #options: RenderOptions<any>;
  #component: Record<string, any> | null = null;
  #parser = new InputParser();
  #cleanup: Array<() => void> = [];
  #key_handlers = new Set<KeyHandler>();
  #resize_handlers = new Set<() => void>();

  #dirty = true;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #last_frame = 0;
  #rendering = false;
  #previous: Screen | null = null;
  #inline_frame = "";
  #inline_height = 0;

  #autofocused = new WeakSet<TElement>();
  #trap: TElement | null = null;
  #before_trap: TElement | null = null;
  /** Recently focused elements, most recent last */
  #history: TElement[] = [];
  #layout_sizes = new WeakMap<TElement, string>();

  #exited = false;
  #exit_promise: Promise<void>;
  #resolve_exit!: () => void;
  #reject_exit!: (error: unknown) => void;
  #awaited = false;

  constructor(
    component: Component<any, any, any>,
    options: RenderOptions<any> = {},
  ) {
    this.#options = options;
    this.terminal = options.terminal ?? new NodeTerminal();
    this.fullscreen = options.fullscreen ?? true;
    this.mouse = options.mouse ?? this.fullscreen;
    this.size = new TerminalSize(this);

    this.#exit_promise = new Promise((resolve, reject) => {
      this.#resolve_exit = resolve;
      this.#reject_exit = reject;
    });
    this.#exit_promise.catch(() => {});

    this.root.onchange = () => {
      this.#dirty = true;
      this.#schedule();
    };

    this.terminal.setup({ fullscreen: this.fullscreen, mouse: this.mouse });

    if (this.terminal instanceof NodeTerminal) {
      // raw mode turns ctrl+c into a key, but other signals still need a clean exit
      const on_signal = () => this.exit();
      for (const signal of ["SIGTERM", "SIGHUP"] as const)
        process.on(signal, on_signal);
      this.#cleanup.push(() => {
        for (const signal of ["SIGTERM", "SIGHUP"] as const)
          process.off(signal, on_signal);
      });
    }

    const handle_errors =
      options.handleErrors ?? this.terminal instanceof NodeTerminal;
    if (handle_errors) {
      const on_error = (error: unknown) => this.#crash(error);
      process.on("uncaughtException", on_error);
      process.on("unhandledRejection", on_error);
      this.#cleanup.push(() => {
        process.off("uncaughtException", on_error);
        process.off("unhandledRejection", on_error);
      });
    }

    this.#cleanup.push(
      this.terminal.onData((data) => this.#on_data(data)),
      this.terminal.onResize(() => this.#on_resize()),
    );

    const context = new Map(options.context ?? []);
    context.set(APP_KEY, this);

    try {
      this.#component = mount<
        Record<string, any>,
        Record<string, any>,
        typeof renderer
      >(component, {
        target: this.root,
        renderer,
        props: options.props ?? {},
        context,
      });
      this.render();
    } catch (error) {
      this.exit(error);
      throw error;
    }
  }

  /** Lays out and paints the tree, writing the changes to the terminal */
  render(): void {
    if (this.#exited || this.#rendering) return;
    this.#rendering = true;

    try {
      for (let i = 0; i < 10; i++) {
        flushSync();
        this.#dirty = false;
        this.#frame();
        this.#after_frame();
        flushSync();
        if (!this.#dirty) break;
      }
    } finally {
      this.#rendering = false;
      this.#last_frame = performance.now();
    }
  }

  #schedule() {
    if (this.#exited || this.#timer || this.#rendering) return;
    if ((this.#options.scheduler ?? "auto") === "manual") return;

    const interval = 1000 / (this.#options.fps ?? 60);
    const wait = Math.max(0, this.#last_frame + interval - performance.now());
    this.#timer = setTimeout(() => {
      this.#timer = null;
      try {
        this.render();
      } catch (error) {
        this.#crash(error);
      }
    }, wait);
  }

  #frame() {
    const { columns, rows } = this.terminal;
    const tree = computeLayout(
      this.root,
      columns,
      this.fullscreen ? rows : undefined,
    );
    const height = this.fullscreen
      ? rows
      : Math.min(rows, tree?.rect.height ?? 0);
    const screen = paintScreen(tree, columns, height);
    const depth = this.terminal.colorDepth;

    if (this.fullscreen) {
      const out = screen.diff(this.#previous, depth);
      if (out) this.terminal.write(out);
    } else {
      const lines: string[] = [];
      for (let y = 0; y < screen.height; y++)
        lines.push(screen.ansiLine(y, depth));
      const frame = lines.join("\x1b[K\n") + "\x1b[K";
      if (frame !== this.#inline_frame) {
        let out =
          this.#inline_height > 1 ? `\x1b[${this.#inline_height - 1}F` : "\r";
        out += frame;
        if (screen.height < this.#inline_height) out += "\x1b[J";
        this.terminal.write(out);
        this.#inline_frame = frame;
        this.#inline_height = screen.height;
      }
    }

    this.#previous = screen;
    this.screen = screen;
  }

  #after_frame() {
    // focus: drop focus from removed/hidden elements, honor traps and autofocus
    let lost = false;
    if (this.focused && !this.#can_focus(this.focused)) {
      this.focused = null;
      lost = true;
    }

    const trap = this.#find_trap();
    if (trap !== this.#trap) {
      if (trap && !this.#trap) this.#before_trap = this.focused;
      const restore = !trap ? this.#before_trap : null;
      this.#trap = trap;
      if (!trap) {
        this.#before_trap = null;
        if (restore && this.#can_focus(restore)) {
          this.focus(restore);
          lost = false;
        }
      }
    }

    const scope = this.#trap ?? this.root;
    if (this.focused && !is_inside(this.focused, scope)) this.blur();

    // when the focused element went away, go back to the last one that's still around
    if (lost && !this.focused) {
      for (let i = this.#history.length - 1; i >= 0; i--) {
        const candidate = this.#history[i];
        if (this.#can_focus(candidate) && is_inside(candidate, scope)) {
          this.focus(candidate);
          break;
        }
      }
    }

    // an element with `autofocus` takes focus the first time it is rendered
    // (the first one wins if several appear at once)
    let autofocus: TElement | null = null;
    for (const element of this.root.descendants()) {
      if (!element.layout || this.#autofocused.has(element)) continue;
      const attrs = normalizedAttributes(element);
      if (
        attrs.has("autofocus") &&
        attrs.get("autofocus") !== false &&
        this.#is_focusable(element)
      ) {
        this.#autofocused.add(element);
        if (!autofocus && is_inside(element, scope)) autofocus = element;
      }
    }
    if (autofocus) this.focus(autofocus);
    if (!this.focused && this.#trap) this.focusNext();

    // layout events
    for (const element of this.root.descendants()) {
      if (!element.hasListener("layout") || !element.layout) continue;
      const l = element.layout;
      const key = `${l.x},${l.y},${l.width},${l.height},${l.contentWidth},${l.contentHeight}`;
      if (this.#layout_sizes.get(element) === key) continue;
      this.#layout_sizes.set(element, key);
      dispatchEvent(
        element,
        new LayoutEvent(
          l.width,
          l.height,
          l.contentWidth,
          l.contentHeight,
          l.x,
          l.y,
        ),
      );
    }
  }

  #find_trap(): TElement | null {
    let trap: TElement | null = null;
    for (const element of this.root.descendants()) {
      if (!element.layout) continue;
      const value = normalizedAttributes(element).get("trapfocus");
      if (value !== undefined && value !== false) trap = element;
    }
    return trap;
  }

  /** Connected, rendered and focusable */
  #can_focus(element: TElement): boolean {
    return element.connected && !!element.layout && this.#is_focusable(element);
  }

  #is_focusable(element: TElement): boolean {
    const style = computeStyle(element);
    if (!style.focusable) return false;
    const disabled = normalizedAttributes(element).get("disabled");
    return disabled === undefined || disabled === false;
  }

  /** Focusable elements in tree order, within the current focus trap */
  focusable(): TElement[] {
    const scope = this.#trap ?? this.root;
    const out: TElement[] = [];
    for (const element of scope.descendants()) {
      if (element.layout && this.#is_focusable(element)) out.push(element);
    }
    return out;
  }

  focus(element: TElement | null): void {
    if (element === this.focused) return;
    const previous = this.focused;
    this.focused = element;
    if (element) {
      this.#history = this.#history.filter((e) => e !== element && e.connected);
      this.#history.push(element);
      if (this.#history.length > 32) this.#history.shift();
    }
    if (previous?.connected) {
      dispatchEvent(previous, new FocusEvent("blur", element));
      dispatchEvent(previous, new FocusEvent("focusout", element));
    }
    if (element) {
      dispatchEvent(element, new FocusEvent("focus", previous));
      dispatchEvent(element, new FocusEvent("focusin", previous));
    }
    this.#dirty = true;
    this.#schedule();
  }

  blur(): void {
    this.focus(null);
  }

  focusNext(): void {
    this.#move_focus(1);
  }

  focusPrevious(): void {
    this.#move_focus(-1);
  }

  #move_focus(direction: 1 | -1) {
    const list = this.focusable();
    if (list.length === 0) return;
    const index = this.focused ? list.indexOf(this.focused) : -1;
    const next =
      index === -1
        ? direction === 1
          ? 0
          : list.length - 1
        : (index + direction + list.length) % list.length;
    this.focus(list[next]);
  }

  /** The deepest element at the given cell */
  hitTest(x: number, y: number): TElement | null {
    const visit = (element: TElement): TElement | null => {
      const clip = element.layout?.clip;
      if (!clip || !contains(clip, x, y)) return null;
      const children = [...element.children()].filter(
        (c): c is TElement => c instanceof TElement,
      );
      const ordered = [
        ...children.filter((c) => computeStyle(c).absolute).reverse(),
        ...children.filter((c) => !computeStyle(c).absolute).reverse(),
      ];
      for (const child of ordered) {
        const hit = visit(child);
        if (hit) return hit;
      }
      return element;
    };
    return visit(this.root);
  }

  /** Registers a key handler that runs after the event bubbled through the tree */
  onKey(handler: KeyHandler): () => void {
    this.#key_handlers.add(handler);
    return () => this.#key_handlers.delete(handler);
  }

  onResize(handler: () => void): () => void {
    this.#resize_handlers.add(handler);
    return () => this.#resize_handlers.delete(handler);
  }

  #on_data(data: string) {
    if (this.#exited) return;
    try {
      for (const event of this.#parser.feed(data)) this.dispatchInput(event);
    } catch (error) {
      this.#crash(error);
    }
  }

  #on_resize() {
    this.#previous = null;
    if (this.fullscreen) this.terminal.write("\x1b[2J");
    for (const handler of [...this.#resize_handlers]) handler();
    this.#dirty = true;
    this.#schedule();
  }

  /** Routes a parsed input event into the tree */
  dispatchInput(input: InputEvent): void {
    if (input.kind === "key") return this.#key(input);

    if (input.kind === "paste") {
      dispatchEvent(this.focused ?? this.root, new PasteEvent(input.text));
      return;
    }

    const target = this.hitTest(input.x, input.y) ?? this.root;

    if (input.action === "wheelup" || input.action === "wheeldown") {
      dispatchEvent(target, new WheelEvent(input));
      return;
    }

    if (input.action === "press") {
      if (input.button === "left") {
        let focusable: TElement | null = target;
        while (
          focusable &&
          !(focusable.layout && this.#is_focusable(focusable))
        ) {
          focusable =
            focusable.parent instanceof TElement ? focusable.parent : null;
        }
        if (focusable && (!this.#trap || is_inside(focusable, this.#trap)))
          this.focus(focusable);
      }
      dispatchEvent(target, new MouseEvent("mousedown", input));
      if (input.button === "left")
        dispatchEvent(target, new MouseEvent("click", input));
    } else if (input.action === "release") {
      dispatchEvent(target, new MouseEvent("mouseup", input));
    } else {
      dispatchEvent(target, new MouseEvent("mousemove", input));
    }
  }

  #key(input: KeyInput) {
    const event = new KeyEvent("keydown", input);
    dispatchEvent(this.focused ?? this.root, event);

    if (!event.propagationStopped) {
      // most recently registered first, so that e.g. a modal can shadow the app's shortcuts
      for (const handler of [...this.#key_handlers].reverse()) {
        handler(event);
        if (event.propagationStopped) break;
      }
    }

    if (event.defaultPrevented) return;

    if (event.key === "Tab" && !event.ctrl && !event.alt) {
      if (event.shift) this.focusPrevious();
      else this.focusNext();
    } else if (
      event.ctrl &&
      event.key === "c" &&
      (this.#options.exitOnCtrlC ?? true)
    ) {
      this.exit();
    }
  }

  #crash(error: unknown) {
    const awaited = this.#awaited;
    this.exit(error);
    if (!awaited) {
      console.error(error);
      process.exit(1);
    }
  }

  /** Unmounts the component, restores the terminal and resolves `waitUntilExit()` */
  exit(error?: unknown): void {
    if (this.#exited) return;

    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }

    // paint the final state (relevant for inline apps, which stay on screen)
    if (!error) {
      try {
        this.render();
      } catch {
        // ignore
      }
    }

    this.#exited = true;
    for (const fn of this.#cleanup) fn();
    this.#cleanup = [];

    if (this.#component) {
      try {
        unmount(this.#component);
      } catch {
        // ignore errors during teardown
      }
      this.#component = null;
    }
    this.root.onchange = null;

    if (!this.fullscreen && this.#inline_height > 0) this.terminal.write("\n");
    this.terminal.restore();

    if (error) this.#reject_exit(error);
    else this.#resolve_exit();
  }

  get exited(): boolean {
    return this.#exited;
  }

  /** Resolves when the app exits (rejects if it exited because of an error) */
  waitUntilExit(): Promise<void> {
    this.#awaited = true;
    return this.#exit_promise;
  }
}

function is_inside(element: TElement, ancestor: TElement): boolean {
  for (
    let node: TElement | null = element;
    node;
    node = node.parent as TElement | null
  ) {
    if (node === ancestor) return true;
  }
  return false;
}

/** Mounts `component` in the terminal */
export function render<Props extends Record<string, any>>(
  component: Component<Props, any, any>,
  options: RenderOptions<Props> = {},
): App {
  return new App(component, options);
}
