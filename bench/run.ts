/**
 * mudui benchmarks.
 *
 *   bun run bench                      all scenarios
 *   bun run bench --quick              shorter runs (noisier)
 *   bun run bench --filter dashboard   only scenarios whose name contains "dashboard"
 *   bun run bench --json out.json      also write the results as JSON
 *   bun run bench --compare out.json   show the change against an earlier --json run
 *
 * Four kinds of measurements:
 *
 * - **frames**: one step (a state change, a keystroke, a resize) followed by a
 *   full `app.render()`, timed per frame in a virtual terminal. `max fps` is
 *   1000 / mean frame time: the refresh rate the renderer could sustain if
 *   rendering were the only work.
 * - **phases**: the same frames split into Svelte's update (`flushSync`),
 *   layout, paint and diff; "runtime" is what `render()` spends on top of those
 *   (focus bookkeeping, autofocus, layout events).
 * - **scheduler**: the real `auto` scheduler under a continuous stream of state
 *   changes, at several `fps` caps: the refresh rate an app actually gets, and
 *   how evenly frames are spaced.
 * - **resize**: frames that follow a size change (sweeping the size one cell
 *   at a time, like dragging a window edge), and a resize "storm" through the
 *   real scheduler: events arrive faster than frames, so it measures how stale
 *   frames are, how long the screen stays blank after the clear that each
 *   resize writes, and whether the last frame matches a fresh render.
 *
 * Everything runs against a `VirtualTerminal`, so terminal emulator speed is
 * not included: `bytes/frame` is the best proxy for that cost.
 */

// The plugin must be registered before any .svelte file (or svelte itself) is
// resolved, so everything else is imported dynamically.
import "../src/lib/bun/preload.ts";

import { cpus } from "node:os";
import { parseArgs } from "node:util";

const { App, VirtualTerminal, computeLayout, paintScreen } =
  await import("../src/lib/index.ts");
const { flushSync } = await import("svelte");
type AppT = InstanceType<typeof App>;
type ScreenT = AppT["screen"];

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    quick: { type: "boolean", default: false },
    filter: { type: "string" },
    json: { type: "string" },
    compare: { type: "string" },
  },
});

const MIN_TIME = args.quick ? 250 : 1500; // ms of sampling per scenario
const MIN_SAMPLES = args.quick ? 30 : 100;
const MAX_SAMPLES = 20_000;
const WARMUP_TIME = args.quick ? 100 : 400;
const SCHEDULER_TIME = args.quick ? 600 : 2000;

// ── scenarios ────────────────────────────────────────────────────────────────

import type { Bench } from "./bench.ts";

interface Ctx {
  app: AppT;
  terminal: InstanceType<typeof VirtualTerminal>;
  bench: Bench;
  i: number;
}

interface Scenario {
  name: string;
  about: string;
  scene: string;
  width: number;
  height: number;
  /** Scene parameters, passed along with `tick` in the `bench` context */
  options?: Omit<Bench, "tick">;
  /** One step before each frame; default: `bench.tick()` */
  step?: (ctx: Ctx) => void;
  /** Whether the phase breakdown makes sense (it needs `tick`-driven changes) */
  phases?: boolean;
  /** Which table the scenario is reported in */
  group?: "frames" | "resize";
}

/** 0, 1, …, n, n-1, …, 0, 1, … */
const triangle = (i: number, n: number) => n - Math.abs((i % (2 * n)) - n);

/**
 * Sizes visited while dragging a window corner: shrinks by up to 40 columns and
 * 12 rows from `width`x`height` and back, one cell at a time, at different rates.
 */
function dragSize(i: number, width: number, height: number): [number, number] {
  return [width - triangle(i, 40), height - triangle(Math.floor(i / 3), 12)];
}

const resizeScenario = (
  base: Scenario,
  about = `drag-resize between ${base.width - 40}x${base.height - 12} and ${base.width}x${base.height}`,
): Scenario => ({
  ...base,
  name: `resize/${base.name.split("/")[0]}`,
  about,
  group: "resize",
  phases: false,
  step: ({ terminal, i }) =>
    terminal.resize(...dragSize(i + 1, base.width, base.height)),
});

