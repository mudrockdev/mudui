<script lang="ts" generics="Row extends Record<string, any>">
	import type { KeyEvent, LayoutEvent, WheelEvent } from '../runtime/events.js';
	import { fit, stringWidth } from '../renderer/text.js';
	import { getTheme } from '../theme.js';
	import type { TableColumn } from '../types.js';
	import Scrollbar from './Scrollbar.svelte';

	let {
		columns,
		rows,
		selected = $bindable(0),
		height,
		focusable = true,
		autofocus = false,
		emptyText = 'No rows',
		gap = 2,
		onchange,
		onselect
	}: {
		columns: TableColumn<Row>[];
		rows: Row[];
		/** Index of the highlighted row */
		selected?: number;
		/** Number of visible rows, excluding the header (default: all rows, up to 15) */
		height?: number;
		focusable?: boolean;
		autofocus?: boolean;
		emptyText?: string;
		/** Space between columns */
		gap?: number;
		onchange?: (index: number, row: Row) => void;
		onselect?: (index: number, row: Row) => void;
	} = $props();

	const theme = getTheme();
	let focused = $state(false);
	let offset = $state(0);
	let available = $state(0);

	const visible_rows = $derived(Math.max(1, height ?? Math.min(rows.length, 15)));
	const cell = (column: TableColumn<Row>, row: Row) =>
		column.format ? column.format(row) : String(row[column.key] ?? '');

	const widths = $derived.by(() => {
		const natural = columns.map((column) => {
			if (column.width !== undefined) return column.width;
			let w = stringWidth(column.title ?? column.key);
			for (const row of rows) w = Math.max(w, stringWidth(cell(column, row)));
			return Math.min(w, column.maxWidth ?? 40);
		});
		// give the remaining space to growing columns
		const total = natural.reduce((a, b) => a + b, 0) + gap * (columns.length - 1) + 2;
		const growing = columns.filter((c) => c.grow).length;
		if (available > total && growing > 0) {
			const extra = available - total;
			let given = 0;
			let seen = 0;
			return natural.map((w, i) => {
				if (!columns[i].grow) return w;
				seen++;
				const share = seen === growing ? extra - given : Math.floor(extra / growing);
				given += share;
				return w + share;
			});
		}
		return natural;
	});

	const index = $derived(Math.max(0, Math.min(selected, rows.length - 1)));
	const top = $derived.by(() => {
		let start = Math.min(offset, Math.max(0, rows.length - visible_rows));
		if (index < start) start = index;
		if (index >= start + visible_rows) start = index - visible_rows + 1;
		return Math.max(0, start);
	});

	$effect.pre(() => {
		offset = top;
	});

	function move(delta: number) {
		if (rows.length === 0) return;
		const next = Math.max(0, Math.min(rows.length - 1, index + delta));
		if (next !== selected) {
			selected = next;
			onchange?.(next, rows[next]);
		}
	}

	function onkeydown(event: KeyEvent) {
		const k = event.key;
		if (k === 'ArrowUp' || event.is('k')) move(-1);
		else if (k === 'ArrowDown' || event.is('j')) move(1);
		else if (k === 'PageUp') move(-visible_rows);
		else if (k === 'PageDown') move(visible_rows);
		else if (k === 'Home') move(-rows.length);
		else if (k === 'End') move(rows.length);
		else if (k === 'Enter' && rows[index]) onselect?.(index, rows[index]);
		else return;
		event.preventDefault();
		event.stopPropagation();
	}

	function click(i: number) {
		if (i !== selected) {
			selected = i;
			onchange?.(i, rows[i]);
		}
		onselect?.(i, rows[i]);
	}

	const spacer = $derived(' '.repeat(gap));
	const color_of = (column: TableColumn<Row>, row: Row) =>
		typeof column.color === 'function' ? column.color(row) : column.color;
</script>

<box
	{focusable}
	{autofocus}
	onfocus={() => (focused = true)}
	onblur={() => (focused = false)}
	onlayout={(e: LayoutEvent) => (available = e.width)}
	{onkeydown}
	onwheel={(e: WheelEvent) => move(e.deltaY)}
>
	<txt wrap="none" bold
		>{' '}{#each columns as column, c (c)}{#if c > 0}{spacer}{/if}{fit(
				column.title ?? column.key,
				widths[c],
				column.align
			)}{/each}</txt
	>
	<txt wrap="none" color={theme.border} fill="─"></txt>
	{#if rows.length === 0}
		<txt color={theme.muted} italic>{' '}{emptyText}</txt>
	{/if}
	<box row>
		<box grow={1}>
			{#each rows.slice(top, top + visible_rows) as row, i (i + top)}
				{@const active = focusable && i + top === index}
				<txt
					wrap="none"
					onclick={() => click(i + top)}
					bg={active ? (focused ? theme.accent : theme.surface) : undefined}
					color={active && focused ? theme.onAccent : undefined}
					bold={active}
					>{active ? '▌' : ' '}{#each columns as column, c (c)}{#if c > 0}{spacer}{/if}<txt
							color={active && focused ? undefined : color_of(column, row)}
							>{fit(cell(column, row), widths[c], column.align)}</txt
						>{/each}</txt
				>
			{/each}
		</box>
		{#if rows.length > visible_rows}
			<Scrollbar total={rows.length} visible={visible_rows} offset={top} height={visible_rows} />
		{/if}
	</box>
</box>
