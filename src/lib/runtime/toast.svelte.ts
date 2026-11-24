/**
 * Toast notifications, scoped to an app. Show them with `useToast()` and
 * render them with `<Toaster />`.
 */
import type { App } from "./app.js";
import { useApp } from "./context.js";

export type ToastKind = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  title?: string;
  kind?: ToastKind;
  /** Milliseconds before the toast disappears; `0` keeps it until dismissed (default 3000) */
  duration?: number;
}

export interface Toast {
  id: number;
  message: string;
  title?: string;
  kind: ToastKind;
}

export class ToastStore {
  items = $state<Toast[]>([]);
  #next = 1;
  #timers = new Map<number, ReturnType<typeof setTimeout>>();

  show(message: string, options: ToastOptions = {}): number {
    const id = this.#next++;
    this.items.push({
      id,
      message,
      title: options.title,
      kind: options.kind ?? "info",
    });
    const duration = options.duration ?? 3000;
    if (duration > 0) {
      const timer = setTimeout(() => this.dismiss(id), duration);
      // don't keep the process alive just for a toast
      (timer as { unref?: () => void }).unref?.();
      this.#timers.set(id, timer);
    }
    return id;
  }

  dismiss(id: number): void {
    clearTimeout(this.#timers.get(id));
    this.#timers.delete(id);
    const index = this.items.findIndex((toast) => toast.id === id);
    if (index !== -1) this.items.splice(index, 1);
  }

  clear(): void {
    for (const timer of this.#timers.values()) clearTimeout(timer);
    this.#timers.clear();
    this.items = [];
  }
}

const stores = new WeakMap<App, ToastStore>();

export function toastStore(app: App): ToastStore {
  let store = stores.get(app);
  if (!store) stores.set(app, (store = new ToastStore()));
  return store;
}

export interface ToastFunction {
  (message: string, options?: ToastOptions): number;
  success(message: string, options?: Omit<ToastOptions, "kind">): number;
  warning(message: string, options?: Omit<ToastOptions, "kind">): number;
  error(message: string, options?: Omit<ToastOptions, "kind">): number;
  dismiss(id: number): void;
}

/**
 * Returns a function that shows toasts in this app (rendered by `<Toaster />`).
 * Must be called during component initialisation; the function can be called anytime.
 */
export function useToast(): ToastFunction {
  const store = toastStore(useApp());
  const toast = ((message: string, options?: ToastOptions) =>
    store.show(message, options)) as ToastFunction;
  toast.success = (message, options) =>
    store.show(message, { ...options, kind: "success" });
  toast.warning = (message, options) =>
    store.show(message, { ...options, kind: "warning" });
  toast.error = (message, options) =>
    store.show(message, { ...options, kind: "error" });
  toast.dismiss = (id) => store.dismiss(id);
  return toast;
}
