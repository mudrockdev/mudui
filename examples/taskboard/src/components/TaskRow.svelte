<script lang="ts">
	import { getTheme, type MouseEvent } from 'mudui';
	import type { Task } from '../lib/tasks.svelte.ts';

	let {
		task,
		selected,
		active,
		onselect,
		ontoggle
	}: {
		task: Task;
		/** The row under the cursor */
		selected: boolean;
		/** Whether the list has focus */
		active: boolean;
		onselect: () => void;
		ontoggle: () => void;
	} = $props();

	const theme = getTheme();
	const highlight = $derived(selected && active);

	function onclick(event: MouseEvent) {
		// clicking the checkbox toggles, anywhere else selects
		if (event.localX <= 3) ontoggle();
		else onselect();
	}
</script>

<box
	row
	{onclick}
	bg={highlight ? theme.accent : selected ? theme.surface : undefined}
	color={highlight ? theme.onAccent : undefined}
>
	<txt wrap="none" color={highlight ? undefined : task.done ? theme.success : theme.muted}
		>{task.done ? '[✓]' : '[ ]'}{' '}</txt
	>
	<txt grow={1} wrap="truncate" strike={task.done} dim={task.done && !highlight} bold={selected}>{task.title}</txt>
	{#if task.priority === 'high'}
		<txt wrap="none" bold color={highlight ? undefined : theme.danger}>{' '}!!{' '}</txt>
	{:else if task.priority === 'low'}
		<txt wrap="none" color={highlight ? undefined : theme.muted}>{' '}low{' '}</txt>
	{/if}
</box>
