<!-- LogView with a large backlog, appending a line per frame (virtualized list). -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { Bench } from "../bench.ts";
  import { LogView } from "../../src/lib/index.ts";

  const bench = getContext<Bench>("bench");
  const count = bench.count ?? 10_000;

  const LEVELS = ["info", "warn", "error", "debug"] as const;
  const COLORS = { info: "green", warn: "yellow", error: "red", debug: "gray" };
  const line = (i: number) => {
    const level = LEVELS[i % LEVELS.length];
    return {
      text: `${String(i).padStart(6, "0")} ${level.padEnd(5)} request handled in ${(i * 37) % 900}ms`,
      color: COLORS[level],
    };
  };

  let lines = $state(Array.from({ length: count }, (_, i) => line(i)));
  let n = count;
  bench.tick = () => {
    lines.push(line(n++));
  };
</script>

<box height="100%">
  <LogView {lines} grow={1} />
</box>
