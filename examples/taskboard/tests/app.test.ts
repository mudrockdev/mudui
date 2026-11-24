import { describe, expect, test } from 'bun:test';
import { renderTest } from 'mudui/testing';
import App from '../src/App.svelte';
import { TaskStore, sampleData, type Data } from '../src/lib/tasks.svelte.ts';

function setup(width = 90, height = 20) {
	const store = new TaskStore(sampleData());
	const saves: Data[] = [];
	const t = renderTest(App, {
		width,
		height,
		props: { store, save: async (data: Data) => void saves.push(data), autosaveDelay: 0 }
	});
	return { t, store, saves };
}

const wait = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

describe('mudtasks', () => {
	test('shows lists, tasks and progress', () => {
		const { t } = setup();
		const frame = t.frame();
		expect(frame).toContain('mudtasks');
		expect(frame).toContain('1/8 done');
		expect(frame).toMatch(/❯ Inbox\s+2/);
		expect(frame).toContain('Work');
		expect(frame).toContain('[ ] Try mudtasks');
		expect(frame).toContain('[✓] Toggle tasks with space');
		expect(frame).toContain('Inbox · 2 open');
		t.unmount();
	});

	test('the task list starts focused; space toggles, p cycles priority', () => {
		const { t, store } = setup();
		t.press('j', ' ');
		expect(store.tasksIn('Inbox')[1].done).toBe(true);
		expect(t.frame()).toContain('2/8 done');
		expect(t.frame()).toContain('Done: Add a task with n');
		t.press('p');
		expect(store.tasksIn('Inbox')[1].priority).toBe('high');
		expect(t.frame()).toContain('!!');
		t.unmount();
	});

	test('adding tasks', () => {
		const { t, store } = setup();
		t.press('n');
		t.type('Water the plants');
		t.press('Enter');
		t.type('Feed the cat');
		t.press('Enter', 'Escape');
		const titles = store.tasksIn('Inbox').map((task) => task.title);
		expect(titles.slice(-2)).toEqual(['Water the plants', 'Feed the cat']);
		expect(t.frame()).toContain('[ ] Feed the cat');
		// focus is back on the list: j/k move the cursor rather than typing
		t.press('k', ' ');
		expect(store.find(store.tasksIn('Inbox')[3].id)!.done).toBe(true);
		t.unmount();
	});

	test('editing a task inline', () => {
		const { t, store } = setup();
		t.press('e', 'ctrl+u');
		t.type('Renamed task');
		t.press('Enter');
		expect(store.tasksIn('Inbox')[0].title).toBe('Renamed task');
		expect(t.frame()).toContain('Renamed task');
		t.unmount();
	});

	test('deleting asks for confirmation', () => {
		const { t, store } = setup();
		t.press('d');
		expect(t.frame()).toContain('Delete “Try mudtasks — press ? for help”?');
		t.press('Escape');
		expect(store.tasksIn('Inbox')).toHaveLength(3);
		t.press('d', 'Enter');
		expect(store.tasksIn('Inbox')).toHaveLength(2);
		expect(t.frame()).toContain('Deleted: Try mudtasks');
		t.unmount();
	});

	test('reordering with J and K', () => {
		const { t, store } = setup();
		t.press('J', 'J');
		expect(store.tasksIn('Inbox').map((task) => task.title)[2]).toBe('Try mudtasks — press ? for help');
		t.press('K');
		expect(store.tasksIn('Inbox').map((task) => task.title)[1]).toBe('Try mudtasks — press ? for help');
		t.unmount();
	});

	test('filtering', () => {
		const { t } = setup();
		t.press('/');
		t.type('space');
		const frame = t.frame();
		expect(frame).toContain('Toggle tasks with space');
		expect(frame).not.toContain('Add a task with n');
		t.press('Escape');
		expect(t.frame()).toContain('Add a task with n');
		t.unmount();
	});

	test('switching lists with the sidebar (keyboard and mouse)', () => {
		const { t } = setup();
		t.press('shift+Tab', 'ArrowDown');
		expect(t.frame()).toContain('Work · 3 open');
		expect(t.frame()).toContain('Review pull requests');
		// the sidebar keeps focus while browsing lists
		t.press('ArrowDown');
		expect(t.frame()).toContain('Personal · 2 open');
		t.press('ArrowUp');
		expect(t.frame()).toContain('Work · 3 open');
		t.clickText('Personal');
		expect(t.frame()).toContain('Personal · 2 open');
		t.clickText('[ ] Buy groceries');
		t.unmount();
	});

	test('clicking a checkbox toggles the task', () => {
		const { t, store } = setup();
		const position = t.find('[ ] Add a task with n')!;
		t.click(position.x + 1, position.y);
		expect(store.tasksIn('Inbox')[1].done).toBe(true);
		t.unmount();
	});

	test('creating a list from a modal', () => {
		const { t, store } = setup();
		t.press('N');
		expect(t.frame()).toContain('New list');
		t.type('Garden');
		t.press('Enter');
		expect(store.lists).toEqual(['Inbox', 'Work', 'Personal', 'Garden']);
		expect(t.frame()).toContain('Garden · 0 open');
		expect(t.frame()).toContain('No tasks here. Press n to add one.');
		t.unmount();
	});

	test('stats and help views', () => {
		const { t } = setup();
		t.press('2');
		let frame = t.frame();
		expect(frame).toContain('Progress by list');
		expect(frame).toMatch(/Inbox .* 33%/);
		expect(frame).toMatch(/high\s+3\s+0/);
		t.press('?');
		frame = t.frame();
		expect(frame).toContain('Cycle priority');
		t.press('Escape');
		expect(t.frame()).toContain('Inbox · 2 open');
		t.unmount();
	});

	test('changes are saved automatically', async () => {
		const { t, saves } = setup();
		t.press(' ');
		await wait(20);
		expect(saves.length).toBeGreaterThan(0);
		expect(saves.at(-1)!.tasks[0].done).toBe(true);
		t.unmount();
	});

	test('q quits', () => {
		const { t } = setup();
		t.press('q');
		expect(t.app.exited).toBe(true);
	});
});
