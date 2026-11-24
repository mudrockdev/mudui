import { sampleData, type Data } from "./tasks.svelte.ts";

/** `$MUDTASKS_FILE`, or `$XDG_DATA_HOME/mudtasks/tasks.json` (default `~/.local/share`) */
export function defaultPath(): string {
  if (Bun.env.MUDTASKS_FILE) return Bun.env.MUDTASKS_FILE;
  const home = Bun.env.HOME ?? Bun.env.USERPROFILE ?? ".";
  const base = Bun.env.XDG_DATA_HOME || `${home}/.local/share`;
  return `${base}/mudtasks/tasks.json`;
}

export async function load(path: string): Promise<Data> {
  const file = Bun.file(path);
  if (!(await file.exists())) return sampleData();
  const data = (await file.json()) as Partial<Data>;
  return {
    lists: Array.isArray(data.lists) ? data.lists : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
  };
}

/** Writes atomically, so a crash never leaves a half-written file */
export async function save(path: string, data: Data): Promise<void> {
  const temp = `${path}.${process.pid}.tmp`;
  // Bun.write creates missing directories
  await Bun.write(temp, JSON.stringify(data, null, "\t"));
  await Bun.$`mv ${temp} ${path}`.quiet();
}
