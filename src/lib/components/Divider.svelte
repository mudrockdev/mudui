<script lang="ts">
	import { getTheme } from '../theme.js';
	import type { ColorValue } from '../types.js';

	let {
		title,
		vertical = false,
		char = '─',
		color = getTheme().border
	}: {
		title?: string;
		vertical?: boolean;
		char?: string;
		color?: ColorValue;
	} = $props();
</script>

{#if vertical}
	<box width={1} shrink={0} border borderColor={color} borderTop={false} borderRight={false} borderBottom={false}></box>
{:else}
	<txt {color} wrap="none" fill={char}>{title ? `${char.repeat(2)} ${title} ` : ''}</txt>
{/if}