const scenarios: Scenario[] = [
  {
    name: "counter",
    about: "one number changes inside a panel",
    scene: "Counter",
    width: 80,
    height: 24,
  },
  {
    name: "dashboard/idle",
    about: "full frame with nothing changed (layout+paint floor)",
    scene: "Dashboard",
    width: 160,
    height: 48,
    step: () => {},
  },
  {
    name: "dashboard",
    about: "table, 4 sparklines, gauges, log; a few values per frame",
    scene: "Dashboard",
    width: 160,
    height: 48,
  },
  {
    name: "typing",
    about: "keystroke → frame latency in a TextInput",
    scene: "Typing",
    width: 80,
    height: 24,
    phases: false,
    // clear the field now and then so the value doesn't grow without bound
    step: ({ terminal, i }) =>
      terminal.input(i % 40 === 39 ? "\x15" : "abcdefghij"[i % 10]),
  },
  {
    name: "log/10k",
    about: "LogView with 10k lines, appending one per frame",
    scene: "Log",
    width: 120,
    height: 40,
  },
  {
    name: "list/1k",
    about: "1000 rows in a scroll box (not virtualized), scroll + toggle",
    scene: "BigList",
    width: 120,
    height: 40,
    options: { count: 1000 },
  },
  {
    name: "grid/full",
    about: "every cell changes char + truecolor bg/fg (worst-case diff)",
    scene: "ColorGrid",
    width: 200,
    height: 60,
  },
];
scenarios.push(
  ...["counter", "dashboard", "log/10k", "list/1k", "grid/full"].map((name) =>
    resizeScenario(scenarios.find((s) => s.name === name)!),
  ),
);

// ── stats ────────────────────────────────────────────────────────────────────

interface Stats {
  n: number;
  mean: number;
  p50: number;
  p99: number;
  max: number;
}

function stats(samples: number[]): Stats {
  const sorted = Float64Array.from(samples).sort();
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  let sum = 0;
  for (const s of sorted) sum += s;
  return {
    n: sorted.length,
    mean: sum / sorted.length,
    p50: at(0.5),
    p99: at(0.99),
    max: sorted[sorted.length - 1],
  };
}

const CLEAR = "\x1b[2J";

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

// ── runners ──────────────────────────────────────────────────────────────────

const scenes = new Map<string, any>();
async function load(scene: string) {
  if (!scenes.has(scene))
    scenes.set(scene, (await import(`./scenes/${scene}.svelte`)).default);
  return scenes.get(scene);
}

async function mount(s: Scenario, options: Record<string, unknown> = {}) {
  const component = await load(s.scene);
  const terminal = new VirtualTerminal(s.width, s.height);
  const bench: Bench = { ...s.options };
  const app = new App(component, {
    terminal,
    context: new Map([["bench", bench]]),
    scheduler: "manual",
    handleErrors: false,
    ...options,
  });
  return { app, terminal, bench };
}

interface FrameResult {
  name: string;
  about: string;
  size: string;
  mount: number;
  group: "frames" | "resize";
  frame: Stats;
  bytes: number;
  /** Screen clears written per frame (resizes clear the screen) */
  clears: number;
  /** Frame writes per `render()` (more than 1: a layout event changed state) */
  passes: number;
  phases?: {
    svelte: number;
    layout: number;
    paint: number;
    diff: number;
    runtime: number;
  };
}

