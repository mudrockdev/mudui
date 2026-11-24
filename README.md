# mudui

A terminal renderer and UI kit for **Svelte 5**. Write ordinary Svelte components (runes, `{#each}`, `{#if}`, snippets, context, attachments) and render them to the terminal.

mudui is built on Svelte's experimental [custom renderer](https://svelte.dev/docs/svelte/svelte-renderer) API. Components are compiled with `experimental.customRenderer` pointing at mudui's renderer, so Svelte builds a lightweight node tree instead of DOM nodes. mudui then lays that tree out with a small flexbox engine, paints it into a cell buffer, and writes only the changed cells to the terminal.

```
  mudtasks    Tasks │ Stats │ Help                         1/8 done  ██░░░░░░░░░░░░░░
╭─ Lists ──────────────╮╭─ Inbox · 2 open ───────────────────────────────────────────╮
│ ❯ Inbox           2  ││ [ ] Try mudtasks — press ? for help                    !!  │
│   Work            3  ││ [ ] Add a task with n                                      │
│   Personal        2  ││ [✓] Toggle tasks with space                                │
│                      ││                                                            │
╰──────────────────────╯╰────────────────────────────────────────────────────────────╯
 n add  space toggle  e edit  d delete  / filter  ? help  q quit
```

<sub>The example app in [`examples/taskboard`](examples/taskboard), which is built with mudui.</sub>

## Requirements

