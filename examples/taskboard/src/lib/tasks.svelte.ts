/**
 * The task store: plain data in, reactive state out. Persistence lives in
 * `storage.ts`; the store only knows how to change itself.
 */

export type Priority = "low" | "normal" | "high";

export type View =
  "tasks" | "outline" | "stats" | "activity" | "settings" | "help";

export type SortOrder = "manual" | "priority" | "title";

export interface Settings {
  /** Show finished tasks in the task list */
  showDone: boolean;
  /** Ask before deleting a task */
  confirmDelete: boolean;
  sort: SortOrder;
  /** Seconds of quiet before changes are saved */
  autosave: number;
  /** Line numbers in the notes editor */
  lineNumbers: boolean;
}

export const defaultSettings = (): Settings => ({
  showDone: true,
  confirmDelete: true,
  sort: "manual",
  autosave: 0.5,
  lineNumbers: false,
});

export const DEFAULT_TAGS = ["bug", "feature", "chore", "home", "errand"];

export type ActivityKind =
  "add" | "done" | "edit" | "delete" | "info" | "error";

export interface Activity {
  time: number;
  kind: ActivityKind;
  text: string;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  list: string;
  created: number;
  notes?: string;
  tags?: string[];
  /** Estimated hours */
  estimate?: number;
  /** When the task was last marked done */
  doneAt?: number;
}

export interface Data {
  lists: string[];
  tasks: Task[];
  tags?: string[];
  settings?: Partial<Settings>;
}

const PRIORITIES: Priority[] = ["low", "normal", "high"];
const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