async function runFrames(s: Scenario): Promise<FrameResult> {
  // mount time: median of a few fresh mounts (the first one also warms the JIT)
  const mounts: number[] = [];
  for (let k = 0; k < 7; k++) {
    const t0 = performance.now();
    const { app } = await mount(s);
    mounts.push(performance.now() - t0);
    app.exit();
  }

  const ctx = { ...(await mount(s)), i: 0 } as Ctx;
  const step = s.step ?? (({ bench }: Ctx) => bench.tick!());
  const frame = () => {
    step(ctx);
    ctx.app.render();
    ctx.i++;
  };

  for (const end = performance.now() + WARMUP_TIME; performance.now() < end;)
    frame();
  Bun.gc(true);

  const times: number[] = [];
  let bytes = 0;
  let clears = 0;
  let writes = 0;
  const write = ctx.terminal.write.bind(ctx.terminal);
  ctx.terminal.write = (data: string) => {
    if (data === CLEAR) clears++;
    else writes++;
    write(data);
  };
  const start = performance.now();
  while (
    times.length < MAX_SAMPLES &&
    (times.length < MIN_SAMPLES || performance.now() - start < MIN_TIME)
  ) {
    ctx.terminal.output = "";
    const t0 = performance.now();
    frame();
    times.push(performance.now() - t0);
    bytes += ctx.terminal.output.length;
  }

  const result: FrameResult = {
    name: s.name,
    about: s.about,
    size: `${s.width}x${s.height}`,
    group: s.group ?? "frames",
    mount: stats(mounts).p50,
    frame: stats(times),
    bytes: bytes / times.length,
    clears: clears / times.length,
    passes: writes / times.length,
  };

  if (s.phases !== false) result.phases = phases(ctx, step, result.frame.mean);
  ctx.app.exit();
  return result;
}

/** Re-runs the frame pipeline by hand to time each stage */
function phases(ctx: Ctx, step: (ctx: Ctx) => void, total: number) {
  const { app, terminal } = ctx;
  const t = {
    svelte: [] as number[],
    layout: [] as number[],
    paint: [] as number[],
    diff: [] as number[],
  };
  let previous: ScreenT | null = app.screen;
  const n = Math.min(
    2000,
    Math.max(MIN_SAMPLES, Math.round(MIN_TIME / Math.max(total, 0.01) / 2)),
  );

  for (let k = 0; k < n; k++) {
    step(ctx);
    const t0 = performance.now();
    flushSync();
    const t1 = performance.now();
    const tree = computeLayout(app.root, terminal.columns, terminal.rows);
    const t2 = performance.now();
    const screen = paintScreen(tree, terminal.columns, terminal.rows);
    const t3 = performance.now();
    screen.diff(previous, terminal.colorDepth);
    const t4 = performance.now();
    previous = screen;
    t.svelte.push(t1 - t0);
    t.layout.push(t2 - t1);
    t.paint.push(t3 - t2);
    t.diff.push(t4 - t3);
  }
  const out = {
    svelte: mean(t.svelte),
    layout: mean(t.layout),
    paint: mean(t.paint),
    diff: mean(t.diff),
    runtime: 0,
  };
  out.runtime = Math.max(
    0,
    total - out.svelte - out.layout - out.paint - out.diff,
  );
  return out;
}

interface SchedulerResult {
  fps: number | "max";
  achieved: number;
  interval: Stats;
  cpu: number;
  bytes: number;
}

/**
 * Drives the real scheduler: state changes every millisecond (faster than any
 * cap), frames rendered whenever the scheduler decides to.
 */
