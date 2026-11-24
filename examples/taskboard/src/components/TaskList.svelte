<script lang="ts">
	import {
		Panel,
		TextInput,
		getTheme,
		useApp,
		type KeyEvent,
		type LayoutEvent,
		type TElement,
		type WheelEvent
	} from 'mudui';
	import type { Task, TaskStore } from '../lib/tasks.svelte.ts';
	import TaskRow from './TaskRow.svelte';

	let {
		store,
		list,
		ondelete,
		onstatus
	}: {
		store: TaskStore;
		list: string;
		/** Asks for confirmation before deleting */
		ondelete: (task: Task) => void;
		onstatus: (message: string) => void;
	} = $props();

	const app = useApp();
	const theme = getTheme();

	let selected = $state(0);
	let offset = $state(0);
	let rows = $state(1);
	let focused = $state(false);
	let list_element: TElement | null = null;

	let adding = $state(false);
	let draft = $state('');
	let editing = $state<string | null>(null);
	let edit_draft = $state('');
	let filtering = $state(false);
	let filter = $state('');

	// reset the cursor and filter when switching lists
	let shown_list: string | undefined;
	$effect.pre(() => {
		if (shown_list !== undefined && list !== shown_list) {
			selected = 0;
			offset = 0;
			filter = '';
			filtering = false;
			adding = false;
			editing = null;
		}
		shown_list = list;
	});

	const all = $derived(store.tasksIn(list));
	const tasks = $derived(
		filter ? all.filter((task) => task.title.toLowerCase().includes(filter.toLowerCase())) : all
	);
	const current = $derived(tasks[Math.min(selected, tasks.length - 1)] as Task | undefined);
	const open = $derived(all.filter((task) => !task.done).length);

	// keep the cursor in range and in view
	const index = $derived(Math.max(0, Math.min(selected, tasks.length - 1)));
	const top = $derived.by(() => {
		let start = Math.min(offset, Math.max(0, tasks.length - rows));
		if (index < start) start = index;
		if (index >= start + rows) start = index - rows + 1;
		return Math.max(0, start);
	});
	$effect.pre(() => {
		offset = top;
	});

	function move(delta: number) {
		selected = Math.max(0, Math.min(tasks.length - 1, index + delta));
	}

	function select_task(task: Task | null | undefined) {
		const i = task ? tasks.indexOf(task) : -1;
		if (i !== -1) selected = i;
	}

	function back_to_list() {
		if (list_element) app.focus(list_element);
	}

	function onkeydown(event: KeyEvent) {
		const task = current;
		const k = event.key;

		if (k === 'ArrowUp' || event.is('k')) move(-1);
		else if (k === 'ArrowDown' || event.is('j')) move(1);
		else if (k === 'Home' || event.is('g')) move(-tasks.length);
		else if (k === 'End' || event.is('G')) move(tasks.length);
		else if (k === 'PageUp') move(-rows);
		else if (k === 'PageDown') move(rows);
		else if (event.is('n') || event.is('a')) {
			draft = '';
			adding = true;
		} else if (event.is('/')) filtering = true;
		else if (event.is('c')) {
			const removed = store.clearDone(list);
			onstatus(removed ? `Cleared ${removed} finished task${removed === 1 ? '' : 's'}` : 'Nothing to clear');
		} else if (!task) return;
		else if (k === ' ' || event.is('x')) {
			store.toggle(task.id);
			onstatus(task.done ? `Done: ${task.title}` : `Reopened: ${task.title}`);
		} else if (k === 'Enter' || event.is('e')) {
			edit_draft = task.title;
			editing = task.id;
		} else if (event.is('d') || k === 'Delete') ondelete(task);
		else if (event.is('p')) {
			store.cyclePriority(task.id);
			onstatus(`Priority: ${task.priority}`);
		} else if (event.is('K') || (k === 'ArrowUp' && event.shift)) {
			store.move(task.id, -1);
			select_task(task);
		} else if (event.is('J') || (k === 'ArrowDown' && event.shift)) {
			store.move(task.id, 1);
			select_task(task);
		} else return;

		event.preventDefault();
		event.stopPropagation();
	}

	function add(title: string) {
		const task = store.add(list, title);
		if (task) {
			filter = '';
			onstatus(`Added: ${task.title}`);
			select_task(task);
		}
		draft = '';
		// keep the input open for the next task; Escape closes it
	}

	function save_edit(id: string) {
		store.rename(id, edit_draft);
		editing = null;
		back_to_list();
	}
</script>

<Panel title={`${list} · ${open} open`} grow={1}>
	{#if adding}
		<TextInput
			bind:value={draft}
			prefix="+ "
			placeholder="New task, Enter to add, Esc to finish"
			autofocus
			onsubmit={add}
			oncancel={() => {
				adding = false;
				back_to_list();
			}}
		/>
	{/if}
	{#if filtering || filter}
		<TextInput
			bind:value={filter}
			prefix="/ "
			placeholder="filter"
			autofocus
			onsubmit={() => {
				filtering = false;
				back_to_list();
			}}
			oncancel={() => {
				filter = '';
				filtering = false;
				back_to_list();
			}}
		/>
	{/if}
	<box
		grow={1}
		focusable
		autofocus
		{onkeydown}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
		onwheel={(e: WheelEvent) => move(e.deltaY)}
		onlayout={(e: LayoutEvent) => (rows = Math.max(1, e.height))}
		{@attach (element: TElement) => {
			list_element = element;
		}}
	>
		{#each tasks.slice(top, top + rows) as task, i (task.id)}
			{#if editing === task.id}
				<TextInput
					bind:value={edit_draft}
					prefix="✎ "
					autofocus
					onsubmit={() => save_edit(task.id)}
					oncancel={() => {
						editing = null;
						back_to_list();
					}}
				/>
			{:else}
				<TaskRow
					{task}
					selected={i + top === index}
					active={focused}
					onselect={() => (selected = i + top)}
					ontoggle={() => {
						selected = i + top;
						store.toggle(task.id);
					}}
				/>
			{/if}
		{:else}
			<txt color={theme.muted} italic>
				{filter ? `Nothing matches “${filter}”.` : 'No tasks here. Press n to add one.'}
			</txt>
		{/each}
	</box>
	{#if tasks.length > rows}
		<txt color={theme.muted} textAlign="right">{index + 1}/{tasks.length}</txt>
	{/if}
</Panel>
