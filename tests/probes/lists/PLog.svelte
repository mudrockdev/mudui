<script lang="ts">
  import { untrack } from "svelte";
  import { LogView } from "../../../src/lib/index.ts";
  let { init, ctl = {} }: { init: any; ctl?: any } = $props();
  const s = $state({ count: 20, ...init });
  ctl.s = s;
  const lines = $derived(Array.from({ length: s.count }, (_, i) => `line ${i}`));
</script>

<box height="100%">
  <txt>header</txt>
  <LogView lines={lines} height={s.height} grow={s.grow} follow={s.follow ?? true} />
  <txt>footer</txt>
</box>