async function runScheduler(fps: number): Promise<SchedulerResult> {
  const s = scenarios.find((x) => x.name === "dashboard")!;
  const component = await load(s.scene);
  const terminal = new VirtualTerminal(s.width, s.height);
  const stamps: number[] = [];
  let bytes = 0;
  terminal.write = (data: string) => {
    stamps.push(performance.now());
    bytes += data.length;
  };
  const bench: Bench = {};
  const app = new App(component, {
    terminal,
    context: new Map([["bench", bench]]),
    scheduler: "auto",
    fps,
    handleErrors: false,
  });

  // warm up, then measure
  const producer = setInterval(() => bench.tick!(), 1);
  await Bun.sleep(WARMUP_TIME);
  stamps.length = 0;
  bytes = 0;
  const cpu0 = process.cpuUsage();
  const t0 = performance.now();
  await Bun.sleep(SCHEDULER_TIME);
  const elapsed = performance.now() - t0;
  const cpu = process.cpuUsage(cpu0);
  const span = stamps.length > 1 ? stamps[stamps.length - 1] - stamps[0] : 0;
  clearInterval(producer);
  app.exit();

  const intervals = stamps.slice(1).map((t, i) => t - stamps[i]);
  return {
    fps: Number.isFinite(fps) ? fps : "max",
    achieved: span ? ((stamps.length - 1) / span) * 1000 : 0,
    interval: stats(intervals.length ? intervals : [0]),
    cpu: ((cpu.user + cpu.system) / 1000 / elapsed) * 100,
    bytes: bytes / Math.max(1, stamps.length),
  };
}

interface StormResult {
  name: string;
  size: string;
  events: number;
  frames: number;
  /** Oldest unrendered resize → the frame that shows it */
  latency: Stats;
  /** Clear written by a resize → next frame painted (the screen is blank meanwhile) */
  blank: Stats;
  /** Share of the run the screen spent blank */
  blankShare: number;
  cpu: number;
  bytes: number;
  /** The settled frame equals a fresh render at the final size */
  correct: boolean;
}

/**
 * Resizes every `every` ms (faster than frames, like a window being dragged)
 * while the real scheduler renders at `fps`.
 */
async function runResizeStorm(
  s: Scenario,
  fps = 60,
  every = 4,
): Promise<StormResult> {
  const component = await load(s.scene);
  const terminal = new VirtualTerminal(s.width, s.height);
  const bench: Bench = { ...s.options };
  const app = new App(component, {
    terminal,
    context: new Map([["bench", bench]]),
    scheduler: "auto",
    fps,
    handleErrors: false,
  });

  let measuring = false;
  let pending: number | null = null; // first resize not yet on screen
  let cleared: number | null = null; // screen blank since
  const latency: number[] = [];
  const blank: number[] = [];
  let frames = 0;
  let events = 0;
  let bytes = 0;
  let writes = 0;
  terminal.write = (data: string) => {
    const now = performance.now();
    if (!measuring) return;
    bytes += data.length;
    if (data === CLEAR) {
      cleared ??= now;
      return;
    }
    writes++;
    if (cleared !== null) blank.push(now - cleared);
    cleared = null;
  };
  // a frame is a render() that wrote something (it may write more than once)
  const render = app.render.bind(app);
  app.render = () => {
    const before = writes;
    render();
    if (!measuring || writes === before) return;
    frames++;
    if (pending !== null) latency.push(performance.now() - pending);
    pending = null;
  };

  let i = 0;
  const producer = setInterval(() => {
    const now = performance.now();
    terminal.resize(...dragSize(++i, s.width, s.height));
    if (!measuring) return;
    events++;
    pending ??= now;
  }, every);

  await Bun.sleep(WARMUP_TIME);
  measuring = true;
  const cpu0 = process.cpuUsage();
  const t0 = performance.now();
  await Bun.sleep(SCHEDULER_TIME);
  const elapsed = performance.now() - t0;
  const cpu = process.cpuUsage(cpu0);
  clearInterval(producer);
  measuring = false;

  // let it settle, then compare against a fresh render at the final size
  await Bun.sleep(100);
  const final = app.screen.toString();
  const settled =
    app.screen.width === terminal.columns &&
    app.screen.height === terminal.rows;
  app.exit();
  const fresh = await mount({
    ...s,
    width: terminal.columns,
    height: terminal.rows,
  });
  const correct = settled && fresh.app.screen.toString() === final;
  fresh.app.exit();

  const blankTotal = blank.reduce((a, b) => a + b, 0);
  return {
    name: s.name.split("/")[0],
    size: `${s.width - 40}x${s.height - 12}–${s.width}x${s.height}`,
    events: (events / elapsed) * 1000,
    frames: (frames / elapsed) * 1000,
    latency: stats(latency.length ? latency : [0]),
    blank: stats(blank.length ? blank : [0]),
    blankShare: blankTotal / elapsed,
    cpu: ((cpu.user + cpu.system) / 1000 / elapsed) * 100,
    bytes: bytes / Math.max(1, frames),
    correct,
  };
}

