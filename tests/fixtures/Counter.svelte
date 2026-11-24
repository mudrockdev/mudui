<script lang="ts">
  import type { KeyEvent } from "../../src/lib/index.ts";

  let count = $state(0);
  let items = $state(["alpha", "beta", "gamma"]);
  let log = $state<string[]>([]);

  function onkeydown(event: KeyEvent) {
    log.push(`box:${event.key}`);
    if (event.key === "+") count++;
    if (event.key === "r") items.reverse();
    if (event.key === "x") items.splice(1, 1);
    if (event.key === "a") items.push("delta");
  }
</script>

<box focusable autofocus {onkeydown} onclick={() => count++}>
  <txt>count: {count}</txt>
  {#each items as item (item)}
    <txt>- {item}</txt>
  {/each}
  {#if count >= 2}
    <txt color="green">two or more</txt>
  {:else}
    <txt dim>less than two</txt>
  {/if}
  <txt>log: {log.join(",")}</txt>
</box>
