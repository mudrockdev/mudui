<script lang="ts" generics="T">
  import type { KeyEvent, WheelEvent } from "../runtime/events.js";
  import { getTheme } from "../theme.js";
  import type { TreeNode } from "../types.js";
  import Scrollbar from "./Scrollbar.svelte";

  let {
    nodes,
    selected = $bindable(),
    expanded = $bindable([]),
    height = 10,
    guides = true,
    autofocus = false,
    onselect,
    ontoggle,
  }: {
    nodes: TreeNode<T>[];
    /** Id of the node under the cursor */
    selected?: string;
    /** Ids of the expanded nodes */
    expanded?: string[];
    /** Number of visible rows */
    height?: number;
    /** Draw connecting lines */
    guides?: boolean;
    autofocus?: boolean;
    /** Called on Enter or click */
    onselect?: (node: TreeNode<T>) => void;
    ontoggle?: (node: TreeNode<T>, expanded: boolean) => void;
  } = $props();

  const theme = getTheme();
  let focused = $state(false);
  let offset = $state(0);

  interface Row {
    node: TreeNode<T>;
    depth: number;
    prefix: string;
    parent: string | null;
    open: boolean;
    branch: boolean;
  }

  const rows = $derived.by(() => {
    const out: Row[] = [];
    const open = new Set(expanded);
    const walk = (
      list: TreeNode<T>[],
      depth: number,
      lead: string,
      parent: string | null,
    ) => {
      list.forEach((node, i) => {
        const last = i === list.length - 1;
        const branch = !!node.children?.length;
        const is_open = branch && open.has(node.id);
        const connector = guides && depth > 0 ? (last ? "└─ " : "├─ ") : "";
        out.push({
          node,
          depth,
          prefix: lead + connector,
          parent,
          open: is_open,
          branch,
        });
        if (is_open) {
          const next =
            guides && depth > 0
              ? lead + (last ? "   " : "│  ")
              : guides
                ? lead
                : lead + "  ";
          walk(node.children!, depth + 1, next, node.id);
        }
      });
    };
    walk(nodes, 0, "", null);
    return out;
  });

  const index = $derived(
    Math.max(
      0,
      rows.findIndex((r) => r.node.id === selected),
    ),
  );
  const top = $derived.by(() => {
    let start = Math.min(offset, Math.max(0, rows.length - height));
    if (index < start) start = index;
    if (index >= start + height) start = index - height + 1;
    return Math.max(0, start);
  });

  $effect.pre(() => {
    offset = top;
  });

  // select the first node if the selection isn't visible
  $effect.pre(() => {
    if (rows.length > 0 && !rows.some((r) => r.node.id === selected))
      selected = rows[0].node.id;
  });

  function select(i: number) {
    const row = rows[Math.max(0, Math.min(rows.length - 1, i))];
    if (row) selected = row.node.id;
  }

  function set_open(row: Row, open: boolean) {
    if (!row.branch || row.open === open) return;
    expanded = open
      ? [...expanded, row.node.id]
      : expanded.filter((id) => id !== row.node.id);
    ontoggle?.(row.node, open);
  }

  function onkeydown(event: KeyEvent) {
    const row = rows[index];
    const k = event.key;
    if (!row) return;
    if (k === "ArrowUp" || event.is("k")) select(index - 1);
    else if (k === "ArrowDown" || event.is("j")) select(index + 1);
    else if (k === "PageUp") select(index - height);
    else if (k === "PageDown") select(index + height);
    else if (k === "Home") select(0);
    else if (k === "End") select(rows.length - 1);
    else if (k === "ArrowRight" || event.is("l")) {
      if (row.branch && !row.open) set_open(row, true);
      else if (row.open) select(index + 1);
    } else if (k === "ArrowLeft" || event.is("h")) {
      if (row.open) set_open(row, false);
      else if (row.parent) selected = row.parent;
    } else if (k === " ") set_open(row, !row.open);
    else if (k === "Enter") {
      set_open(row, !row.open);
      onselect?.(row.node);
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function click(i: number) {
    const row = rows[i];
    selected = row.node.id;
    set_open(row, !row.open);
    onselect?.(row.node);
  }
</script>

<box
  row
  focusable
  {autofocus}
  onfocus={() => (focused = true)}
  onblur={() => (focused = false)}
  {onkeydown}
  onwheel={(e: WheelEvent) => select(index + e.deltaY)}
>
  <box grow={1}>
    {#each rows.slice(top, top + height) as row, i (row.node.id)}
      {@const active = i + top === index}
      <box row onclick={() => click(i + top)}>
        <txt wrap="none" color={theme.border}>{row.prefix}</txt>
        <txt
          grow={1}
          wrap="truncate"
          color={active && focused
            ? theme.onAccent
            : active
              ? theme.accent
              : row.node.color}
          bg={active && focused ? theme.accent : undefined}
          bold={active}
          >{row.branch ? (row.open ? "▾ " : "▸ ") : "  "}{row.node.label}</txt
        >
        {#if row.node.hint}<txt wrap="none" color={theme.muted}
            >{" "}{row.node.hint}</txt
          >{/if}
      </box>
    {/each}
  </box>
  {#if rows.length > height}
    <Scrollbar total={rows.length} visible={height} offset={top} {height} />
  {/if}
</box>