let counter = 0;
const new_id = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export class TaskStore {
  lists = $state<string[]>([]);
  tasks = $state<Task[]>([]);
  tags = $state<string[]>([]);
  settings = $state<Settings>(defaultSettings());
  /** What happened this session, oldest first (not saved) */
  activity = $state<Activity[]>([]);

  constructor(data: Data) {
    this.load(data);
  }

  /** Replaces everything with `data` */
  load(data: Data): void {
    this.lists = data.lists.length > 0 ? [...data.lists] : ["Inbox"];
    this.tasks = data.tasks.map((task) => ({ ...task }));
    this.tags = data.tags?.length ? [...data.tags] : [...DEFAULT_TAGS];
    this.settings = { ...defaultSettings(), ...data.settings };
  }

  log(text: string, kind: ActivityKind = "info"): void {
    this.activity.push({ time: Date.now(), kind, text });
    if (this.activity.length > 1000) this.activity.splice(0, 100);
  }

  tasksIn(list: string): Task[] {
    return this.tasks.filter((task) => task.list === list);
  }

  /** The tasks of a list as the task list shows them: filtered and sorted per the settings */
  visibleIn(list: string): Task[] {
    let tasks = this.tasksIn(list);
    if (!this.settings.showDone) tasks = tasks.filter((task) => !task.done);
    if (this.settings.sort === "priority")
      tasks = tasks.toSorted(
        (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
      );
    else if (this.settings.sort === "title")
      tasks = tasks.toSorted((a, b) => a.title.localeCompare(b.title));
    return tasks;
  }

  /** Tasks finished on each of the last `days` days, oldest first */
  completionsByDay(days: number, now = Date.now()): number[] {
    const DAY = 86_400_000;
    const today = Math.floor(now / DAY);
    const counts = Array(days).fill(0);
    for (const task of this.tasks) {
      if (!task.done || task.doneAt === undefined) continue;
      const ago = today - Math.floor(task.doneAt / DAY);
      if (ago >= 0 && ago < days) counts[days - 1 - ago]++;
    }
    return counts;
  }

  openCount(list: string): number {
    return this.tasks.filter((task) => task.list === list && !task.done).length;
  }

  get doneCount(): number {
    return this.tasks.filter((task) => task.done).length;
  }

  add(list: string, title: string, priority: Priority = "normal"): Task | null {
    title = title.trim();
    if (!title) return null;
    const task: Task = {
      id: new_id(),
      title,
      done: false,
      priority,
      list,
      created: Date.now(),
    };
    this.tasks.push(task);
    this.log(`Added “${title}” to ${list}`, "add");
    // return the reactive proxy, not the raw object, so identity checks work
    return this.tasks[this.tasks.length - 1];
  }

  find(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  toggle(id: string): void {
    const task = this.find(id);
    if (!task) return;
    task.done = !task.done;
    task.doneAt = task.done ? Date.now() : undefined;
    this.log(
      `${task.done ? "Finished" : "Reopened"} “${task.title}”`,
      task.done ? "done" : "edit",
    );
  }

  rename(id: string, title: string): void {
    const task = this.find(id);
    if (!task || !title.trim() || task.title === title.trim()) return;
    this.log(`Renamed “${task.title}” to “${title.trim()}”`, "edit");
    task.title = title.trim();
  }

  /** Applies the changes from the details editor */
  update(
    id: string,
    changes: Partial<Omit<Task, "id" | "created" | "doneAt">>,
  ): void {
    const task = this.find(id);
    if (!task) return;
    if (changes.title !== undefined && !changes.title.trim())
      delete changes.title;
    if (changes.title) changes.title = changes.title.trim();
    if (changes.done !== undefined && changes.done !== task.done)
      task.doneAt = changes.done ? Date.now() : undefined;
    const moved = changes.list !== undefined && changes.list !== task.list;
    if (moved) this.log(`Moved “${task.title}” to ${changes.list}`, "edit");
    Object.assign(task, changes);
    if (moved) {
      // a moved task goes to the end of its new list
      const index = this.tasks.indexOf(task);
      this.tasks.push(...this.tasks.splice(index, 1));
    }
    this.log(`Updated “${task.title}”`, "edit");
  }

  cyclePriority(id: string): void {
    const task = this.find(id);
    if (task)
      task.priority =
        PRIORITIES[(PRIORITIES.indexOf(task.priority) + 1) % PRIORITIES.length];
  }

  remove(id: string): void {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index === -1) return;
    this.log(`Deleted “${this.tasks[index].title}”`, "delete");
    this.tasks.splice(index, 1);
  }

  /** Moves a task up or down among the tasks of its list */
  move(id: string, delta: -1 | 1): void {
    const task = this.find(id);
    if (!task) return;
    const siblings = this.tasksIn(task.list);
    const target = siblings[siblings.indexOf(task) + delta];
    if (!target) return;
    const a = this.tasks.indexOf(task);
    const b = this.tasks.indexOf(target);
    [this.tasks[a], this.tasks[b]] = [this.tasks[b], this.tasks[a]];
  }

  clearDone(list: string): number {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((task) => task.list !== list || !task.done);
    const removed = before - this.tasks.length;
    if (removed) this.log(`Cleared ${removed} finished in ${list}`, "delete");
    return removed;
  }

  addList(name: string): string | null {
    name = name.trim();
    if (!name || this.lists.includes(name)) return null;
    this.lists.push(name);
    this.log(`Created list ${name}`, "add");
    return name;
  }

  removeList(name: string): void {
    if (this.lists.length <= 1) return;
    this.lists = this.lists.filter((list) => list !== name);
    this.tasks = this.tasks.filter((task) => task.list !== name);
    this.log(`Deleted list ${name}`, "delete");
  }

  toJSON(): Data {
    return {
      lists: $state.snapshot(this.lists),
      tasks: $state.snapshot(this.tasks),
      tags: $state.snapshot(this.tags),
      settings: $state.snapshot(this.settings),
    };
  }
}

export const sampleData = (): Data => {
  const now = Date.now();
  const task = (
    title: string,
    list: string,
    priority: Priority = "normal",
    done = false,
    extra: Partial<Task> = {},
  ): Task => ({
    id: new_id(),
    title,
    done,
    priority,
    list,
    created: now,
    ...(done ? { doneAt: now } : {}),
    ...extra,
  });
  return {
    lists: ["Inbox", "Work", "Personal"],
    tasks: [
      task("Try mudtasks — press ? for help", "Inbox", "high"),
      task("Add a task with n", "Inbox"),
      task("Toggle tasks with space", "Inbox", "normal", true),
      task("Review pull requests", "Work", "high", false, {
        tags: ["feature"],
        estimate: 2,
      }),
      task("Write the quarterly report", "Work", "normal", false, {
        notes: "Numbers are in the shared drive.\nAsk finance for Q3.",
        estimate: 4,
      }),
      task("Update dependencies", "Work", "low", false, { tags: ["chore"] }),
      task("Buy groceries", "Personal", "normal", false, {
        tags: ["errand"],
        notes: "milk, eggs, coffee",
      }),
      task("Call the bank", "Personal", "high"),
    ],
  };
};
