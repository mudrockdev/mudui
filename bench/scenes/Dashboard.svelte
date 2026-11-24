<!-- A realistic monitoring screen: tabs, a table, sparklines, gauges and a log, with a few values changing per frame. -->
<script lang="ts">
  import { getContext } from "svelte";
  import type { Bench } from "../bench.ts";
  import {
    KeyHints,
    LogView,
    Panel,
    ProgressBar,
    Sparkline,
    Table,
    Tabs,
  } from "../../src/lib/index.ts";

  const bench = getContext<Bench>("bench");

  type Proc = { pid: number; name: string; cpu: number; mem: number };
  const NAMES = ["postgres", "node", "bun", "nginx", "redis", "sshd", "cron"];

  let tab = $state("overview");
  let procs = $state<Proc[]>(
    Array.from({ length: 40 }, (_, i) => ({
      pid: 1000 + i * 7,
      name: NAMES[i % NAMES.length],
      cpu: (i * 13) % 100,
      mem: (i * 29) % 4096,
    })),
  );
  let series = $state(
    Array.from({ length: 4 }, (_, s) =>
      Array.from({ length: 40 }, (_, i) => Math.sin((i + s * 10) / 4) + 1),
    ),
  );
  let gauges = $state([0.2, 0.45, 0.7, 0.9]);
  let log = $state<string[]>(
    Array.from({ length: 200 }, (_, i) => `boot step ${i} ok`),
  );

  let t = 0;
  bench.tick = () => {
    t++;
    for (const s of series) {
      s.shift();
      s.push(Math.sin(t / 4 + s.length) + 1 + Math.random() * 0.2);
    }
    gauges[t % 4] = (gauges[t % 4] + 0.013) % 1;
    const p = procs[t % procs.length];
    p.cpu = (p.cpu + 7) % 100;
    if (t % 3 === 0) log.push(`tick ${t}: ${p.name} cpu ${p.cpu}%`);
  };

  const columns = [
    { key: "pid", title: "PID", width: 6, align: "right" as const },
    { key: "name", title: "Name", grow: true },
    {
      key: "cpu",
      title: "CPU%",
      width: 5,
      align: "right" as const,
      color: (r: Proc) => (r.cpu > 80 ? "red" : undefined),
    },
    { key: "mem", title: "MiB", width: 6, align: "right" as const },
  ];
</script>

<box height="100%">
  <box row padding="0 1" gap={2}>
    <txt bold color="magenta">mudmon</txt>
    <Tabs items={["overview", "processes", "logs"]} bind:value={tab} />
  </box>
  <box row grow={1}>
    <Panel title="Processes" grow={1}>
      <Table {columns} rows={procs} height={20} />
    </Panel>
    <box width={44}>
      <Panel title="Load">
        {#each series as data, i (i)}
          <box row gap={1}>
            <txt dim>cpu{i}</txt>
            <Sparkline {data} width={36} color="cyan" />
          </box>
        {/each}
      </Panel>
      <Panel title="Disks">
        {#each gauges as value, i (i)}
          <ProgressBar {value} label={`sd${"abcd"[i]}`} showPercent />
        {/each}
      </Panel>
      <Panel title="Log" grow={1}>
        <LogView lines={log} grow={1} />
      </Panel>
    </box>
  </box>
  <box padding="0 1">
    <KeyHints hints={{ tab: "switch", "↑↓": "select", q: "quit" }} />
  </box>
</box>
