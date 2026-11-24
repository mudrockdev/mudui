<!-- A long, non-virtualized list in a scroll container: layout cost of off-screen content. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { Bench } from "../bench.ts";
  const bench = getContext<Bench>("bench");
  const count = bench.count ?? 1000;

  let rows = $state(
    Array.from({ length: count }, (_, i) => ({
      id: i,
      label: `Item ${i}`,
      done: i % 3 === 0,
    })),
  );
  let offset = $state(0);
  let frame = 0;

  bench.tick = () => {
    frame++;
    offset = frame % (count - 20);
    const row = rows[frame % count];
    row.done = !row.done;
  };
</script>

<box height="100%" border="round" title="Items">
  <box grow={1} scrollY={offset}>
    {#each rows as row (row.id)}
      <box row gap={1}>
        <txt color={row.done ? "green" : "gray"}>{row.done ? "[✓]" : "[ ]"}</txt
        >
        <txt grow={1} strike={row.done}>{row.label}</txt>
        <txt dim>#{row.id}</txt>
      </box>
    {/each}
  </box>
</box>
