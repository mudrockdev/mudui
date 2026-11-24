<!-- Text whose style, wrapping or width changes while the text stays the same -->
<script lang="ts">
  import { useInput } from "../../src/lib/index.ts";

  let color = $state("red");
  let wrap = $state<"wrap" | "truncate">("wrap");
  let width = $state(30);
  let bold = $state(false);
  let fill = $state(false);
  let loose = $state("loose text");

  useInput((event) => {
    if (event.key === "c") color = color === "red" ? "blue" : "red";
    if (event.key === "w") wrap = wrap === "wrap" ? "truncate" : "wrap";
    if (event.key === "n") width = width === 30 ? 12 : 30;
    if (event.key === "b") bold = !bold;
    if (event.key === "f") fill = !fill;
    if (event.key === "l") loose = loose === "loose text" ? "other words" : "loose text";
  });
</script>

<box {width}>
  <txt {color} {wrap}>the quick brown fox jumps</txt>
  <txt>plain <txt {bold}>nested</txt> end</txt>
  <txt fill={fill ? "." : undefined}>dots</txt>
  <box>{loose}</box>
</box>
