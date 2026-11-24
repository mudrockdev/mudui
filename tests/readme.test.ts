import { expect, test } from 'bun:test';
import { renderTest } from '../src/lib/testing/index.ts';
import { dedent } from './helpers.ts';
import Counter from './fixtures/ReadmeCounter.svelte';

test('the README example works as documented', () => {
	const t = renderTest(Counter, { width: 40, height: 6 });
	expect(t.frame()).toBe(
		dedent(`
			╭─ Counter ──────────────────╮
			│ Count: 0                   │
			│   Increment                │
			│ q to quit                  │
			╰────────────────────────────╯`)
	);

	t.press('Enter');
	expect(t.frame()).toContain('Count: 1');

	t.clickText('Increment');
	expect(t.frame()).toContain('Count: 2');

	t.press('q');
	expect(t.app.exited).toBe(true);
});

test('inline (non-fullscreen) apps size the frame to the content', () => {
	const t = renderTest(Counter, { width: 40, height: 20, fullscreen: false });
	expect(t.screen().height).toBe(5);
	expect(t.terminal.output).not.toContain('\x1b[?1049h');
	t.unmount();
});
