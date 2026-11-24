<script lang="ts">
  import type { KeyEvent, LayoutEvent, PasteEvent } from "../runtime/events.js";
  import { graphemes, graphemeWidth } from "../renderer/text.js";
  import { getTheme } from "../theme.js";
  import type { ColorValue, Dimension } from "../types.js";

  let {
    value = $bindable(""),
    placeholder = "",
    width,
    mask,
    maxLength,
    disabled = false,
    autofocus = false,
    prefix,
    color,
    onchange,
    onsubmit,
    oncancel,
  }: {
    value?: string;
    placeholder?: string;
    width?: Dimension;
    /** Character shown instead of each typed character (e.g. `'•'` for passwords) */
    mask?: string;
    maxLength?: number;
    disabled?: boolean;
    autofocus?: boolean;
    /** Shown before the input, e.g. `'> '` */
    prefix?: string;
    color?: ColorValue;
    onchange?: (value: string) => void;
    onsubmit?: (value: string) => void;
    /** Called when Escape is pressed */
    oncancel?: () => void;
  } = $props();

  const theme = getTheme();

  let focused = $state(false);
  let columns = $state(0);
  /** Cursor position, in graphemes */
  let cursor = $state(value.length);
  let offset = $state(0);

  const chars = $derived(graphemes(value));
  const shown = $derived(mask ? chars.map(() => mask) : chars);

  // keep the cursor in range when the value changes from outside
  $effect.pre(() => {
    if (cursor > chars.length) cursor = chars.length;
  });

  /** Visible window, scrolled so the cursor is always in view */
  const view = $derived.by(() => {
    const room = Math.max(1, columns);
    const width_of = (from: number, to: number) => {
      let w = 0;
      for (let i = from; i < to; i++) w += graphemeWidth(shown[i]);
      return w;
    };
    // the cursor cell is the character under the cursor, or a space at the end
    const cursor_width =
      cursor < shown.length ? graphemeWidth(shown[cursor]) : 1;

    let start = Math.min(offset, cursor);
    while (start < cursor && width_of(start, cursor) + cursor_width > room)
      start++;

    let end = Math.min(cursor + 1, shown.length);
    let used = width_of(start, cursor) + cursor_width;
    while (end < shown.length && used + graphemeWidth(shown[end]) <= room) {
      used += graphemeWidth(shown[end]);
      end++;
    }
    return { start, end };
  });

  $effect.pre(() => {
    offset = view.start;
  });

  const before = $derived(shown.slice(view.start, cursor).join(""));
  const at = $derived(shown[cursor] ?? " ");
  const after = $derived(shown.slice(cursor + 1, view.end).join(""));

  function update(chars_: string[], position: number) {
    if (maxLength !== undefined && chars_.length > maxLength) return;
    const next = chars_.join("");
    value = next;
    cursor = Math.max(0, Math.min(position, chars_.length));
    onchange?.(next);
  }

  function insert(text: string) {
    const clean = graphemes(text.replace(/[\r\n]+/g, " ")).filter(
      (g) => g >= " ",
    );
    if (clean.length === 0) return;
    const next = [...chars.slice(0, cursor), ...clean, ...chars.slice(cursor)];
    update(next, cursor + clean.length);
  }

  function word_start(from: number) {
    let i = from;
    while (i > 0 && chars[i - 1] === " ") i--;
    while (i > 0 && chars[i - 1] !== " ") i--;
    return i;
  }

  function word_end(from: number) {
    let i = from;
    while (i < chars.length && chars[i] === " ") i++;
    while (i < chars.length && chars[i] !== " ") i++;
    return i;
  }

  function onkeydown(event: KeyEvent) {
    if (disabled) return;
    const k = event.key;
    let handled = true;

    if (k === "Enter") onsubmit?.(value);
    else if (k === "Escape" && oncancel) oncancel();
    else if (k === "ArrowLeft" && (event.ctrl || event.alt))
      cursor = word_start(cursor);
    else if (k === "ArrowRight" && (event.ctrl || event.alt))
      cursor = word_end(cursor);
    else if (k === "ArrowLeft") cursor = Math.max(0, cursor - 1);
    else if (k === "ArrowRight") cursor = Math.min(chars.length, cursor + 1);
    else if (k === "Home" || event.is("ctrl+a")) cursor = 0;
    else if (k === "End" || event.is("ctrl+e")) cursor = chars.length;
    else if (k === "Backspace" && (event.alt || event.ctrl)) {
      const start = word_start(cursor);
      update([...chars.slice(0, start), ...chars.slice(cursor)], start);
    } else if (k === "Backspace") {
      if (cursor > 0)
        update(
          [...chars.slice(0, cursor - 1), ...chars.slice(cursor)],
          cursor - 1,
        );
    } else if (k === "Delete" || event.is("ctrl+d")) {
      if (cursor < chars.length)
        update([...chars.slice(0, cursor), ...chars.slice(cursor + 1)], cursor);
    } else if (event.is("ctrl+w")) {
      const start = word_start(cursor);
      update([...chars.slice(0, start), ...chars.slice(cursor)], start);
    } else if (event.is("ctrl+u")) update(chars.slice(cursor), 0);
    else if (event.is("ctrl+k")) update(chars.slice(0, cursor), cursor);
    else if (event.printable) insert(k);
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
</script>

<box
  row
  focusable
  {disabled}
  {autofocus}
  {width}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  {onkeydown}
  {onpaste}
>
  {#if prefix}<txt wrap="none" color={focused ? theme.accent : theme.muted}
      >{prefix}</txt
    >{/if}
  <box grow={1} onlayout={(e: LayoutEvent) => (columns = e.width)}>
    {#if value === "" && placeholder}
      <txt wrap="none" color={theme.muted}
        >{#if focused}<txt inverse>{graphemes(placeholder)[0]}</txt>{graphemes(
            placeholder,
          )
            .slice(1)
            .join("")}{:else}{placeholder}{/if}</txt
      >
    {:else}
      <txt wrap="none" color={disabled ? theme.muted : color}
        >{before}{#if focused}<txt inverse>{at}</txt
          >{:else}{at}{/if}{after}</txt
      >
    {/if}
  </box>
</box>
