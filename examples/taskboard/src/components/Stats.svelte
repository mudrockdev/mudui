<script lang="ts">
  import {
    BarChart,
    Divider,
    Panel,
    ProgressBar,
    ScrollView,
    Sparkline,
    Table,
    getTheme,
    type TableColumn,
  } from "mudui";
  import type { Priority, TaskStore } from "../lib/tasks.svelte.ts";

  let { store }: { store: TaskStore } = $props();

  const theme = getTheme();

  type Row = { priority: Priority; open: number; done: number };
  const priorities: Priority[] = ["high", "normal", "low"];
  const rows = $derived<Row[]>(
    priorities.map((priority) => ({
      priority,
      open: store.tasks.filter((t) => t.priority === priority && !t.done)
        .length,
      done: store.tasks.filter((t) => t.priority === priority && t.done).length,
    })),
  );
  const columns: TableColumn<Row>[] = [
    {
      key: "priority",
      title: "Priority",
      color: (row) =>
        row.priority === "high"
          ? theme.danger
          : row.priority === "low"
            ? theme.muted
            : undefined,
    },
    { key: "open", title: "Open", align: "right" },
    { key: "done", title: "Done", align: "right" },
  ];
  const width = $derived(Math.max(8, ...store.lists.map((l) => l.length)) + 1);

  const open_by_list = $derived(
    store.lists.map((list) => ({ label: list, value: store.openCount(list) })),
  );
  const DAYS = 14;
  const finished = $derived(store.completionsByDay(DAYS));
  const finished_total = $derived(finished.reduce((a, b) => a + b, 0));
  const hours_left = $derived(
    store.tasks
      .filter((t) => !t.done)
      .reduce((sum, t) => sum + (t.estimate ?? 0), 0),
  );
</script>

<!-- shrink: in a short terminal the row takes the free space, not its content's
     height (which would push the status bar off screen); the side panels scroll -->
<box row grow={1} shrink={1} gap={1}>
  <Panel title="Progress by list" grow={1} gap={1}>
    {#each store.lists as list (list)}
      {@const tasks = store.tasksIn(list)}
      {@const done = tasks.filter((t) => t.done).length}
      <box row gap={1}>
        <txt {width} wrap="truncate">{list}</txt>
        <ProgressBar value={done} max={tasks.length || 1} showPercent />
        <txt width={7} color={theme.muted} textAlign="right"
          >{done}/{tasks.length}</txt
        >
      </box>
    {/each}
  </Panel>
  <box width={36}>
    <ScrollView grow={1} gap={1}>
      <Panel title="By priority">
        <Table {columns} {rows} focusable={false} />
      </Panel>
      <Panel title="Open by list">
        <BarChart data={open_by_list} color={theme.accent} />
      </Panel>
      <Panel title="Momentum">
        <Divider title={`finished, last ${DAYS} days`} />
        <box row gap={1}>
          <Sparkline data={finished} width={DAYS} color={theme.success} min={0} />
          <txt color={theme.muted}>{finished_total} total</txt>
        </box>
        <Divider title="estimated work left" />
        <txt>{hours_left ? `${hours_left}h` : "no estimates"}</txt>
      </Panel>
    </ScrollView>
  </box>
</box>
