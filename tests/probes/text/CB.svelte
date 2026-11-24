<script lang="ts">
  import { Combobox } from "../../../src/lib/index.ts";
  import { s } from "./state.svelte.ts";
  let { height = 4 }: any = $props();
</script>

<box width={30}>
  <Combobox items={s.items} bind:query={s.query} {height} autofocus onselect={(v: any) => (s.chosen = v)} oncancel={() => s.log.push("cancel")} />
  <txt>chosen: {String(s.chosen)}</txt>
</box>
