<!-- Every list and its tasks as a tree. Enter on a task jumps to it. -->
<script lang="ts">
  import { Panel, Tree, getTheme, type TreeNode } from "mudui";
  import type { Task, TaskStore } from "../lib/tasks.svelte.ts";

  let {
    store,
    onopen,
  }: {
    store: TaskStore;
    /** Called with a task chosen in the tree */
    onopen: (task: Task) => void;
  } = $props();

  const theme = getTheme();

  let selected = $state<string | undefined>(undefined);
  let expanded = $state<string[]>([]);
  // start with every list open; lists created later start closed
  $effect.pre(() => {
    if (expanded.length === 0 && selected === undefined)
      expanded = store.lists.map((list) => `list:${list}`);
  });

  const nodes = $derived<TreeNode<Task | null>[]>(
    store.lists.map((list) => {
      const tasks = store.tasksIn(list);
      return {
        id: `list:${list}`,
        label: list,
        value: null,
        hint: `${tasks.filter((t) => !t.done).length}/${tasks.length}`,
        children: tasks.map((task) => ({
          id: task.id,
          label: `${task.done ? "✓" : "·"} ${task.title}`,
          value: task,
          hint: task.priority === "high" ? "!!" : (task.tags ?? []).join(" "),
          color: task.done
            ? theme.muted
            : task.priority === "high"
              ? theme.danger
              : undefined,
        })),
      };
    }),
  );
</script>

<Panel title="Outline" grow={1}>
  <Tree
    {nodes}
    bind:selected
    bind:expanded
    grow={1}
    guides
    autofocus
    onselect={(node) => {
      if (node.value) onopen(node.value);
    }}
  />
  <txt color={theme.muted}
    >Enter on a task opens it · ← → close and open lists</txt
  >
</Panel>
