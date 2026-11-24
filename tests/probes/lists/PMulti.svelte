<script lang="ts">
  import { untrack } from "svelte";
  import { MultiSelect } from "../../../src/lib/index.ts";
  let { init, ctl = {} }: { init: any; ctl?: any } = $props();
  const s = $state({ value: [], ...init });
  ctl.s = s;
</script>

<box height="100%">
  <MultiSelect items={s.items} bind:value={s.value} height={s.height} autofocus />
  <txt>value: {s.value.join(",")}</txt>
</box>
