<script lang="ts">
	import { getTheme } from '../theme.js';
	import type { KeyHint } from '../types.js';

	let { hints }: { hints: KeyHint[] | Record<string, string> } = $props();

	const theme = getTheme();
	const list = $derived(
		Array.isArray(hints) ? hints : Object.entries(hints).map(([key, label]) => ({ key, label }))
	);
</script>

<txt wrap="truncate"
	>{#each list as hint, i (i)}{#if i > 0}{'  '}{/if}<txt bold color={theme.accent}>{hint.key}</txt
		>{' '}<txt color={theme.muted}>{hint.label}</txt>{/each}</txt
>
