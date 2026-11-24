/**
 * Helpers for components to reach the running app.
 */
import { getContext, onMount } from 'svelte';
import type { App } from './app.js';
import type { KeyEvent } from './events.js';

export const APP_KEY = Symbol('mudui.app');

/** The app this component is rendered in. Must be called during component initialisation. */
export function useApp(): App {
	const app = getContext<App | undefined>(APP_KEY);
	if (!app) throw new Error('mudui: useApp() must be called inside a component rendered with mudui');
	return app;
}

/**
 * Handles key presses anywhere in the app, after they bubbled through the
 * focused element's ancestors. Call `event.stopPropagation()` to stop other
 * global handlers, or `event.preventDefault()` to prevent default actions
 * like focus cycling with Tab.
 *
 * Must be called during component initialisation.
 */
export function useInput(
	handler: (event: KeyEvent) => void,
	options: { active?: () => boolean } = {}
): void {
	const app = useApp();
	onMount(() =>
		app.onKey((event) => {
			if (options.active && !options.active()) return;
			handler(event);
		})
	);
}

/** Reactive terminal size (`columns` and `rows`). Must be called during component initialisation. */
export function useTerminalSize(): { readonly columns: number; readonly rows: number } {
	return useApp().size;
}