const progress = (text: string) => {
  if (process.stderr.isTTY)
    process.stderr.write(text ? `  ${text}…\r` : "\x1b[K");
};

// ── output ───────────────────────────────────────────────────────────────────

const ms = (x: number) =>
  x >= 100
    ? x.toFixed(0)
    : x >= 10
      ? x.toFixed(1)
      : x >= 1
        ? x.toFixed(2)
        : x.toFixed(3);
const kb = (x: number) =>
  x >= 1024 ? `${(x / 1024).toFixed(1)}K` : `${Math.round(x)}`;
const pct = (x: number, total: number) => `${Math.round((x / total) * 100)}%`;

function table(head: string[], rows: string[][], right = new Set<number>()) {
  const widths = head.map((h, i) =>
    Math.max(Bun.stringWidth(h), ...rows.map((r) => Bun.stringWidth(r[i]))),
  );
  const fmt = (r: string[]) =>
    r
      .map((c, i) => {
        const pad = " ".repeat(widths[i] - Bun.stringWidth(c));
        return right.has(i) ? pad + c : c + pad;
      })
      .join("  ");
  console.log(fmt(head));
  console.log(widths.map((w) => "─".repeat(w)).join("  "));
  for (const r of rows) console.log(fmt(r));
  console.log();
}

let baseline: { frames: FrameResult[]; scheduler: SchedulerResult[] } | null =
  null;
if (args.compare) baseline = await Bun.file(args.compare).json();
const delta = (now: number, name: string) => {
  const before = baseline?.frames.find((f) => f.name === name)?.frame.mean;
  if (!before) return "";
  const d = ((now - before) / before) * 100;
  const sign = d > 0 ? "+" : "";
  return `${sign}${d.toFixed(0)}%`;
};

console.log(
  `mudui benchmarks · bun ${Bun.version} · ${cpus()[0]?.model.trim()} · ${process.platform}-${process.arch}\n`,
);

const selected = scenarios.filter(
  (s) => !args.filter || s.name.includes(args.filter),
);
const frames: FrameResult[] = [];
for (const s of selected) {
  progress(`running ${s.name}`);
  frames.push(await runFrames(s));
  progress("");
}

const updates = frames.filter((f) => f.group === "frames");
const resizes = frames.filter((f) => f.group === "resize");

if (updates.length) {
  console.log("Frames (one update + full render; time in ms)\n");
  const head = [
    "scenario",
    "size",
    "mount",
    "mean",
    "p50",
    "p99",
    "max",
    "max fps",
    "bytes/frame",
  ];
  if (baseline) head.push("vs base");
  table(
    head,
    updates.map((f) => {
      const row = [
        f.name,
        f.size,
        ms(f.mount),
        ms(f.frame.mean),
        ms(f.frame.p50),
        ms(f.frame.p99),
        ms(f.frame.max),
        Math.round(1000 / f.frame.mean).toLocaleString("en-US"),
        kb(f.bytes),
      ];
      if (baseline) row.push(delta(f.frame.mean, f.name));
      return row;
    }),
    new Set([2, 3, 4, 5, 6, 7, 8, 9]),
  );

  const withPhases = updates.filter((f) => f.phases);
  if (withPhases.length) {
    console.log("Where frame time goes (mean ms, share of frame)\n");
    table(
      ["scenario", "svelte", "layout", "paint", "diff", "runtime"],
      withPhases.map((f) => {
        const p = f.phases!;
        const total = p.svelte + p.layout + p.paint + p.diff + p.runtime;
        const cell = (x: number) => `${ms(x)} ${pct(x, total).padStart(4)}`;
        return [
          f.name,
          cell(p.svelte),
          cell(p.layout),
          cell(p.paint),
          cell(p.diff),
          cell(p.runtime),
        ];
      }),
      new Set([1, 2, 3, 4, 5]),
    );
  }
}

