<script lang="ts">
  import { KeyHints, Spinner, getTheme } from "mudui";
  import type { View } from "../lib/tasks.svelte.ts";

  let {
    saving,
    message,
    view,
  }: { saving: boolean; message: string; view: View } = $props();

  const theme = getTheme();
  const hints = $derived<Record<string, string>>(
    view === "tasks"
      ? {
          n: "add",
          space: "toggle",
          e: "edit",
          o: "details",
          d: "delete",
          "/": "filter",
          "ctrl+p": "commands",
          q: "quit",
        }
      : {
          "1-6": "views",
          tab: "focus",
          "ctrl+p": "commands",
          esc: "back",
          q: "quit",
        },
  );
</script>

<box row paddingX={1} gap={2}>
  <box grow={1}>
    <KeyHints {hints} />
  </box>
  {#if saving}
    <Spinner label="saving" color={theme.muted} />
  {:else if message}
    <txt wrap="truncate" shrink={0} maxWidth="60%" color={theme.success}
      >{message}</txt
    >
  {/if}
</box>
