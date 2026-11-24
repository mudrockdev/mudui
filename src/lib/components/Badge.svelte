<script lang="ts">
	import type { Snippet } from 'svelte';
	import { getTheme } from '../theme.js';
	import type { ColorValue } from '../types.js';

	let {
		label,
		color = getTheme().accent,
		textColor = getTheme().onAccent,
		children
	}: {
		label?: string;
		color?: ColorValue;
		textColor?: ColorValue;
		children?: Snippet;
	} = $props();
</script>

<txt bg={color} color={textColor} bold alignSelf="start">{' '}{label ?? ''}{@render children?.()}{' '}</txt>
