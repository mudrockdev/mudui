<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { KeyEvent, LayoutEvent, WheelEvent } from '../runtime/events.js';
	import type { Dimension } from '../types.js';
	import Scrollbar from './Scrollbar.svelte';

	let {
		height,
		grow,
		focusable = true,
		scrollbar = true,
		follow = false,
		offset = $bindable(0),
		gap,
		children
	}: {
		/** The viewport height. Give the scroll view a height, or `grow` inside a sized parent. */
		height?: Dimension;
		grow?: number | boolean;
		focusable?: boolean;
		scrollbar?: boolean;
		/** Stick to the bottom as content is added (for logs) */
		follow?: boolean;
		/** Rows scrolled from the top */
		offset?: number;
		gap?: number;
		children?: Snippet;
	} = $props();

	let viewport = $state(0);
	let content = $state(0);
	/** In `follow` mode: the user scrolled up, so stop sticking to the bottom */
	let detached = $state(false);

	const max = $derived(Math.max(0, content - viewport));
	const top = $derived(follow && !detached ? max : Math.min(Math.max(0, offset), max));

	function scroll(to: number) {
		offset = Math.max(0, Math.min(max, to));
		detached = offset < max;
	}

	function onkeydown(event: KeyEvent) {
		const k = event.key;
		if (k === 'ArrowUp' || event.is('k')) scroll(top - 1);
		else if (k === 'ArrowDown' || event.is('j')) scroll(top + 1);
		else if (k === 'PageUp') scroll(top - Math.max(1, viewport - 1));
		else if (k === 'PageDown') scroll(top + Math.max(1, viewport - 1));
		else if (k === 'Home') scroll(0);
		else if (k === 'End') scroll(max);
		else return;
		event.preventDefault();
		event.stopPropagation();
	}

	function onwheel(event: WheelEvent) {
		scroll(top + event.deltaY * 2);
	}

	function onlayout(event: LayoutEvent) {
		viewport = event.height;
		content = event.contentHeight;
	}
</script>

<box row {height} {grow} {focusable} {onkeydown} {onwheel}>
	<box grow={1} scrollY={top} {gap} {onlayout}>
		{@render children?.()}
	</box>
	{#if scrollbar && content > viewport}
		<Scrollbar total={content} visible={viewport} offset={top} height={viewport} />
	{/if}
</box>
