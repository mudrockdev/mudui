import { graphemes, graphemeWidth } from '../src/lib/renderer/text.ts';

/**
 * A minimal terminal emulator: applies cursor positioning, clears and text to a
 * grid, ignoring styles. Used to check that diff output reproduces a screen.
 */
export class Emulator {
	grid: string[][];
	x = 0;
	y = 0;

	constructor(
		public width: number,
		public height: number
	) {
		this.grid = Array.from({ length: height }, () => Array(width).fill(' '));
	}

	write(data: string) {
		let i = 0;
		while (i < data.length) {
			if (data[i] === '\x1b' && data[i + 1] === '[') {
				let j = i + 2;
				while (j < data.length && !/[@-~]/.test(data[j])) j++;
				const params = data.slice(i + 2, j);
				const final = data[j];
				if (final === 'H') {
					const [row = 1, col = 1] = params.split(';').map((n) => Number(n || 1));
					this.y = row - 1;
					this.x = col - 1;
				} else if (final === 'J' && params === '2') {
					this.grid = Array.from({ length: this.height }, () => Array(this.width).fill(' '));
				}
				i = j + 1;
				continue;
			}
			let j = i;
			while (j < data.length && data[j] !== '\x1b') j++;
			for (const g of graphemes(data.slice(i, j))) {
				const w = graphemeWidth(g);
				if (this.y < this.height && this.x < this.width) {
					this.grid[this.y][this.x] = g;
					if (w === 2 && this.x + 1 < this.width) this.grid[this.y][this.x + 1] = '';
				}
				this.x += w;
			}
			i = j;
		}
	}

	toString() {
		const lines = this.grid.map((row) => row.join('').trimEnd());
		while (lines.length && lines[lines.length - 1] === '') lines.pop();
		return lines.join('\n');
	}
}

/** Removes common indentation, and the first/last empty lines */
export function dedent(text: string): string {
	const lines = text.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n');
	const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^\s*/.exec(l)![0].length));
	return lines.map((l) => l.slice(indent).trimEnd()).join('\n');
}
