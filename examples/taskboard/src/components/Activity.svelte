<!-- What happened this session, newest at the bottom (LogView follows it). -->
<script lang="ts">
  import { LogView, Panel, getTheme, type ColorValue } from "mudui";
  import type { ActivityKind, TaskStore } from "../lib/tasks.svelte.ts";

  let { store }: { store: TaskStore } = $props();

  const theme = getTheme();
  const colors: Record<ActivityKind, ColorValue | undefined> = {
    add: theme.accent,
    done: theme.success,
    edit: undefined,
    delete: theme.warning,
    info: theme.muted,
    error: theme.danger,
  };
  const time = (t: number) =>
    new Date(t).toLocaleTimeString("en-GB", { hour12: false });

  const lines = $derived(
    store.activity.map((entry) => ({
      text: `${time(entry.time)}  ${entry.text}`,
      color: colors[entry.kind],
      dim: entry.kind === "info",
    })),
  );
</script>

<Panel title={`Activity · ${store.activity.length}`} grow={1}>
  {#if lines.length === 0}
    <txt color={theme.muted} italic
      >Nothing yet. Changes you make show up here.</txt
    >
  {:else}
    <LogView {lines} grow={1} />
  {/if}
</Panel>
