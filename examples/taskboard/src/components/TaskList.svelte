<script lang="ts">
  import {
    Panel,
    Scrollbar,
    TextInput,
    getTheme,
    useApp,
    type KeyEvent,
    type LayoutEvent,
    type TElement,
    type WheelEvent,
  } from "mudui";
  import type { Task, TaskStore } from "../lib/tasks.svelte.ts";
  import TaskRow from "./TaskRow.svelte";

  let {
    store,
    list,
    reveal = $bindable(null),
    ondelete,
    ondetails,
    onstatus,
  }: {
    store: TaskStore;
    list: string;
    /** Id of a task to move the cursor to (cleared once done) */
    reveal?: string | null;
    /** Asks for confirmation before deleting */
    ondelete: (task: Task) => void;
    /** Opens the details editor */
    ondetails: (task: Task) => void;
    onstatus: (message: string) => void;
  } = $props();

  const app = useApp();
  const theme = getTheme();

  let selected = $state(0);
  let offset = $state(0);
  let rows = $state(1);
  let focused = $state(false);
  let list_element: TElement | null = null;

  let adding = $state(false);
  let draft = $state("");
  let editing = $state<string | null>(null);
  let edit_draft = $state("");
  let filtering = $state(false);
  let filter = $state("");

  // reset the cursor and filter when switching lists
  let shown_list: string | undefined;
  $effect.pre(() => {
    if (shown_list !== undefined && list !== shown_list) {
      selected = 0;
      offset = 0;
      filter = "";
      filtering = false;
      adding = false;
      editing = null;
    }
    shown_list = list;
  });

  /** The tasks of the list, sorted and filtered per the settings */
  const all = $derived(store.visibleIn(list));
  const tasks = $derived(
    filter
      ? all.filter((task) =>
          task.title.toLowerCase().includes(filter.toLowerCase()),
        )
      : all,
  );
  const current = $derived(
    tasks[Math.min(selected, tasks.length - 1)] as Task | undefined,
  );
  const open = $derived(store.openCount(list));
  const hidden_done = $derived(
    store.settings.showDone ? 0 : store.tasksIn(list).length - all.length,
  );

  // keep the cursor in range and in view
  const index = $derived(Math.max(0, Math.min(selected, tasks.length - 1)));
  const top = $derived.by(() => {
    let start = Math.min(offset, Math.max(0, tasks.length - rows));
    if (index < start) start = index;
    if (index >= start + rows) start = index - rows + 1;
    return Math.max(0, start);
  });
  $effect.pre(() => {
    offset = top;
  });

  function move(delta: number) {
    selected = Math.max(0, Math.min(tasks.length - 1, index + delta));
  }

  function select_task(task: Task | null | undefined) {
    const i = task ? tasks.indexOf(task) : -1;
    if (i !== -1) selected = i;
  }

  function back_to_list() {
    if (list_element) app.focus(list_element);
  }

  // jump to a task chosen elsewhere (the outline)
  $effect.pre(() => {
    if (!reveal) return;
    const task = tasks.find((t) => t.id === reveal);
    if (!task && filter) filter = "";
    select_task(tasks.find((t) => t.id === reveal));
    reveal = null;
    queueMicrotask(back_to_list);
  });

  // commands the app can run (from the command palette)
  export function startAdding() {
    draft = "";
    adding = true;
  }

  export function startFiltering() {
    filtering = true;
  }

  export function openDetails() {
    if (current) ondetails(current);
  }

  export function toggleCurrent() {
    // read the task first: once toggled it may be hidden or sorted elsewhere
    const task = current;
    if (!task) return;
    store.toggle(task.id);
    onstatus(task.done ? `Done: ${task.title}` : `Reopened: ${task.title}`);
  }

  export function clearDone() {
    const removed = store.clearDone(list);
    onstatus(
      removed
        ? `Cleared ${removed} finished task${removed === 1 ? "" : "s"}`
        : "Nothing to clear",
    );
  }

  function reorder(task: Task, delta: -1 | 1) {
    if (store.settings.sort !== "manual") {
      onstatus("Reordering needs manual order (Settings → Task order)");
      return;
    }
    store.move(task.id, delta);
    select_task(task);
  }

  function onkeydown(event: KeyEvent) {
    const task = current;
    const k = event.key;

    if (k === "ArrowUp" || event.is("k")) move(-1);
    else if (k === "ArrowDown" || event.is("j")) move(1);
    else if (k === "Home" || event.is("g")) move(-tasks.length);
    else if (k === "End" || event.is("G")) move(tasks.length);
    else if (k === "PageUp") move(-rows);
    else if (k === "PageDown") move(rows);
    else if (event.is("n") || event.is("a")) startAdding();
    else if (event.is("/")) startFiltering();
    else if (event.is("c")) clearDone();
    else if (!task) return;
    else if (k === " " || event.is("x")) toggleCurrent();
    else if (event.is("o")) ondetails(task);
    else if (k === "Enter" || event.is("e")) {
      edit_draft = task.title;
      editing = task.id;
    } else if (event.is("d") || k === "Delete") ondelete(task);
    else if (event.is("p")) {
      store.cyclePriority(task.id);
      // the task may move when sorted by priority; keep the cursor on it
      select_task(task);
      onstatus(`Priority: ${task.priority}`);
    } else if (event.is("K") || (k === "ArrowUp" && event.shift))
      reorder(task, -1);
    else if (event.is("J") || (k === "ArrowDown" && event.shift))
      reorder(task, 1);
    else return;

    event.preventDefault();
    event.stopPropagation();
  }

  function add(title: string) {
    const task = store.add(list, title);
    if (task) {
      filter = "";
      onstatus(`Added: ${task.title}`);
      select_task(task);
    }
    draft = "";
    // keep the input open for the next task; Escape closes it
  }

  function save_edit(id: string) {
    store.rename(id, edit_draft);
    editing = null;
    back_to_list();
  }
