/**
 * Terminal I/O backends: the real terminal (stdin/stdout), and an in-memory
 * one for tests and headless rendering.
 */
import type { ColorDepth } from "../renderer/screen.js";

export interface TerminalSetup {
  fullscreen: boolean;
  mouse: boolean;
}

export interface Terminal {
  readonly columns: number;
  readonly rows: number;
  readonly colorDepth: ColorDepth;
  write(data: string): void;
  /** Subscribes to raw input. Returns an unsubscribe function. */
  onData(listener: (data: string) => void): () => void;
  /** Subscribes to size changes. Returns an unsubscribe function. */
  onResize(listener: () => void): () => void;
  /**
   * Subscribes to the terminal going away (hangup, closed input or output).
   * Returns an unsubscribe function.
   */
  onClose?(listener: () => void): () => void;
  /** Prepares the terminal (raw mode, alternate screen, mouse reporting, ...) */
  setup(options: TerminalSetup): void;
  /** Undoes `setup` */
  restore(): void;
}

const ESC = "\x1b[";

export const sequences = {
  altScreenOn: `${ESC}?1049h`,
  altScreenOff: `${ESC}?1049l`,
  hideCursor: `${ESC}?25l`,
  showCursor: `${ESC}?25h`,
  clear: `${ESC}2J${ESC}H`,
  mouseOn: `${ESC}?1000h${ESC}?1002h${ESC}?1006h`,
  mouseOff: `${ESC}?1006l${ESC}?1002l${ESC}?1000l`,
  pasteOn: `${ESC}?2004h`,
  pasteOff: `${ESC}?2004l`,
  reset: `${ESC}0m`,
};

function detect_color_depth(
  env: Record<string, string | undefined>,
  is_tty: boolean,
): ColorDepth {
  if ("NO_COLOR" in env && env.NO_COLOR !== "") return "none";
  if (env.FORCE_COLOR === "0") return "none";
  if (env.COLORTERM === "truecolor" || env.COLORTERM === "24bit")
    return "truecolor";
  if (/^(xterm-kitty|xterm-ghostty|wezterm|alacritty)$/.test(env.TERM ?? ""))
    return "truecolor";
  if (
    env.TERM_PROGRAM === "iTerm.app" ||
    env.TERM_PROGRAM === "vscode" ||
    env.WT_SESSION
  )
    return "truecolor";
  if (/256/.test(env.TERM ?? "")) return "256";
  if (!is_tty && !env.FORCE_COLOR) return "none";
  return "16";
}

type ReadStream = NodeJS.ReadStream;
type WriteStream = NodeJS.WriteStream;

export interface NodeTerminalOptions {
  stdin?: ReadStream;
  stdout?: WriteStream;
  colorDepth?: ColorDepth;
}

/** The real terminal, via Node-compatible streams (works in Bun and Node) */
export class NodeTerminal implements Terminal {
  readonly stdin: ReadStream;
  readonly stdout: WriteStream;
  readonly colorDepth: ColorDepth;
  #options: TerminalSetup | null = null;
  #was_raw = false;
  #restore_on_exit = () => this.restore();
  /** Set once the terminal is gone (e.g. its window closed): writes would fail */
  #closed = false;
  #close_listeners = new Set<() => void>();
  #on_close = () => {
    if (this.#closed) return;
    this.#closed = true;
    for (const listener of [...this.#close_listeners]) listener();
  };

  constructor(options: NodeTerminalOptions = {}) {
    this.stdin = options.stdin ?? process.stdin;
    this.stdout = options.stdout ?? process.stdout;
    this.colorDepth =
      options.colorDepth ??
      detect_color_depth(process.env, !!this.stdout.isTTY);
  }

  get columns(): number {
    return this.stdout.columns || 80;
  }

  get rows(): number {
    return this.stdout.rows || 24;
  }

  write(data: string): void {
    if (this.#closed) return;
    try {
      this.stdout.write(data);
    } catch {
      // EIO / EPIPE: the terminal is gone
      this.#on_close();
    }
  }

  onData(listener: (data: string) => void): () => void {
    const handler = (chunk: Buffer | string) => listener(chunk.toString());
    this.stdin.on("data", handler);
    return () => this.stdin.off("data", handler);
  }

  onClose(listener: () => void): () => void {
    if (this.#close_listeners.size === 0) {
      this.stdin.on("end", this.#on_close);
      this.stdin.on("error", this.#on_close);
      this.stdout.on("error", this.#on_close);
    }
    this.#close_listeners.add(listener);
    return () => {
      this.#close_listeners.delete(listener);
      if (this.#close_listeners.size > 0) return;
      this.stdin.off("end", this.#on_close);
      this.stdin.off("error", this.#on_close);
      this.stdout.off("error", this.#on_close);
    };
  }

  onResize(listener: () => void): () => void {
    this.stdout.on("resize", listener);
    return () => this.stdout.off("resize", listener);
  }

  setup(options: TerminalSetup): void {
    this.#options = options;
    if (this.stdin.isTTY) {
      this.#was_raw = this.stdin.isRaw;
      this.stdin.setRawMode(true);
    }
    this.stdin.setEncoding("utf8");
    this.stdin.resume();

    let out = sequences.hideCursor + sequences.pasteOn;
    if (options.fullscreen) out = sequences.altScreenOn + sequences.clear + out;
    if (options.mouse) out += sequences.mouseOn;
    this.write(out);

    process.on("exit", this.#restore_on_exit);
  }

  restore(): void {
    const options = this.#options;
    if (!options) return;
    this.#options = null;
    process.off("exit", this.#restore_on_exit);

    let out = sequences.reset + sequences.pasteOff + sequences.showCursor;
    if (options.mouse) out += sequences.mouseOff;
    if (options.fullscreen) out += sequences.altScreenOff;
    this.write(out);

    // after a hangup the tty is gone and these fail (EIO); still stop reading,
    // or the process keeps polling a dead terminal
    try {
      if (this.stdin.isTTY && !this.#closed) this.stdin.setRawMode(this.#was_raw);
    } catch {
      this.#closed = true;
    }
    this.stdin.pause();
  }
}

/** An in-memory terminal: captures output and lets you feed input. */
export class VirtualTerminal implements Terminal {
  columns: number;
  rows: number;
  readonly colorDepth: ColorDepth;
  output = "";
  #data = new Set<(data: string) => void>();
  #resize = new Set<() => void>();

  constructor(columns = 80, rows = 24, colorDepth: ColorDepth = "truecolor") {
    this.columns = columns;
    this.rows = rows;
    this.colorDepth = colorDepth;
  }

  write(data: string): void {
    this.output += data;
  }

  onData(listener: (data: string) => void): () => void {
    this.#data.add(listener);
    return () => this.#data.delete(listener);
  }

  onResize(listener: () => void): () => void {
    this.#resize.add(listener);
    return () => this.#resize.delete(listener);
  }

  setup(): void {}
  restore(): void {}

  /** Simulates the user typing raw input */
  input(data: string): void {
    for (const listener of [...this.#data]) listener(data);
  }

  resize(columns: number, rows: number): void {
    this.columns = columns;
    this.rows = rows;
    for (const listener of [...this.#resize]) listener();
  }
}
