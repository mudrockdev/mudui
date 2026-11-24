<script lang="ts" generics="T">
  import { fuzzyMatch, highlight } from "../fuzzy.js";
  import type { KeyEvent, WheelEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import { normalizeItems } from "../items.js";
  import type { SelectItem } from "../types.js";
  import Scrollbar from "./Scrollbar.svelte";
  import TextInput from "./TextInput.svelte";

  let {
    items,
    value = $bindable(),
    query = $bindable(""),
    placeholder = "Search…",
    prefix = "› ",
    height = 6,
    emptyText = "No matches",
    autofocus = false,
    disabled = false,
    onselect,
    oncancel,
  }: {
    items: Array<SelectItem<T> | T>;
    /** The last chosen value */
    value?: T;
    query?: string;
    placeholder?: string;
    prefix?: string;
    /** Number of visible results */
    height?: number;
    emptyText?: string;
    autofocus?: boolean;
    disabled?: boolean;
    /** Called when a result is chosen with Enter or a click */
    onselect?: (value: T) => void;
    /** Called on Escape with an empty query */
    oncancel?: () => void;
  } = $props();

  const theme = getTheme();
  let active = $state(0);
  let offset = $state(0);

  const list = $derived(normalizeItems(items));

  const results = $derived.by(() => {
    if (!query.trim())
      return list.map((item) => ({ item, positions: [] as number[] }));
    return list
      .map((item, order) => ({
        item,
        order,
        match: fuzzyMatch(query, item.label),
      }))
      .filter((r) => r.match !== null)
      .sort((a, b) => b.match!.score - a.match!.score || a.order - b.order)
      .map((r) => ({ item: r.item, positions: r.match!.positions }));
  });

  // highlight the best match whenever the query changes
  let last_query: string | undefined;
  $effect.pre(() => {
    if (query !== last_query) {
      last_query = query;
      active = 0;
    }
  });

  const rows = $derived(Math.min(height, Math.max(1, list.length)));
  const index = $derived(Math.max(0, Math.min(active, results.length - 1)));
  const top = $derived.by(() => {
    let start = Math.min(offset, Math.max(0, results.length - rows));
    if (index < start) start = index;
    if (index >= start + rows) start = index - rows + 1;
    return Math.max(0, start);
  });

  $effect.pre(() => {
    offset = top;
  });

  function choose(i: number) {
    const result = results[i];
    if (!result || result.item.disabled || disabled) return;
    value = result.item.value;
    onselect?.(result.item.value);
  }

  function onkeydown(event: KeyEvent) {
    const k = event.key;
    const last = results.length - 1;
    if (k === "ArrowUp" || event.is("ctrl+p")) active = Math.max(0, index - 1);
    else if (k === "ArrowDown" || event.is("ctrl+n"))
      active = Math.min(last, index + 1);
    else if (k === "PageUp") active = Math.max(0, index - rows);
    else if (k === "PageDown") active = Math.min(last, index + rows);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }
</script>

<box
  {onkeydown}
  onwheel={(e: WheelEvent) =>
    (active = Math.max(0, Math.min(results.length - 1, index + e.deltaY)))}
>
  <TextInput
    bind:value={query}
    {placeholder}
    {prefix}
    {autofocus}
    {disabled}
    onsubmit={() => choose(index)}
    oncancel={query ? () => (query = "") : oncancel}
  />
  <!-- sized to the full list (not the filtered results), so it doesn't jump while typing -->
  <box row height={rows}>
    <box grow={1}>
      {#if results.length === 0}
        <txt color={theme.muted} italic>{"  "}{emptyText}</txt>
      {/if}
      {#each results.slice(top, top + rows) as result, i (i + top)}
        {@const selected = i + top === index}
        <box
          row
          onclick={() => choose(i + top)}
          bg={selected ? theme.accent : undefined}
        >
          <txt
            grow={1}
            wrap="truncate"
            color={result.item.disabled
              ? theme.muted
              : selected
                ? theme.onAccent
                : undefined}
            >{selected
              ? "❯ "
              : "  "}{#each highlight(result.item.label, result.positions) as part, p (p)}{#if part.match}<txt
                  bold
                  underline={selected}
                  color={selected ? undefined : theme.accent}>{part.text}</txt
                >{:else}{part.text}{/if}{/each}</txt
          >
          {#if result.item.hint}
            <txt wrap="none" color={selected ? theme.onAccent : theme.muted}
              >{" "}{result.item.hint}{" "}</txt
            >
          {/if}
        </box>
      {/each}
    </box>
    {#if results.length > rows}
      <Scrollbar
        total={results.length}
        visible={rows}
        offset={top}
        height={rows}
      />
    {/if}
  </box>
</box>
