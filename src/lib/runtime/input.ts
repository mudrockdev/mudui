/**
 * Parses raw terminal input into key, mouse and paste events.
 */

export interface KeyInput {
	kind: 'key';
	/** DOM-style key name: `'a'`, `'A'`, `' '`, `'Enter'`, `'ArrowUp'`, `'F5'`, ... */
	key: string;
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
	meta: boolean;
	/** The raw sequence */
	sequence: string;
}

export interface MouseInput {
	kind: 'mouse';
	/** 0-based cell coordinates */
	x: number;
	y: number;
	button: 'left' | 'middle' | 'right' | 'none';
	action: 'press' | 'release' | 'move' | 'wheelup' | 'wheeldown';
	ctrl: boolean;
	alt: boolean;
	shift: boolean;
}

export interface PasteInput {
	kind: 'paste';
	text: string;
}

export type InputEvent = KeyInput | MouseInput | PasteInput;

const CSI_TILDE: Record<number, string> = {
	1: 'Home',
	2: 'Insert',
	3: 'Delete',
	4: 'End',
	5: 'PageUp',
	6: 'PageDown',
	7: 'Home',
	8: 'End',
	11: 'F1',
	12: 'F2',
	13: 'F3',
	14: 'F4',
	15: 'F5',
	17: 'F6',
	18: 'F7',
	19: 'F8',
	20: 'F9',
	21: 'F10',
	23: 'F11',
	24: 'F12'
};

const CSI_LETTER: Record<string, string> = {
	A: 'ArrowUp',
	B: 'ArrowDown',
	C: 'ArrowRight',
	D: 'ArrowLeft',
	H: 'Home',
	F: 'End',
	E: 'Clear',
	P: 'F1',
	Q: 'F2',
	R: 'F3',
	S: 'F4'
};

const PASTE_START = '\x1b[200~';
const PASTE_END = '\x1b[201~';

function key(name: string, sequence: string, mods: Partial<KeyInput> = {}): KeyInput {
	return { kind: 'key', key: name, ctrl: false, alt: false, shift: false, meta: false, sequence, ...mods };
}

function modifiers(param: number | undefined): Partial<KeyInput> {
	if (!param || param < 2) return {};
	const bits = param - 1;
	return { shift: !!(bits & 1), alt: !!(bits & 2), ctrl: !!(bits & 4), meta: !!(bits & 8) };
}

