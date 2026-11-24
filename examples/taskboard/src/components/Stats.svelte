<script lang="ts">
  import { Panel, ProgressBar, Table, getTheme, type TableColumn } from "mudui";
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
</script>

<box row grow={1} gap={1}>
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
  <Panel title="By priority" width={32}>
    <Table {columns} {rows} focusable={false} />
  </Panel>
</box>
