# mudtasks

A terminal task manager built with [mudui](../../README.md), the Svelte terminal renderer in this repo.

```
  mudtasks    Tasks │ Stats │ Help                         1/8 done  ██░░░░░░░░░░░░░░
╭─ Progress by list ────────────────────────────────╮ ╭─ By priority ────────────────╮
│ Inbox     ████████▋░░░░░░░░░░░░░░░░░  33%     1/3 │ │  Priority  Open  Done        │
│                                                   │ │ ──────────────────────────── │
│ Work      ░░░░░░░░░░░░░░░░░░░░░░░░░░   0%     0/3 │ │  high         3     0        │
│                                                   │ │  normal       3     1        │
│ Personal  ░░░░░░░░░░░░░░░░░░░░░░░░░░   0%     0/2 │ │  low          1     0        │
╰───────────────────────────────────────────────────╯ ╰──────────────────────────────╯
```

```sh
bun start                    # uses $MUDTASKS_FILE or ~/.local/share/mudtasks/tasks.json
bun start ./my-tasks.json
bun test
```

Press `?` in the app for all the keys. You can add, edit, toggle, reorder, prioritise, filter and delete tasks, and create or delete lists. The mouse works too. Changes are saved automatically, atomically, and again on exit.

## What it shows

| File | mudui features |
| --- | --- |
| `src/main.ts` | `render()`, `waitUntilExit()` |
| `src/App.svelte` | `useInput` global shortcuts, `Modal` dialogs (focus trap + restore), `TextInput` in a modal |
| `src/components/TaskList.svelte` | Focusable custom list with `onkeydown`/`onwheel`/`onlayout`, inline editing, `{@attach}` + `app.focus()` |
| `src/components/TaskRow.svelte` | `MouseEvent.localX` hit areas, inherited colors |
| `src/components/Sidebar.svelte` | `Select` with hints |
| `src/components/Stats.svelte` | `ProgressBar`, `Table` with per-cell colors |
| `src/lib/tasks.svelte.ts` | Runes in a `.svelte.ts` module (compiled by the same Bun plugin) |
| `tests/app.test.ts` | End-to-end tests with `mudui/testing` |

## Setup

- `bunfig.toml` preloads `mudui/preload`, which compiles `.svelte` files with Svelte's `experimental.customRenderer` pointing at mudui's renderer.
- Scripts run Bun with `--conditions=svelte-custom-renderer`, which selects Svelte's client runtime. They also pass `--conditions=mudui-source`, which only matters inside this repo: it resolves `mudui` to its sources rather than `dist/`.
- `svelte.config.js` tells editors and `svelte-check` that these components use a custom renderer.