</script>

<Panel title={`${list} · ${open} open`} grow={1}>
  {#if adding}
    <TextInput
      bind:value={draft}
      prefix="+ "
      placeholder="New task, Enter to add, Esc to finish"
      autofocus
      onsubmit={add}
      oncancel={() => {
        adding = false;
        back_to_list();
      }}
    />
  {/if}
  {#if filtering || filter}
    <TextInput
      bind:value={filter}
      prefix="/ "
      placeholder="filter"
      autofocus
      onsubmit={() => {
        filtering = false;
        back_to_list();
      }}
      oncancel={() => {
        filter = "";
        filtering = false;
        back_to_list();
      }}
    />
  {/if}
  <box row grow={1}>
    <box
      grow={1}
      focusable
      autofocus
      {onkeydown}
      onfocus={() => (focused = true)}
      onblur={() => (focused = false)}
      onwheel={(e: WheelEvent) => move(e.deltaY)}
      onlayout={(e: LayoutEvent) => (rows = Math.max(1, e.height))}
      {@attach (element: TElement) => {
        list_element = element;
      }}
    >
      {#each tasks.slice(top, top + rows) as task, i (task.id)}
        {#if editing === task.id}
          <TextInput
            bind:value={edit_draft}
            prefix="✎ "
            autofocus
            onsubmit={() => save_edit(task.id)}
            oncancel={() => {
              editing = null;
              back_to_list();
            }}
          />
        {:else}
          <TaskRow
            {task}
            selected={i + top === index}
            active={focused}
            onselect={() => (selected = i + top)}
            ontoggle={() => {
              selected = i + top;
              store.toggle(task.id);
            }}
          />
        {/if}
      {:else}
        <txt color={theme.muted} italic>
          {filter
            ? `Nothing matches “${filter}”.`
            : hidden_done
              ? `All ${hidden_done} tasks here are finished (hidden in Settings).`
              : "No tasks here. Press n to add one."}
        </txt>
      {/each}
    </box>
    {#if tasks.length > rows}
      <Scrollbar
        total={tasks.length}
        visible={rows}
        offset={top}
        height={rows}
      />
    {/if}
  </box>
  {#if tasks.length > rows}
    <txt color={theme.muted} textAlign="right">{index + 1}/{tasks.length}</txt>
  {/if}
</Panel>