/** Parses a single character (or grapheme) that isn't part of an escape sequence */
function char_key(ch: string, alt = false): KeyInput {
	const sequence = alt ? '\x1b' + ch : ch;
	const code = ch.charCodeAt(0);

	if (ch === '\r' || ch === '\n') return key('Enter', sequence, { alt });
	if (ch === '\t') return key('Tab', sequence, { alt });
	if (ch === '\x7f' || ch === '\b') return key('Backspace', sequence, { alt });
	if (ch === '\x1b') return key('Escape', sequence, { alt });
	if (ch === '\x00') return key(' ', sequence, { ctrl: true, alt });
	if (code >= 1 && code <= 26) {
		return key(String.fromCharCode(code + 96), sequence, { ctrl: true, alt });
	}
	if (code >= 28 && code <= 31) {
		return key(String.fromCharCode(code + 64), sequence, { ctrl: true, alt });
	}

	const shift = ch.length === 1 && ch !== ch.toLowerCase() && ch === ch.toUpperCase();
	return key(ch, sequence, { alt, shift });
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export class InputParser {
	#paste: string | null = null;

	/** Parses a chunk of input. A lone ESC at the end of a chunk is treated as the Escape key. */
	feed(data: string): InputEvent[] {
		const events: InputEvent[] = [];
		let i = 0;

		while (i < data.length) {
			if (this.#paste !== null) {
				const end = data.indexOf(PASTE_END, i);
				if (end === -1) {
					this.#paste += data.slice(i);
					return events;
				}
				events.push({ kind: 'paste', text: this.#paste + data.slice(i, end) });
				this.#paste = null;
				i = end + PASTE_END.length;
				continue;
			}

			if (data.startsWith(PASTE_START, i)) {
				this.#paste = '';
				i += PASTE_START.length;
				continue;
			}

			const ch = data[i];

			if (ch === '\x1b') {
				const next = data[i + 1];

				if (next === undefined) {
					events.push(key('Escape', '\x1b'));
					i += 1;
					continue;
				}

				if (next === '[') {
					const parsed = this.#csi(data, i);
					if (parsed) {
						if (parsed.event) events.push(parsed.event);
						i = parsed.end;
						continue;
					}
				}

				if (next === 'O' && i + 2 < data.length) {
					const name = CSI_LETTER[data[i + 2]];
					if (name) {
						events.push(key(name, data.slice(i, i + 3)));
						i += 3;
						continue;
					}
				}

				if (next === '\x1b') {
					events.push(key('Escape', '\x1b'));
					i += 1;
					continue;
				}

				// ESC + char = alt + char
				const cp = data.codePointAt(i + 1)!;
				const len = cp > 0xffff ? 2 : 1;
				events.push(char_key(data.slice(i + 1, i + 1 + len), true));
				i += 1 + len;
				continue;
			}

			// printable text: group by grapheme so that emoji etc. arrive as one key
			let j = i;
			while (j < data.length && data[j] !== '\x1b' && data.charCodeAt(j) >= 0x20 && data[j] !== '\x7f') j++;

			if (j > i) {
				for (const { segment } of segmenter.segment(data.slice(i, j))) events.push(char_key(segment));
				i = j;
				continue;
			}

			events.push(char_key(ch));
			i += 1;
		}

		return events;
	}

	#csi(data: string, start: number): { event: InputEvent | null; end: number } | null {
		// ESC [ params final
		let i = start + 2;
		while (i < data.length && /[0-9;<?:]/.test(data[i])) i++;
		if (i >= data.length) return null;
		const final = data[i];
		const params = data.slice(start + 2, i);
		const sequence = data.slice(start, i + 1);
		const end = i + 1;

		if (params.startsWith('<') && (final === 'M' || final === 'm')) {
			const [b, x, y] = params.slice(1).split(';').map(Number);
			return { event: mouse(b, x - 1, y - 1, final === 'm'), end };
		}

		const nums = params.split(';').map((p) => (p === '' ? undefined : Number(p)));

		if (final === '~') {
			const name = CSI_TILDE[nums[0] ?? 0];
			return { event: name ? key(name, sequence, modifiers(nums[1])) : null, end };
		}

		if (final === 'Z') return { event: key('Tab', sequence, { shift: true }), end };

		const name = CSI_LETTER[final];
		if (name) return { event: key(name, sequence, modifiers(nums[1])), end };

		// unknown sequence (e.g. focus reports): swallow it
		return { event: null, end };
	}
}

function mouse(b: number, x: number, y: number, released: boolean): MouseInput {
	const base = b & 3;
	const event: MouseInput = {
		kind: 'mouse',
		x,
		y,
		button: 'none',
		action: 'press',
		shift: !!(b & 4),
		alt: !!(b & 8),
		ctrl: !!(b & 16)
	};

	if (b & 64) {
		event.action = base === 0 ? 'wheelup' : 'wheeldown';
		return event;
	}

	event.button = base === 0 ? 'left' : base === 1 ? 'middle' : base === 2 ? 'right' : 'none';
	if (b & 32) event.action = 'move';
	else if (released || base === 3) event.action = 'release';
	return event;
}

const NAMED_SEQUENCES: Record<string, string> = {
	enter: '\r',
	return: '\r',
	tab: '\t',
	escape: '\x1b',
	esc: '\x1b',
	backspace: '\x7f',
	space: ' ',
	delete: '\x1b[3~',
	insert: '\x1b[2~',
	home: '\x1b[H',
	end: '\x1b[F',
	pageup: '\x1b[5~',
	pagedown: '\x1b[6~',
	arrowup: '\x1b[A',
	up: '\x1b[A',
	arrowdown: '\x1b[B',
	down: '\x1b[B',
	arrowright: '\x1b[C',
	right: '\x1b[C',
	arrowleft: '\x1b[D',
	left: '\x1b[D',
	f1: '\x1bOP',
	f2: '\x1bOQ',
	f3: '\x1bOR',
	f4: '\x1bOS',
	f5: '\x1b[15~',
	f6: '\x1b[17~',
	f7: '\x1b[18~',
	f8: '\x1b[19~',
	f9: '\x1b[20~',
	f10: '\x1b[21~',
	f11: '\x1b[23~',
	f12: '\x1b[24~'
};

/**
 * Converts a key description like `'Enter'`, `'shift+Tab'`, `'ctrl+c'` or `'alt+x'`
 * into the raw sequence a terminal would send. Used by the test harness.
 */
export function keySequence(description: string): string {
	const parts = description.split('+');
	let name = parts.pop()!;
	if (name === '' && description.endsWith('+')) name = '+';
	const mods = new Set(parts.map((p) => p.toLowerCase()));
	const lower = name.toLowerCase();

	if (mods.has('shift') && lower === 'tab') return '\x1b[Z';

	let seq: string;
	if (lower in NAMED_SEQUENCES && name.length > 1) {
		seq = NAMED_SEQUENCES[lower];
		const mod = 1 + (mods.has('shift') ? 1 : 0) + (mods.has('alt') ? 2 : 0) + (mods.has('ctrl') ? 4 : 0);
		if (mod > 1 && /^\x1b\[[A-H]$/.test(seq)) return `\x1b[1;${mod}${seq.slice(-1)}`;
		if (mod > 1 && /^\x1b\[\d+~$/.test(seq)) return seq.replace('~', `;${mod}~`);
	} else if (mods.has('ctrl') && name.length === 1) {
		const code = name.toLowerCase().charCodeAt(0);
		seq = code >= 97 && code <= 122 ? String.fromCharCode(code - 96) : name;
	} else {
		seq = mods.has('shift') ? name.toUpperCase() : name;
	}

	return mods.has('alt') ? '\x1b' + seq : seq;
}
