<script lang="ts">
  import { untrack } from "svelte";
  import { Tabs } from "../../../src/lib/index.ts";
  let { init, ctl = {} }: { init: any; ctl?: any } = $props();
  const s = $state({ ...untrack(() => init) });
  untrack(() => ctl).s = s;
</script>

<box height="100%">
  <Tabs items={s.items} bind:value={s.value} autofocus />
  <txt>value: {String(s.value)}</txt>
</box>
