<!-- Worst case for the diff: every cell changes character and background each frame. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { Bench } from "../bench.ts";
  const bench = getContext<Bench>("bench");

  const SEGMENT = 10;
  const CHARS = "░▒▓█▓▒";
  let frame = $state(0);
  let columns = $state(0);
  let rows = $state(0);

  bench.tick = () => frame++;

  function color(x: number, y: number, t: number): string {
    const r = (x * 7 + t * 5) % 256;
    const g = (y * 11 + t * 3) % 256;
    const b = (x * 3 + y * 5 + t * 7) % 256;
    return `rgb(${r},${g},${b})`;
  }
</script>

<box
  height="100%"
  onlayout={(e) => {
    columns = e.width;
    rows = e.height;
  }}
>
  {#each { length: rows }, y (y)}
    <txt wrap="none">
      {#each { length: Math.ceil(columns / SEGMENT) }, s (s)}
        <txt bg={color(s, y, frame)} color={color(y, s, frame + 40)}
          >{CHARS[(s + y + frame) % CHARS.length].repeat(SEGMENT)}</txt
        >
      {/each}
    </txt>
  {/each}
</box>
