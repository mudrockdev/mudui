<script lang="ts">
  import {
    ProgressBar,
    Sparkline,
    BarChart,
    Badge,
    Divider,
    KeyHints,
    Spinner,
    Panel,
  } from "../../../src/lib/index.ts";
  let { variant, p = {} }: { variant: string; p?: any } = $props();
</script>

{#if variant === "progress"}
  <ProgressBar {...p} />
{:else if variant === "progress-row"}
  <box row><txt>left</txt><ProgressBar {...p} /></box>
{:else if variant === "spark"}
  <Sparkline {...p} />
{:else if variant === "bar"}
  <BarChart {...p} />
{:else if variant === "bar-row"}
  <box row><txt>side</txt><box grow={1}><BarChart {...p} /></box></box>
{:else if variant === "badge"}
  <box row><Badge {...p} /><txt>after</txt></box>
{:else if variant === "divider"}
  <Divider {...p} />
{:else if variant === "keyhints"}
  <KeyHints {...p} />
{:else if variant === "spinner"}
  <Spinner {...p} />
{:else if variant === "panel"}
  <Panel {...p}><txt>content</txt></Panel>
{/if}
