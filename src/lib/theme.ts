/**
 * Colors used by the UI kit. Override them for a subtree with `setTheme`.
 */
import { getContext, hasContext, setContext } from 'svelte';
import type { ColorValue } from './types.js';

export interface Theme {
	accent: ColorValue;
	muted: ColorValue;
	border: ColorValue;
	success: ColorValue;
	warning: ColorValue;
	danger: ColorValue;
	/** Background of overlays such as modals */
	surface: ColorValue;
	/** Text drawn on top of accent-colored backgrounds */
	onAccent: ColorValue;
}

export const defaultTheme: Theme = {
	accent: 'cyan',
	muted: 'gray',
	border: 'gray',
	success: 'green',
	warning: 'yellow',
	danger: 'red',
	surface: '#1c1c24',
	onAccent: 'black'
};

const THEME_KEY = Symbol('mudui.theme');

/** Sets the theme for this component's descendants. Call during component initialisation. */
export function setTheme(theme: Partial<Theme>): Theme {
	const merged = { ...getTheme(), ...theme };
	setContext(THEME_KEY, merged);
	return merged;
}

/** The current theme. Call during component initialisation. */
export function getTheme(): Theme {
	return hasContext(THEME_KEY) ? getContext<Theme>(THEME_KEY) : defaultTheme;
}
