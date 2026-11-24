<script lang="ts">
  import { untrack } from "svelte";
  import { Select } from "../../../src/lib/index.ts";
  let { init, ctl = {} }: { init: any; ctl?: any } = $props();
  const s = $state({ ...untrack(() => init) });
  untrack(() => ctl).s = s;
  let changes = $state(0);
</script>

<box height="100%">
  <Select
    items={s.items}
    bind:value={s.value}
    height={s.height}
    autofocus={s.autofocus ?? true}
    onchange={() => changes++}
  />
  <txt>value: {String(s.value)} changes: {changes}</txt>
</box>
