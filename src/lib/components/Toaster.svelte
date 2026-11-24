<script lang="ts">
  import { useApp } from "../runtime/context.js";
  import { toastStore, type ToastKind } from "../runtime/toast.svelte.js";
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
  const shown = $derived(store.items.slice(-max));

  $effect(() => () => store.clear());
</script>

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
