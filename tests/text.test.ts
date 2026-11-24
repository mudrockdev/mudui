import { describe, expect, test } from 'bun:test';
import { fit, layoutText, stringWidth, truncate } from '../src/lib/renderer/text.ts';

const plain = (text: string, width: number, mode?: Parameters<typeof layoutText>[2]) =>
	layoutText([{ text, style: {} }], width, mode).map((line) => line.segments.map((s) => s.text).join(''));

describe('text', () => {
	test('string width', () => {
		expect(stringWidth('abc')).toBe(3);
		expect(stringWidth('日本')).toBe(4);
		expect(stringWidth('é')).toBe(1);
		expect(stringWidth('👍')).toBe(2);
		expect(stringWidth('👨‍👩‍👧')).toBe(2);
	});

	test('word wrapping', () => {
		expect(plain('the quick brown fox', 10)).toEqual(['the quick', 'brown fox']);
		expect(plain('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
		expect(plain('a\nb c', 10)).toEqual(['a', 'b c']);
		expect(plain('', 10)).toEqual(['']);
	});

	test('truncation modes', () => {
		expect(plain('abcdefgh', 5, 'truncate')).toEqual(['abcd…']);
		expect(plain('abcdefgh', 5, 'truncate-start')).toEqual(['…efgh']);
		expect(plain('abcdefgh', 5, 'truncate-middle')).toEqual(['ab…gh']);
		expect(plain('abc', 5, 'truncate')).toEqual(['abc']);
	});

	test('keeps styled segments', () => {
		const red = { fg: 1 };
		const lines = layoutText(
			[
				{ text: 'plain ', style: {} },
				{ text: 'red', style: red }
			],
			20
		);
		expect(lines[0].segments.map((s) => [s.text, s.style])).toEqual([
			['plain ', {}],
			['red', red]
		]);
	});

	test('truncate and fit helpers', () => {
		expect(truncate('hello world', 6)).toBe('hello…');
		expect(fit('ab', 5)).toBe('ab   ');
		expect(fit('ab', 5, 'right')).toBe('   ab');
		expect(fit('ab', 6, 'center')).toBe('  ab  ');
		expect(fit('日本語', 5)).toBe('日本…');
	});
});
