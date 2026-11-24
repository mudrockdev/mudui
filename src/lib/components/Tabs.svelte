<script lang="ts" generics="T">
	import type { KeyEvent } from '../runtime/events.js';
	import { getTheme } from '../theme.js';
	import type { SelectItem } from '../types.js';

	let {
		items,
		value = $bindable(),
		autofocus = false,
		onchange
	}: {
		items: Array<SelectItem<T> | (T & string)>;
		value?: T;
		autofocus?: boolean;
		onchange?: (value: T) => void;
	} = $props();

	const theme = getTheme();
	let focused = $state(false);

	const list = $derived(
		items.map((item) =>
			typeof item === 'string' ? ({ label: item, value: item as T } as SelectItem<T>) : item
		)
	);
	const index = $derived(list.findIndex((item) => item.value === value));

	$effect.pre(() => {
		if (index === -1 && list.length > 0) value = list[0].value;
	});

	function select(i: number) {
		const item = list[(i + list.length) % list.length];
		if (!item || item.disabled || item.value === value) return;
		value = item.value;
		onchange?.(item.value);
	}

	function onkeydown(event: KeyEvent) {
		if (event.key === 'ArrowLeft' || event.is('h')) select(index - 1);
		else if (event.key === 'ArrowRight' || event.is('l')) select(index + 1);
		else if (/^[1-9]$/.test(event.key) && !event.ctrl && !event.alt) select(Number(event.key) - 1);
		else return;
		event.preventDefault();
		event.stopPropagation();
	}
</script>

<box
	row
	focusable
	{autofocus}
	onfocus={() => (focused = true)}
	onblur={() => (focused = false)}
	{onkeydown}
>
	{#each list as item, i (i)}
		{@const active = i === index}
		{#if i > 0}<txt color={theme.muted}>│</txt>{/if}
		<txt
			wrap="none"
			onclick={() => select(i)}
			bold={active}
			underline={active && !focused}
			color={item.disabled ? theme.muted : active ? (focused ? theme.onAccent : theme.accent) : undefined}
			bg={active && focused ? theme.accent : undefined}>{' '}{item.label}{' '}</txt
		>
	{/each}
</box>
