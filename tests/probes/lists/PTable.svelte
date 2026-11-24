<script lang="ts">
  import { untrack } from "svelte";
  import { Table } from "../../../src/lib/index.ts";
  let { init, ctl = {} }: { init: any; ctl?: any } = $props();
  const s = $state({ selected: 0, ...init });
  ctl.s = s;
</script>

<box height="100%">
  {#if s.row}
    <box row>
      <Table columns={s.columns} rows={s.rows} bind:selected={s.selected} height={s.height} autofocus />
      <txt>|side</txt>
    </box>
  {:else}
    <Table columns={s.columns} rows={s.rows} bind:selected={s.selected} height={s.height} autofocus />
  {/if}
  <txt>selected: {s.selected}</txt>
</box>
