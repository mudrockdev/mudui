/**
 * Promise-based dialogs: `await confirm(...)`, `await prompt(...)`, `await alert(...)`.
 * Get them with `useDialog()` and render them with `<DialogHost />`.
 */
import type { App } from "./app.js";
import { useApp } from "./context.js";

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive */
  danger?: boolean;
}

export interface PromptOptions {
  title?: string;
  initial?: string;
  placeholder?: string;
  mask?: string;
}

export interface AlertOptions {
  title?: string;
  okLabel?: string;
}

export type DialogRequest =
  | ({
      kind: "confirm";
      message: string;
      resolve: (value: boolean) => void;
    } & ConfirmOptions)
  | ({
      kind: "prompt";
      message: string;
      resolve: (value: string | null) => void;
    } & PromptOptions)
  | ({
      kind: "alert";
      message: string;
      resolve: (value: void) => void;
    } & AlertOptions);

export class DialogStore {
  /** Pending dialogs; the first one is shown */
  queue = $state.raw<DialogRequest[]>([]);

  #open<T>(request: Omit<DialogRequest, "resolve">): Promise<T> {
    return new Promise<T>((resolve) => {
      this.queue = [...this.queue, { ...request, resolve } as DialogRequest];
    });
  }

  confirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
    return this.#open({ kind: "confirm", message, ...options });
  }

  prompt(message: string, options: PromptOptions = {}): Promise<string | null> {
    return this.#open({ kind: "prompt", message, ...options });
  }

  alert(message: string, options: AlertOptions = {}): Promise<void> {
    return this.#open({ kind: "alert", message, ...options });
  }

  /** Closes the current dialog with an answer */
  answer(value: boolean | string | null | void): void {
    const [current, ...rest] = this.queue;
    if (!current) return;
    this.queue = rest;
    (current.resolve as (value: unknown) => void)(value);
  }
}

const stores = new WeakMap<App, DialogStore>();

export function dialogStore(app: App): DialogStore {
  let store = stores.get(app);
  if (!store) stores.set(app, (store = new DialogStore()));
  return store;
}

/**
 * Promise-based dialogs, rendered by `<DialogHost />`.
 * Must be called during component initialisation; the functions can be called anytime.
 */
export function useDialog(): Pick<DialogStore, "confirm" | "prompt" | "alert"> {
  const store = dialogStore(useApp());
  return {
    confirm: (message, options) => store.confirm(message, options),
    prompt: (message, options) => store.prompt(message, options),
    alert: (message, options) => store.alert(message, options),
  };
}
