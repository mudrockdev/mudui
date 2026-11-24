<script lang="ts">
  import { layoutText } from "../renderer/text.js";
  import { useApp } from "../runtime/context.js";
  import type { LayoutEvent } from "../runtime/events.js";
  import {
    toastStore,
    type Toast,
    type ToastKind,
  } from "../runtime/toast.svelte.js";
  import { getTheme } from "../theme.js";

  let {
    position = "bottom-right",
    width = 40,
    max = 5,
  }: {
    position?: "top-right" | "bottom-right" | "top-left" | "bottom-left";
    width?: number;
    /** Most toasts shown at once (the newest win) */
    max?: number;
  } = $props();

  const theme = getTheme();
  const store = toastStore(useApp());

  const colors: Record<ToastKind, string | number> = {
    info: theme.accent,
    success: theme.success,
    warning: theme.warning,
    error: theme.danger,
  };
  const icons: Record<ToastKind, string> = {
    info: "ℹ",
    success: "✓",
    warning: "!",
    error: "✗",
  };

  const top = $derived(position.startsWith("top"));
  const right = $derived(position.endsWith("right"));
  /** Rows the toasts can use (measured; the parent's height minus a margin) */
  let room = $state(Infinity);

  /** Rows a toast takes: its border, title, and message wrapped like the renderer does */
  function rows_of(toast: Toast): number {
    const text = toast.title
      ? toast.message
      : `${icons[toast.kind]} ${toast.message}`;
    const lines = layoutText([{ text, style: {} }], Math.max(1, width - 4));
    return 2 + (toast.title ? 1 : 0) + lines.length;
  }

  // the newest toasts that fit (always at least one)
  const shown = $derived.by(() => {
    const out: Toast[] = [];
    let used = 0;
    const recent = store.items.slice(-max);
    for (let i = recent.length - 1; i >= 0; i--) {
      const rows = rows_of(recent[i]);
      if (out.length > 0 && used + rows > room) break;
      used += rows;
      out.unshift(recent[i]);
    }
    return out;
  });

  $effect(() => () => store.clear());
</script>

<!-- measures the room for toasts: the whole height, minus a row at each end -->
<box
  position="absolute"
  top={1}
  bottom={1}
  width={0}
  onlayout={(e: LayoutEvent) => (room = e.height)}
></box>

{#if shown.length > 0}
  <box
    position="absolute"
    top={top ? 1 : undefined}
    bottom={top ? undefined : 1}
    right={right ? 2 : undefined}
    left={right ? undefined : 2}
    {width}
  >
    {#each top ? [...shown].reverse() : shown as toast (toast.id)}
      <box
        border="round"
        borderColor={colors[toast.kind]}
        bg={theme.surface}
        paddingX={1}
        onclick={() => store.dismiss(toast.id)}
      >
        {#if toast.title}
          <txt bold color={colors[toast.kind]}
            >{icons[toast.kind]} {toast.title}</txt
          >
          <txt>{toast.message}</txt>
        {:else}
          <txt
            ><txt bold color={colors[toast.kind]}>{icons[toast.kind]}</txt>
            {toast.message}</txt
          >
        {/if}
      </box>
    {/each}
  </box>
{/if}
