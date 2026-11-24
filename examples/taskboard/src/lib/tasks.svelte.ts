/**
 * The task store: plain data in, reactive state out. Persistence lives in
 * `storage.ts`; the store only knows how to change itself.
 */

export type Priority = "low" | "normal" | "high";

export type View = "tasks" | "stats" | "help";

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: Priority;
  list: string;
  created: number;
}

export interface Data {
  lists: string[];
  tasks: Task[];
}

const PRIORITIES: Priority[] = ["low", "normal", "high"];

let counter = 0;
const new_id = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export class TaskStore {
  lists = $state<string[]>([]);
  tasks = $state<Task[]>([]);

  constructor(data: Data) {
    this.lists = data.lists.length > 0 ? [...data.lists] : ["Inbox"];
    this.tasks = data.tasks.map((task) => ({ ...task }));
  }

  tasksIn(list: string): Task[] {
    return this.tasks.filter((task) => task.list === list);
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
    // return the reactive proxy, not the raw object, so identity checks work
    return this.tasks[this.tasks.length - 1];
  }

  find(id: string): Task | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  toggle(id: string): void {
    const task = this.find(id);
    if (task) task.done = !task.done;
  }

  rename(id: string, title: string): void {
    const task = this.find(id);
    if (task && title.trim()) task.title = title.trim();
  }

  cyclePriority(id: string): void {
    const task = this.find(id);
    if (task)
      task.priority =
        PRIORITIES[(PRIORITIES.indexOf(task.priority) + 1) % PRIORITIES.length];
  }

  remove(id: string): void {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index !== -1) this.tasks.splice(index, 1);
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
    return before - this.tasks.length;
  }

  addList(name: string): string | null {
    name = name.trim();
    if (!name || this.lists.includes(name)) return null;
    this.lists.push(name);
    return name;
  }

  removeList(name: string): void {
    if (this.lists.length <= 1) return;
    this.lists = this.lists.filter((list) => list !== name);
    this.tasks = this.tasks.filter((task) => task.list !== name);
  }

  toJSON(): Data {
    return {
      lists: $state.snapshot(this.lists),
      tasks: $state.snapshot(this.tasks),
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
  ): Task => ({
    id: new_id(),
    title,
    done,
    priority,
    list,
    created: now,
  });
  return {
    lists: ["Inbox", "Work", "Personal"],
    tasks: [
      task("Try mudtasks — press ? for help", "Inbox", "high"),
      task("Add a task with n", "Inbox"),
      task("Toggle tasks with space", "Inbox", "normal", true),
      task("Review pull requests", "Work", "high"),
      task("Write the quarterly report", "Work"),
      task("Update dependencies", "Work", "low"),
      task("Buy groceries", "Personal"),
      task("Call the bank", "Personal", "high"),
    ],
  };
};
