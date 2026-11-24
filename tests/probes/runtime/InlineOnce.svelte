<script lang="ts">
  import { onMount } from "svelte";
  import { useApp } from "../../../src/lib/index.ts";
  const app = useApp();
  // print once and quit (e.g. a CLI that renders a summary table)
  onMount(() => app.exit());
</script>

<box>
  <txt>line one</txt>
  <txt>line two</txt>
</box>