- [Bun](https://bun.sh) (mudui compiles `.svelte` files with a Bun plugin)
- Svelte `^5.59.0` (custom renderers are experimental in Svelte)

## Quick start

The fastest way is the starter, which creates a small project with a counter component and a test:

```sh
bun create mudui my-app
cd my-app
bun run dev
```

Or set it up by hand:

```sh
bun add mudui svelte
```

**bunfig.toml** registers the plugin that compiles `.svelte` files for the terminal:

```toml
preload = ["mudui/preload"]

[test]
preload = ["mudui/preload"]
```

**Counter.svelte**

```svelte
<script lang="ts">
  import { Button, Panel, useInput, useApp } from "mudui";

  let count = $state(0);
  const app = useApp();

  useInput((event) => {
    if (event.is("q")) app.exit();
  });
</script>

<Panel title="Counter" width={30}>
  <txt>Count: <txt bold color="cyan">{count}</txt></txt>
  <Button
    label="Increment"
    variant="primary"
    autofocus
    onclick={() => count++}
  />
  <txt dim>q to quit</txt>
</Panel>
```

**main.ts**

```ts
import { render } from "mudui";
import Counter from "./Counter.svelte";

const app = render(Counter);
await app.waitUntilExit();
```

Run it:

```sh
bun main.ts
```

> No flags are needed: the `mudui/preload` plugin from `bunfig.toml` makes Svelte load its client runtime, which supports custom renderers. If you see Svelte's `custom_renderer_unavailable_on_server` error, the preload isn't active, so check `bunfig.toml` (or pass `--conditions=svelte-custom-renderer`).

## Primitives

Everything is built from two elements:

| Element | What it is                                                                                            |
| ------- | ----------------------------------------------------------------------------------------------------- |
| `<box>` | A flex container (a column by default). Holds boxes, `<txt>` and loose text.                          |
| `<txt>` | A block of wrapping text. Nested `<txt>` elements are inline, which is how you style parts of a line. |

```svelte
<box row gap={1} padding="0 1" border="round" title="Status" borderColor="gray">
  <txt bold>CPU</txt>
  <box grow={1}></box>
  <txt color={load > 0.8 ? "red" : "green"}>{Math.round(load * 100)}%</txt>
</box>
```

Attribute names are case- and dash-insensitive (`paddingX`, `padding-x`, `paddingx`). You can also use a CSS-like `style` string: `style="border: round; padding: 0 1"`. Attributes win over `style`.

**Layout**: `direction` (`row` | `column`), `row` (shorthand), `gap`, `padding` (`1`, `"1 2"`, `"1 2 3 4"`), `paddingX/Y/Top/Right/Bottom/Left`, `margin*` (same forms), `width`/`height` and their `min`/`max` variants (cells, `"50%"` or `"auto"`), `grow`, `shrink`, `align` (cross axis: `start` | `center` | `end` | `stretch`), `alignSelf`, `justify` (`start` | `center` | `end` | `between` | `around` | `evenly`), `position="absolute"` with `top`/`right`/`bottom`/`left`, `scrollX`/`scrollY`, and `hidden`.

**Decoration**: `border` (`single` | `round` | `double` | `bold` | `dashed` | `ascii`), `borderColor`, `borderDim`, `borderTop`/`Right`/`Bottom`/`Left={false}`, `title`, `titleAlign`, `bg`.

**Text**: `color`, `bg`, `bold`, `dim`, `italic`, `underline`, `inverse`, `strike`. On `<box>`, these are inherited by the text inside. `<txt>` also takes `wrap` (`wrap` | `truncate` | `truncate-start` | `truncate-middle` | `none`), `textAlign`, and `fill`, a string repeated to fill the rest of each line (e.g. `<txt fill="─">`).

**Colors**: names (`red`, `brightBlue`, `gray`), `#rgb`, `#rrggbb`, `rgb(r,g,b)`, 256-color indices, or `default`. Truecolor is downgraded automatically when the terminal doesn't support it, and `NO_COLOR` is respected.

Template text follows HTML whitespace rules: a line break plus indentation in your markup counts as a single space, so formatters like Prettier can rewrap components safely. For a real line break, use an expression: `{'first\nsecond'}`.

Some defaults are tuned for terminals. Children in a column don't shrink (they overflow and are clipped). In a row they shrink, which wraps their text, unless they have a fixed `width`.

A box with `scrollY` (or `scrollX`) that also has `grow` is a viewport: along its parent's main axis it takes its size from the free space, not from its content. That is how scrolling components fill a sized parent (`<ScrollView grow={1}>`, `<LogView grow={1}>`) without pushing what comes after them off screen.

## Events and focus

Event attributes work like in the DOM, with DOM-like event objects that bubble up the tree:

| Event                                          | Object                                                                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `onkeydown`                                    | `KeyEvent`: `key` (`'a'`, `'Enter'`, `'ArrowUp'`, …), `ctrl`, `alt`, `shift`, `is('ctrl+s')`, `printable`    |
| `onclick`, `onmousedown`, `onmouseup`          | `MouseEvent`: `x`, `y`, `localX`, `localY`, `button`                                                         |
| `onwheel`                                      | `WheelEvent`: `deltaY`                                                                                       |
| `onpaste`                                      | `PasteEvent`: `text` (bracketed paste)                                                                       |
| `onfocus`, `onblur`, `onfocusin`, `onfocusout` | `FocusEvent`                                                                                                 |
| `onlayout`                                     | `LayoutEvent`: `width`, `height`, `contentWidth`, `contentHeight`, fired when the element's geometry changes |

Every event has `stopPropagation()` and `preventDefault()`.

- Keys go to the focused element and bubble up. `focusable` elements take focus with Tab / Shift+Tab, or when clicked.
- `autofocus` focuses an element when it first appears. `disabled` removes it from the tab order.
- `trapfocus` keeps focus inside an element while it is rendered (used by `Modal`). When the trap goes away, focus returns to where it was.
- If the focused element is removed, focus goes back to the previously focused element.
- After bubbling, keys go to global handlers registered with `useInput`, most recent first. Unless prevented, Tab moves focus and ctrl+c exits.

`bind:` directives, transitions and `animate:` aren't available on elements under a custom renderer (a Svelte restriction). Use component props (`bind:value` on `TextInput` works fine), and use `{@attach}` to get at elements.

## Components

**Layout and display**

| Component                                             | Purpose                                                                                                                               |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `Box`, `Text`                                         | Component wrappers around `<box>` / `<txt>`                                                                                           |
| `Panel`                                               | Bordered box with a title; the border lights up while something inside has focus                                                      |
| `Collapsible`                                         | A header that shows or hides its content (Enter, arrows, click)                                                                       |
| `ScrollView`                                          | Scrollable area with a scrollbar: `height`, `grow` or `maxHeight`; keys, wheel, `follow`; scrolls focused children into view          |
| `LogView`                                             | Log output (`height` or `grow`): renders only the visible lines, so it stays fast with thousands; follows the end until you scroll up |
| `Badge`, `Divider`, `Spacer`, `KeyHints`, `Scrollbar` | Small pieces                                                                                                                          |

**Inputs**

| Component            | Purpose                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Button`             | `label`, `onclick`, `variant` (`default` / `primary` / `success` / `danger` / `warning`), `disabled`                                                   |
| `TextInput`          | Single line: `bind:value`, `placeholder`, `prefix`, `mask`, `maxLength`, `onsubmit`, `oncancel`. Emacs-style editing keys, paste, horizontal scrolling |
| `TextArea`           | Multi-line editor: `bind:value`, `height`, `lineNumbers`, `insertTabs`; scrolls both ways; ctrl+s or alt+Enter submits                                 |
| `Checkbox`, `Switch` | `bind:checked`, `label`, `onchange`                                                                                                                    |
| `RadioGroup`         | One of several: `items`, `bind:value`, `direction`                                                                                                     |
| `Slider`             | `bind:value`, `min`, `max`, `step`; arrows, PageUp/Down, click on the track, wheel                                                                     |

**Lists and pickers**

| Component     | Purpose                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Select`      | A scrolling list: `items`, `bind:value`, `height` or `grow`, `onchange`, `onselect`; disabled items and hints                                    |
| `MultiSelect` | Checklist: `bind:value` (array); space toggles, `a` toggles all                                                                                  |
| `Combobox`    | Search-as-you-type with fuzzy matching and highlighted matches                                                                                   |
| `Tabs`        | `items`, `bind:value`; arrows, numbers and clicks; scrolls (with `‹ ›`) to keep the active tab whole when they don't fit                         |
| `Table`       | `columns` (`width`, `grow`, `align`, `format`, `color`), `rows`, `bind:selected`, `onselect`                                                     |
| `Tree`        | Expandable tree with connecting lines: `nodes`, `bind:selected`, `bind:expanded`, `height` or `grow`; arrows open/close and move to parent/child |

List items can be `{ label, value, hint?, disabled?, color? }` objects or plain strings.

**Overlays**

| Component                    | Purpose                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------------- |
| `Modal`                      | Centered dialog: traps focus, closes on Escape, shadows global key handlers                     |
| `CommandPalette`             | Fuzzy-searchable list of `{ label, run, group?, shortcut? }` commands in a modal                |
| `Toaster` + `useToast()`     | Notifications: `toast('Saved')`, `toast.error('Failed', { title, duration })`; click to dismiss |
| `DialogHost` + `useDialog()` | `await confirm('Delete?')`, `await prompt('Name?')`, `await alert('Done')`                      |

Overlays are positioned absolutely, so render `Modal`, `CommandPalette`, `Toaster` and `DialogHost` directly inside your root `<box>`.

```svelte
<script lang="ts">
  import { Button, DialogHost, Toaster, useDialog, useToast } from "mudui";

  const dialog = useDialog();
  const toast = useToast();

  async function remove() {
    if (await dialog.confirm("Delete everything?", { danger: true }))
      toast.success("Deleted");
  }
</script>

<box height="100%">
  <Button label="Delete" variant="danger" onclick={remove} />
  <Toaster />
  <DialogHost />
</box>
```

**Charts**

| Component     | Purpose                                               |
| ------------- | ----------------------------------------------------- |
| `ProgressBar` | Smooth (⅛-cell) progress bar with optional percentage |
| `Spinner`     | Animated spinner with several styles                  |
| `Sparkline`   | `▁▂▃▅▇` mini chart of recent values                   |
| `BarChart`    | Labelled horizontal bars with values                  |

Colors come from a theme: `setTheme({ accent: 'magenta' })` in a component changes it for everything below it. The fuzzy matcher is exported too (`fuzzyMatch`, `highlight`).

## API

```ts
render(Component, {
	props,
	context,
	fullscreen: true, // alternate screen; false renders inline, below the prompt
	mouse: true, // clicks and wheel (default: same as fullscreen)
	exitOnCtrlC: true,
	fps: 60
}): App;
```

`App` has `exit()`, `waitUntilExit()`, `focus(el)`, `focusNext()`, `focusPrevious()`, `focused`, `hitTest(x, y)` and `onKey(handler)`.

Inside components, call these during initialisation:

- `useApp()`: the `App`
- `useInput(handler)`: global key handler
- `useTerminalSize()`: reactive `{ columns, rows }`

## Testing

`mudui/testing` renders components into a virtual terminal, through the same custom renderer, layout and painting code that runs in a real terminal:

```ts
import { expect, test } from "bun:test";
import { renderTest } from "mudui/testing";
import Counter from "./Counter.svelte";

test("increments", () => {
  const t = renderTest(Counter, { width: 40, height: 6 });
  expect(t.frame()).toContain("Count: 0");

  t.press("Enter"); // keys: 'Tab', 'shift+Tab', 'ctrl+c', 'ArrowUp', ...
  expect(t.frame()).toContain("Count: 1");

  t.clickText("Increment");
  expect(t.frame()).toContain("Count: 2");
  t.unmount();
});
```

The harness also has `type(text)`, `paste(text)`, `click(x, y)`, `wheel(x, y, dir)`, `resize(w, h)`, `find(text)`, `focused()` and `screen()` (cells with styles, e.g. `screen().styleAt(x, y).bold`).

Run tests with `bun test`.

## How it works

```
 .svelte ──(Bun plugin: compile with experimental.customRenderer)──▶ JS that calls the mudui renderer
                                                                       │
 svelte/renderer createRenderer({...})  ◀──────────────────────────────┘
   src/lib/renderer/index.ts: createElement, insert, setAttribute, addEventListener, ...
   src/lib/renderer/nodes.ts: TElement / TText / TComment / TFragment tree, notifies the root on change
                                                                       │
 runtime/app.ts: on change, schedule a frame (≤ fps)                   ▼
   layout.ts ─ flexbox-like layout in whole cells (grow/shrink, align, justify, absolute, scroll)
   paint.ts ── paint into a Screen (cells: grapheme, width, fg, bg, attributes), clipping
   screen.ts ─ diff against the previous frame → cursor moves + SGR sequences
   input.ts ── raw stdin → keys, SGR mouse, bracketed paste → DOM-like events through the tree
```

The plugin (`mudui/plugin`) sets `experimental.customRenderer` to the absolute path of the renderer module, so every component, including mudui's own, imports the same renderer instance. `mount(App, { target, renderer })` from `svelte` does the rest.

## Development

```sh
bun install
bun run test        # library tests (renderer, layout, input, components)
bun run check       # svelte-check
bun run example     # run the example app
bun run bench       # benchmarks (see below)
bun run prepack     # build dist/ and lint the package
```

Inside this repo, the example resolves `mudui` to `src/lib` through the `mudui-source` export condition.

### Benchmarks

`bun run bench` renders a set of scenes in a virtual terminal and reports:

- **Frames**: time for one update plus a full render (mean, p50, p99), the resulting `max fps` (1000 / mean), mount time and bytes written per frame.
- **Where frame time goes**: Svelte's update, layout, paint, diff, and the runtime's own per-frame work.
- **Resize**: frames that follow a size change, with the size swept one cell at a time like a drag. A resize _storm_ resizes every 4 ms through the 60 fps scheduler. It reports how stale frames are, how long the screen stays blank after the clear each resize writes, and whether the final frame matches a fresh render at that size.
- **Scheduler**: the refresh rate an app actually gets at `fps` caps of 30, 60, 120 and uncapped, while state changes every millisecond, with frame spacing and CPU use.

Use `--quick` for shorter runs and `--filter <name>` to pick scenarios. To track regressions, save a run with `--json base.json`, then compare later runs with `--compare base.json`. Terminal emulator speed isn't measured; `bytes/frame` is the proxy for it. The scenes are in `bench/scenes`.

Results from one machine. Frame times depend on the CPU, so compare runs from the same machine:

```text
mudui benchmarks · bun 1.4.5 · AMD Ryzen 7 9700X 8-Core Processor · linux-x64

Frames (one update + full render; time in ms)

scenario        size    mount   mean    p50    p99   max  max fps  bytes/frame
──────────────  ──────  ─────  ─────  ─────  ─────  ────  ───────  ───────────
counter         80x24   0.425  0.018  0.016  0.035  1.40   55,734           21
dashboard/idle  160x48   3.06  0.190  0.179  0.367  1.26    5,262            0
dashboard       160x48   2.10  0.388  0.369  0.661  4.95    2,580          843
typing          80x24   0.247  0.037  0.034  0.068  2.01   27,130           38
log/10k         120x40   1.87  0.147  0.141  0.255  2.85    6,794         2.0K
list/1k         120x40   10.6   2.23   2.11   4.15  8.47      449         1.7K
grid/full       200x60   5.79   4.59   4.34   9.87  19.8      218        53.6K

Where frame time goes (mean ms, share of frame)

scenario            svelte      layout       paint        diff     runtime
──────────────  ──────────  ──────────  ──────────  ──────────  ──────────
counter         0.001   4%  0.003  15%  0.005  26%  0.009  51%  0.001   4%
dashboard/idle  0.000   0%  0.058  30%  0.087  46%  0.035  18%  0.010   5%
dashboard       0.057  15%  0.100  26%  0.105  27%  0.040  10%  0.086  22%
log/10k         0.038  26%  0.029  20%  0.038  26%  0.039  27%  0.003   2%
list/1k         0.017   1%   1.98  87%  0.233  10%  0.051   2%  0.000   0%
grid/full        1.08  22%   2.87  60%  0.279   6%  0.587  12%  0.000   0%

Resize (one size change + full render, sweeping the size like a drag; time in ms)

scenario          size            mean    p50    p99   max  max fps  bytes/frame  passes
────────────────  ─────────────  ─────  ─────  ─────  ────  ───────  ───────────  ──────
resize/counter    40x12–80x24    0.016  0.015  0.029  1.78   64,508         1.3K     1.0
resize/dashboard  120x36–160x48  0.504  0.486  0.804  1.98    1,983         8.4K     2.0
resize/log        80x28–120x40   0.132  0.096  0.288  1.41    7,602         4.7K     1.3
resize/list       80x28–120x40    1.82   1.68   3.81  4.92      549         4.3K     1.0
resize/grid       160x48–200x60  0.851  0.715   1.83  2.43    1,174        44.0K     1.2

Resize storm (resize every 4ms through the 60fps scheduler, like dragging a window)

scene      sizes          events/s  frames/s  staleness p50      p99  blank p50      max  blank %  cpu  bytes/frame  settled
─────────  ─────────────  ────────  ────────  ─────────────  ───────  ─────────  ───────  ───────  ───  ───────────  ───────
dashboard  120x36–160x48       231      58.0        17.2 ms  18.0 ms    16.5 ms  18.0 ms      95%  12%         8.7K  ok     
list       80x28–120x40        200      50.0        19.9 ms  21.3 ms    19.5 ms  20.8 ms      97%  23%         4.3K  ok     
grid       160x48–200x60       223      55.5        17.7 ms  19.4 ms    16.8 ms  19.7 ms      94%  16%        44.0K  ok     

staleness: oldest unrendered resize → frame. blank: the clear a resize writes → next frame.

Scheduler (dashboard 160x48, state changes every 1ms)

fps cap  achieved fps  frame interval p50      p99      max  cpu  bytes/frame
───────  ────────────  ──────────────────  ───────  ───────  ───  ───────────
     30          30.0             33.8 ms  38.1 ms  38.1 ms  20%         1.6K
     60          60.2             16.7 ms  17.7 ms  17.9 ms  19%         1.7K
    120         117.2             8.55 ms  9.32 ms  9.42 ms  20%         1.6K
    max         467.0             2.11 ms  3.17 ms  7.37 ms  31%         1.1K
```

## Limitations

- Bun only for now (the compile step is a Bun plugin; the runtime itself only needs Node-compatible streams).
- Character widths use built-in East Asian Width / emoji tables. Exotic grapheme clusters may measure differently than your terminal draws them.
- Mouse support is click, press/release and wheel. There's no drag selection.