if (resizes.length) {
  console.log(
    "Resize (one size change + full render, sweeping the size like a drag; time in ms)\n",
  );
  const head = [
    "scenario",
    "size",
    "mean",
    "p50",
    "p99",
    "max",
    "max fps",
    "bytes/frame",
    "passes",
  ];
  if (baseline) head.push("vs base");
  table(
    head,
    resizes.map((f) => {
      const [w, h] = f.size.split("x").map(Number);
      const row = [
        f.name,
        `${w - 40}x${h - 12}–${f.size}`,
        ms(f.frame.mean),
        ms(f.frame.p50),
        ms(f.frame.p99),
        ms(f.frame.max),
        Math.round(1000 / f.frame.mean).toLocaleString("en-US"),
        kb(f.bytes),
        f.passes.toFixed(1),
      ];
      if (baseline) row.push(delta(f.frame.mean, f.name));
      return row;
    }),
    new Set([2, 3, 4, 5, 6, 7, 8, 9]),
  );
}

const storms: StormResult[] = [];
if (!args.filter || "resize-storm".includes(args.filter)) {
  for (const name of ["dashboard", "list/1k", "grid/full"]) {
    progress(`running resize storm: ${name}`);
    storms.push(await runResizeStorm(scenarios.find((s) => s.name === name)!));
    progress("");
  }
  console.log(
    "Resize storm (resize every 4ms through the 60fps scheduler, like dragging a window)\n",
  );
  table(
    [
      "scene",
      "sizes",
      "events/s",
      "frames/s",
      "staleness p50",
      "p99",
      "blank p50",
      "max",
      "blank %",
      "cpu",
      "bytes/frame",
      "settled",
    ],
    storms.map((r) => [
      r.name,
      r.size,
      Math.round(r.events).toString(),
      r.frames.toFixed(1),
      `${ms(r.latency.p50)} ms`,
      `${ms(r.latency.p99)} ms`,
      `${ms(r.blank.p50)} ms`,
      `${ms(r.blank.max)} ms`,
      `${Math.round(r.blankShare * 100)}%`,
      `${Math.round(r.cpu)}%`,
      kb(r.bytes),
      r.correct ? "ok" : "WRONG",
    ]),
    new Set([2, 3, 4, 5, 6, 7, 8, 9, 10]),
  );
  console.log(
    "staleness: oldest unrendered resize → frame. blank: the clear a resize writes → next frame.\n",
  );
}

const scheduler: SchedulerResult[] = [];
if (!args.filter || "scheduler".includes(args.filter)) {
  for (const fps of [30, 60, 120, Infinity]) {
    progress(`running scheduler @ ${fps} fps`);
    scheduler.push(await runScheduler(fps));
    progress("");
  }
  console.log("Scheduler (dashboard 160x48, state changes every 1ms)\n");
  table(
    [
      "fps cap",
      "achieved fps",
      "frame interval p50",
      "p99",
      "max",
      "cpu",
      "bytes/frame",
    ],
    scheduler.map((r) => [
      String(r.fps),
      r.achieved.toFixed(1),
      `${ms(r.interval.p50)} ms`,
      `${ms(r.interval.p99)} ms`,
      `${ms(r.interval.max)} ms`,
      `${Math.round(r.cpu)}%`,
      kb(r.bytes),
    ]),
    new Set([0, 1, 2, 3, 4, 5, 6]),
  );
}

if (args.json) {
  await Bun.write(
    args.json,
    JSON.stringify(
      {
        bun: Bun.version,
        cpu: cpus()[0]?.model,
        date: new Date().toISOString(),
        frames,
        scheduler,
        storms,
      },
      null,
      2,
    ),
  );
  console.log(`wrote ${args.json}`);
}

process.exit(0);
