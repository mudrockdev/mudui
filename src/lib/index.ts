// Runtime
export { App, render, type RenderOptions } from './runtime/app.js';
export { useApp, useInput, useTerminalSize } from './runtime/context.js';
export {
	TuiEvent,
	KeyEvent,
	MouseEvent,
	WheelEvent,
	PasteEvent,
	FocusEvent,
	LayoutEvent,
	dispatchEvent
} from './runtime/events.js';
export { InputParser, keySequence, type InputEvent, type KeyInput, type MouseInput } from './runtime/input.js';
export { NodeTerminal, VirtualTerminal, type Terminal } from './runtime/terminal.js';

// Renderer
export { default as renderer } from './renderer/index.js';
export { TElement, TText, TComment, TFragment, TRoot } from './renderer/nodes.js';
export { Screen, type ColorDepth } from './renderer/screen.js';
export { computeLayout } from './renderer/layout.js';
export { paintScreen } from './renderer/paint.js';
export { parseColor } from './renderer/style.js';
export { stringWidth, truncate, fit, graphemes, layoutText } from './renderer/text.js';

// Theme
export { defaultTheme, getTheme, setTheme, type Theme } from './theme.js';

// Types
export type * from './types.js';

// Components
export { default as Badge } from './components/Badge.svelte';
export { default as Box } from './components/Box.svelte';
export { default as Button } from './components/Button.svelte';
export { default as Checkbox } from './components/Checkbox.svelte';
export { default as Divider } from './components/Divider.svelte';
export { default as KeyHints } from './components/KeyHints.svelte';
export { default as Modal } from './components/Modal.svelte';
export { default as Panel } from './components/Panel.svelte';
export { default as ProgressBar } from './components/ProgressBar.svelte';
export { default as Scrollbar } from './components/Scrollbar.svelte';
export { default as ScrollView } from './components/ScrollView.svelte';
export { default as Select } from './components/Select.svelte';
export { default as Spacer } from './components/Spacer.svelte';
export { default as Spinner } from './components/Spinner.svelte';
export { default as Table } from './components/Table.svelte';
export { default as Tabs } from './components/Tabs.svelte';
export { default as Text } from './components/Text.svelte';
export { default as TextInput } from './components/TextInput.svelte';
