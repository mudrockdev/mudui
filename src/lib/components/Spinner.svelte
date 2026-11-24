<script lang="ts" module>
	export const spinners = {
		dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
		line: ['-', '\\', '|', '/'],
		arc: ['◜', '◠', '◝', '◞', '◡', '◟'],
		bounce: ['⠁', '⠂', '⠄', '⠂'],
		square: ['◰', '◳', '◲', '◱']
	};
</script>

<script lang="ts">
	import { getTheme } from '../theme.js';
	import type { ColorValue } from '../types.js';

	let {
		label,
		type = 'dots',
		frames,
		interval = 80,
		color = getTheme().accent
	}: {
		label?: string;
		type?: keyof typeof spinners;
		frames?: string[];
		interval?: number;
		color?: ColorValue;
	} = $props();

	let frame = $state(0);
	const list = $derived(frames ?? spinners[type]);

	$effect(() => {
		const id = setInterval(() => (frame = (frame + 1) % list.length), interval);
		return () => clearInterval(id);
	});
</script>

<txt><txt {color}>{list[frame % list.length]}</txt>{label ? ` ${label}` : ''}</txt>
