<script lang="ts">
  import type {
    KeyEvent,
    LayoutEvent,
    PasteEvent,
    WheelEvent,
  } from "../runtime/events.js";
  import { graphemes, graphemeWidth } from "../renderer/text.js";
  import { getTheme } from "../theme.js";
  import type { ColorValue, Dimension } from "../types.js";

  let {
    value = $bindable(""),
    placeholder = "",
    height = 5,
    width,
    lineNumbers = false,
    insertTabs = false,
    tabSize = 2,
    maxLength,
    disabled = false,
    autofocus = false,
    color,
    onchange,
    onsubmit,
    oncancel,
  }: {
    value?: string;
    placeholder?: string;
    /** Visible rows */
    height?: number;
    width?: Dimension;
    lineNumbers?: boolean;
    /** Insert spaces on Tab instead of moving focus */
    insertTabs?: boolean;
    tabSize?: number;
    maxLength?: number;
    disabled?: boolean;
    autofocus?: boolean;
    color?: ColorValue;
    onchange?: (value: string) => void;
    /** Called on ctrl+s or alt+Enter */
    onsubmit?: (value: string) => void;
    /** Called on Escape */
    oncancel?: () => void;
  } = $props();

  const theme = getTheme();

  let focused = $state(false);
  let columns = $state(0);
  /** Cursor position: line, and grapheme index within the line */
  let row = $state(0);
  let col = $state(0);
  /** Column to return to when moving up/down through shorter lines */
  let goal: number | null = null;
  let top_offset = $state(0);
  let left_offset = $state(0);

  const lines = $derived(value.split("\n").map(graphemes));

  // keep the cursor valid when the value changes from outside
  $effect.pre(() => {
    if (row > lines.length - 1) row = lines.length - 1;
    if (col > lines[row].length) col = lines[row].length;
  });

  const gutter = $derived(lineNumbers ? String(lines.length).length + 1 : 0);
  const text_columns = $derived(Math.max(1, columns - gutter));

  const cells = (glyphs: string[], from = 0, to = glyphs.length) => {
    let w = 0;
    for (let i = from; i < to; i++) w += graphemeWidth(glyphs[i]);
    return w;
  };

  const top = $derived.by(() => {
    let start = Math.min(top_offset, row);
    if (row >= start + height) start = row - height + 1;
    return Math.max(0, start);
  });

  const left = $derived.by(() => {
    const x = cells(lines[row] ?? [], 0, col);
    let start = Math.min(left_offset, x);
    if (x >= start + text_columns) start = x - text_columns + 1;
    return Math.max(0, start);
  });

  $effect.pre(() => {
    top_offset = top;
    left_offset = left;
  });

  /** The graphemes whose cells fall within display columns [from, to) */
  function slice_cells(glyphs: string[], from: number, to: number) {
    let x = 0;
    let out = "";
    for (const g of glyphs) {
      const w = graphemeWidth(g);
      if (x >= to) break;
      if (x >= from && x + w <= to) out += g;
      x += w;
    }
    return out;
  }

  const view = $derived(
    lines.slice(top, top + height).map((glyphs, i) => {
      const r = top + i;
      const number = lineNumbers
        ? `${String(r + 1).padStart(gutter - 1)} `
        : "";
      if (r !== row || !focused) {
        return {
          number,
          before: slice_cells(glyphs, left, left + text_columns),
          at: null,
          after: "",
        };
      }
      const x = cells(glyphs, 0, col);
      const at = glyphs[col] ?? " ";
      const room = left + text_columns - x - graphemeWidth(at);
      return {
        number,
        before: slice_cells(glyphs.slice(0, col), left, x),
        at,
        after: slice_cells(glyphs.slice(col + 1), 0, Math.max(0, room)),
      };
    }),
  );

  function commit(next: string[][], r: number, c: number) {
    const text_ = next.map((line) => line.join("")).join("\n");
    if (maxLength !== undefined && graphemes(text_).length > maxLength) return;
    value = text_;
    row = r;
    col = c;
    goal = null;
    onchange?.(text_);
  }

  function insert(text_: string) {
    const parts = text_
      .replace(/\r\n?/g, "\n")
      .replace(/\t/g, " ".repeat(tabSize))
      .split("\n")
      .map((part) => graphemes(part).filter((g) => g >= " "));
    const line = lines[row];
    const before = line.slice(0, col);
    const after = line.slice(col);
    const next = [...lines];
    if (parts.length === 1) {
      next[row] = [...before, ...parts[0], ...after];
      commit(next, row, col + parts[0].length);
    } else {
      const last = parts[parts.length - 1];
      next.splice(row, 1, [...before, ...parts[0]], ...parts.slice(1, -1), [
        ...last,
        ...after,
      ]);
      commit(next, row + parts.length - 1, last.length);
    }
  }

  function backspace() {
    const next = [...lines];
    if (col > 0) {
      next[row] = [...lines[row].slice(0, col - 1), ...lines[row].slice(col)];
      commit(next, row, col - 1);
    } else if (row > 0) {
      const c = lines[row - 1].length;
      next.splice(row - 1, 2, [...lines[row - 1], ...lines[row]]);
      commit(next, row - 1, c);
    }
  }

  function forward_delete() {
    const next = [...lines];
    if (col < lines[row].length) {
      next[row] = [...lines[row].slice(0, col), ...lines[row].slice(col + 1)];
      commit(next, row, col);
    } else if (row < lines.length - 1) {
      next.splice(row, 2, [...lines[row], ...lines[row + 1]]);
      commit(next, row, col);
    }
  }

  function word_start(line: string[], from: number) {
    let i = from;
    while (i > 0 && line[i - 1] === " ") i--;
    while (i > 0 && line[i - 1] !== " ") i--;
    return i;
  }

  function word_end(line: string[], from: number) {
    let i = from;
    while (i < line.length && line[i] === " ") i++;
    while (i < line.length && line[i] !== " ") i++;
    return i;
  }

  function vertical(delta: number) {
    goal ??= col;
    const target = goal;
    row = Math.max(0, Math.min(lines.length - 1, row + delta));
    col = Math.min(target, lines[row].length);
    goal = target;
  }

  function horizontal(c: number) {
    col = c;
    goal = null;
  }

  function onkeydown(event: KeyEvent) {
    if (disabled) return;
    const k = event.key;
    const line = lines[row];
    let handled = true;

    if (event.is("ctrl+s") || (k === "Enter" && event.alt)) onsubmit?.(value);
    else if (k === "Escape" && oncancel) oncancel();
    else if (k === "Enter") insert("\n");
    else if (k === "Tab" && insertTabs && !event.shift)
      insert(" ".repeat(tabSize));
    else if (k === "ArrowUp") vertical(-1);
    else if (k === "ArrowDown") vertical(1);
    else if (k === "PageUp") vertical(-height);
    else if (k === "PageDown") vertical(height);
    else if (k === "ArrowLeft" && (event.ctrl || event.alt)) {
      if (col === 0 && row > 0) {
        row--;
        horizontal(lines[row].length);
      } else horizontal(word_start(line, col));
    } else if (k === "ArrowRight" && (event.ctrl || event.alt)) {
      if (col === line.length && row < lines.length - 1) {
        row++;
        horizontal(0);
      } else horizontal(word_end(line, col));
    } else if (k === "ArrowLeft") {
      if (col > 0) horizontal(col - 1);
      else if (row > 0) {
        row--;
        horizontal(lines[row].length);
      }
    } else if (k === "ArrowRight") {
      if (col < line.length) horizontal(col + 1);
      else if (row < lines.length - 1) {
        row++;
        horizontal(0);
      }
    } else if (k === "Home" && event.ctrl) {
      row = 0;
      horizontal(0);
    } else if (k === "End" && event.ctrl) {
      row = lines.length - 1;
      horizontal(lines[row].length);
    } else if (k === "Home" || event.is("ctrl+a")) horizontal(0);
    else if (k === "End" || event.is("ctrl+e")) horizontal(line.length);
    else if (k === "Backspace" && (event.ctrl || event.alt)) {
      const start = word_start(line, col);
      const next = [...lines];
      next[row] = [...line.slice(0, start), ...line.slice(col)];
      commit(next, row, start);
    } else if (k === "Backspace") backspace();
    else if (k === "Delete" || event.is("ctrl+d")) forward_delete();
    else if (event.is("ctrl+w")) {
      if (col === 0) backspace();
      else {
        const start = word_start(line, col);
        const next = [...lines];
        next[row] = [...line.slice(0, start), ...line.slice(col)];
        commit(next, row, start);
      }
    } else if (event.is("ctrl+u")) {
      const next = [...lines];
      next[row] = line.slice(col);
      commit(next, row, 0);
    } else if (event.is("ctrl+k")) {
      if (col < line.length) {
        const next = [...lines];
        next[row] = line.slice(0, col);
        commit(next, row, col);
      } else forward_delete();
    } else if (event.printable) insert(k);
    else handled = false;

    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function onpaste(event: PasteEvent) {
    if (disabled) return;
    event.preventDefault();
    insert(event.text);
  }

  function onwheel(event: WheelEvent) {
    vertical(event.deltaY);
  }
</script>

<box
  {width}
  {height}
  focusable={!disabled}
  {disabled}
  {autofocus}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  onlayout={(e: LayoutEvent) => (columns = e.width)}
  {onkeydown}
  {onpaste}
  {onwheel}
>
  {#if value === "" && placeholder}
    <txt wrap="none" color={theme.muted}
      >{lineNumbers ? `${"1".padStart(gutter - 1)} ` : ""}{#if focused}<txt
          inverse>{graphemes(placeholder)[0]}</txt
        >{graphemes(placeholder)
          .slice(1)
          .join("")}{:else}{placeholder}{/if}</txt
    >
  {:else}
    {#each view as line, i (i + top)}
      <txt wrap="none" color={disabled ? theme.muted : color}
        >{#if lineNumbers}<txt color={theme.muted}>{line.number}</txt
          >{/if}{line.before}{#if line.at !== null}<txt inverse>{line.at}</txt
          >{line.after}{/if}</txt
      >
    {/each}
  {/if}
</box>
