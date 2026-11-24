<script lang="ts">
  import { store } from "./store.svelte.ts";
</script>

<box>
  {#each store.lines as line, i (i)}
    <txt color={i === 0 ? store.color : undefined}>{line}</txt>
  {/each}
</box>
