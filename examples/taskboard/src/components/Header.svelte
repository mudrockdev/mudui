<script lang="ts">
  import { Badge, ProgressBar, Spacer, Tabs, useTerminalSize } from "mudui";
  import type { TaskStore, View } from "../lib/tasks.svelte.ts";

  let { store, view = $bindable() }: { store: TaskStore; view: View } =
    $props();

  const size = useTerminalSize();
  const total = $derived(store.tasks.length);
  const done = $derived(store.doneCount);

  const VIEWS: Array<{ label: string; value: View }> = [
    { label: "Tasks", value: "tasks" },
    { label: "Outline", value: "outline" },
    { label: "Stats", value: "stats" },
    { label: "Activity", value: "activity" },
    { label: "Settings", value: "settings" },
    { label: "Help", value: "help" },
  ];
</script>

<box row gap={2} paddingX={1}>
  <Badge label="mudtasks" />
  <Tabs items={VIEWS} bind:value={view} />
  <Spacer />
  <txt wrap="none" shrink={0}>{done}/{total} done</txt>
  {#if size.columns >= 100}
    <ProgressBar value={done} max={total || 1} width={16} />
  {/if}
</box>
