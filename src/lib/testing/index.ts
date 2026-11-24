/**
 * Headless testing utilities: render a component into a virtual terminal, send
 * keys and clicks, and inspect the resulting frame.
 *
 * ```ts
 * const t = renderTest(Counter, { width: 20, height: 3 });
 * t.press('Enter');
 * expect(t.frame()).toContain('count: 1');
 * ```
 */
import type { Component } from 'svelte';
import { App } from '../runtime/app.js';
import { keySequence } from '../runtime/input.js';
import { VirtualTerminal } from '../runtime/terminal.js';
import type { TElement } from '../renderer/nodes.js';
import type { Screen } from '../renderer/screen.js';

export interface RenderTestOptions<Props extends Record<string, any>> {
	width?: number;
	height?: number;
	props?: Props;
	context?: Map<any, any>;
	/** Fill the whole virtual terminal (default `true`). Inline mode sizes the frame to the content. */
	fullscreen?: boolean;
}

export interface TestRenderer {
	app: App;
	terminal: VirtualTerminal;
	/** Renders pending changes and returns the screen as plain text (trailing spaces trimmed) */
	frame(): string;
	/** Renders pending changes and returns the screen */
	screen(): Screen;
	/** Sends keys, e.g. `press('Tab', 'Enter')`, `press('ctrl+c')`, `press('shift+Tab')` */
	press(...keys: string[]): void;
	/** Types text, character by character */
	type(text: string): void;
	/** Sends a bracketed paste */
	paste(text: string): void;
	/** Sends raw input, exactly as a terminal would */
	input(raw: string): void;
	/** Clicks at a cell (0-based) */
	click(x: number, y: number): void;
	/** Clicks on the first occurrence of `text` on screen. Throws if it isn't visible. */
	clickText(text: string): void;
	/** Scrolls the wheel at a cell */
	wheel(x: number, y: number, direction: 'up' | 'down'): void;
	/** Position of the first occurrence of `text` on screen */
	find(text: string): { x: number; y: number } | null;
	resize(width: number, height: number): void;
	/** The focused element */
	focused(): TElement | null;
	unmount(): void;
}

export function renderTest<Props extends Record<string, any>>(
	component: Component<Props, any, any>,
	options: RenderTestOptions<Props> = {}
): TestRenderer {
	const terminal = new VirtualTerminal(options.width ?? 80, options.height ?? 24);
	const app = new App(component, {
		terminal,
		props: options.props,
		context: options.context,
		fullscreen: options.fullscreen ?? true,
		mouse: true,
		scheduler: 'manual',
		handleErrors: false,
		exitOnCtrlC: true
	});

	const input = (raw: string) => {
		terminal.input(raw);
		app.render();
	};

	const find = (text: string) => {
		app.render();
		const screen = app.screen;
		for (let y = 0; y < screen.height; y++) {
			// map string index back to cells, accounting for wide characters
			let line = '';
			const cells: number[] = [];
			for (let x = 0; x < screen.width; x++) {
				const ch = screen.chars[y * screen.width + x];
				for (let k = 0; k < ch.length; k++) cells.push(x);
				line += ch;
			}
			const index = line.indexOf(text);
			if (index !== -1) return { x: cells[index], y };
		}
		return null;
	};

	const mouse = (b: number, x: number, y: number, final: 'M' | 'm') =>
		`\x1b[<${b};${x + 1};${y + 1}${final}`;

	return {
		app,
		terminal,
		frame() {
			app.render();
			return app.screen.toString();
		},
		screen() {
			app.render();
			return app.screen;
		},
		press(...keys) {
			for (const key of keys) input(keySequence(key));
		},
		type(text) {
			for (const ch of text) input(ch);
		},
		paste(text) {
			input(`\x1b[200~${text}\x1b[201~`);
		},
		input,
		click(x, y) {
			input(mouse(0, x, y, 'M'));
			input(mouse(0, x, y, 'm'));
		},
		clickText(text) {
			const position = find(text);
			if (!position) throw new Error(`mudui: "${text}" is not on screen:\n${app.screen.toString()}`);
			this.click(position.x, position.y);
		},
		wheel(x, y, direction) {
			input(mouse(direction === 'up' ? 64 : 65, x, y, 'M'));
		},
		find,
		resize(width, height) {
			terminal.resize(width, height);
			app.render();
		},
		focused: () => app.focused,
		unmount() {
			app.exit();
		}
	};
}
