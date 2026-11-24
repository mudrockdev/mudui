<script lang="ts">
  import { untrack } from "svelte";
  import { ScrollView } from "../../../src/lib/index.ts";
  let { init, ctl = {} }: { init: any; ctl?: any } = $props();
  const s = $state({ count: 20, offset: 0, ...init });
  ctl.s = s;
</script>

<box height="100%">
  <txt>header</txt>
  <ScrollView height={s.height} grow={s.grow} follow={s.follow} bind:offset={s.offset}>
    {#each { length: s.count }, i}
      <txt>{s.prefix ?? "line"} {i}</txt>
    {/each}
  </ScrollView>
  <txt>footer offset: {s.offset}</txt>
</box>
