<!-- The smallest realistic update: one number changes inside a bordered panel. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { Bench } from "../bench.ts";
  import { Panel } from "../../src/lib/index.ts";

  const bench = getContext<Bench>("bench");
  let count = $state(0);
  bench.tick = () => count++;
</script>

<box height="100%" padding={1}>
  <Panel title="Counter" width={30}>
    <txt>Count: <txt bold color="cyan">{count}</txt></txt>
    <txt dim>q to quit</txt>
  </Panel>
</box>
