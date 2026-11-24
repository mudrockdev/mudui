/**
 * Types for mudui's primitive elements (`<box>` and `<txt>`), and their
 * registration with `svelte/elements` so templates are type-checked.
 */
import type { Snippet } from "svelte";
import type {
  FocusEvent,
  KeyEvent,
  LayoutEvent,
  MouseEvent,
  PasteEvent,
  TuiEvent,
  WheelEvent,
} from "./runtime/events.js";
import type { TElement } from "./renderer/nodes.js";

/** A size in cells, a percentage of the parent's size, or `'auto'` */
export type Dimension = number | `${number}%` | "auto";

/**
 * A color: a name (`'red'`, `'brightBlue'`, `'gray'`), a hex string (`'#ff8800'`),
 * `'rgb(r,g,b)'`, a 256-color palette index, or `'default'`.
 */
export type ColorValue = string | number;

export type BorderStyle =
  "single" | "round" | "double" | "bold" | "dashed" | "ascii" | "none";
export type Align = "start" | "center" | "end" | "stretch";
export type Justify =
  "start" | "center" | "end" | "between" | "around" | "evenly";
export type WrapMode =
  "wrap" | "truncate" | "truncate-start" | "truncate-middle" | "none";

type Handler<E extends TuiEvent> = ((event: E) => unknown) | null | undefined;

export type EventAttributes = {
  onkeydown?: Handler<KeyEvent>;
  onclick?: Handler<MouseEvent>;
  onmousedown?: Handler<MouseEvent>;
  onmouseup?: Handler<MouseEvent>;
  onmousemove?: Handler<MouseEvent>;
  onwheel?: Handler<WheelEvent>;
  onpaste?: Handler<PasteEvent>;
  onfocus?: Handler<FocusEvent>;
  onblur?: Handler<FocusEvent>;
  onfocusin?: Handler<FocusEvent>;
  onfocusout?: Handler<FocusEvent>;
  /** Fired after a frame in which the element's size or position changed */
  onlayout?: Handler<LayoutEvent>;
};

export type TextStyleAttributes = {
  /** Text color, inherited by descendants */
  color?: ColorValue | null;
  bold?: boolean | null;
  dim?: boolean | null;
  italic?: boolean | null;
  underline?: boolean | null;
  inverse?: boolean | null;
  strike?: boolean | null;
  /** Background color */
  bg?: ColorValue | null;
};

export type CommonAttributes = EventAttributes &
  TextStyleAttributes & {
    /** CSS-like declarations, e.g. `"padding: 1 2; border: round"` */
    style?: string | null;
    class?: unknown;
    hidden?: boolean | null;
    width?: Dimension | null;
    height?: Dimension | null;
    minWidth?: Dimension | null;
    maxWidth?: Dimension | null;
    minHeight?: Dimension | null;
    maxHeight?: Dimension | null;
    /** Flex grow factor (`true` = 1) */
    grow?: number | boolean | null;
    /** Flex shrink factor (default: 1 in rows, 0 in columns) */
    shrink?: number | boolean | null;
    alignSelf?: Align | null;
    margin?: number | string | null;
    marginX?: number | null;
    marginY?: number | null;
    marginTop?: number | null;
    marginRight?: number | null;
    marginBottom?: number | null;
    marginLeft?: number | null;
    position?: "relative" | "absolute" | null;
    top?: Dimension | null;
    right?: Dimension | null;
    bottom?: Dimension | null;
    left?: Dimension | null;
    /** Can receive focus (Tab / click) */
    focusable?: boolean | null;
    tabindex?: number | null;
    /** Focus this element when it appears (if nothing else is focused) */
    autofocus?: boolean | null;
    /** Not focusable while disabled */
    disabled?: boolean | null;
    /** Keep focus inside this element while it is rendered */
    trapfocus?: boolean | null;
    [key: `data-${string}`]: unknown;
    children?: Snippet;
  };

export type BoxAttributes = CommonAttributes & {
  /** Main axis (default `'column'`) */
  direction?: "row" | "column" | null;
  /** Shorthand for `direction="row"` */
  row?: boolean | null;
  gap?: number | null;
  /** `1`, `"1 2"` or `"1 2 1 2"` (top right bottom left) */
  padding?: number | string | null;
  paddingX?: number | null;
  paddingY?: number | null;
  paddingTop?: number | null;
  paddingRight?: number | null;
  paddingBottom?: number | null;
  paddingLeft?: number | null;
  border?: BorderStyle | boolean | null;
  borderColor?: ColorValue | null;
  borderDim?: boolean | null;
  borderTop?: boolean | null;
  borderRight?: boolean | null;
  borderBottom?: boolean | null;
  borderLeft?: boolean | null;
  /** Shown in the top border */
  title?: string | null;
  titleAlign?: "left" | "center" | "right" | null;
  /** Cross-axis alignment of children (default `'stretch'`) */
  align?: Align | null;
  /** Main-axis distribution of children */
  justify?: Justify | null;
  /** Scroll offsets of the content, in cells */
  scrollX?: number | null;
  scrollY?: number | null;
};

export type TxtAttributes = CommonAttributes & {
  wrap?: WrapMode | null;
  /** Repeated after the text to fill each line, e.g. `fill="─"` for a rule */
  fill?: string | null;
  textAlign?: "left" | "center" | "right" | null;
  padding?: number | string | null;
  paddingX?: number | null;
  paddingY?: number | null;
};

export type { TElement };

/**
 * Svelte's type checker lowercases attribute names on elements (`alignSelf`
 * becomes `alignself`); the renderer is case-insensitive, so both spellings work.
 */
type Lowercased<T> = {
  [K in keyof T as K extends string ? Lowercase<K> : K]: T[K];
};

declare module "svelte/elements" {
  export interface SvelteHTMLElements {
    box: BoxAttributes & Lowercased<BoxAttributes>;
    txt: TxtAttributes & Lowercased<TxtAttributes>;
  }
}

export interface SelectItem<V = string> {
  label: string;
  value: V;
  /** Shown dimmed on the right */
  hint?: string;
  disabled?: boolean;
  color?: ColorValue;
}

export interface TableColumn<Row> {
  key: string;
  title?: string;
  /** Fixed width; by default the column fits its content (up to `maxWidth`) */
  width?: number;
  maxWidth?: number;
  /** Take up the remaining space */
  grow?: boolean;
  align?: "left" | "right" | "center";
  format?: (row: Row) => string;
  color?: ColorValue | ((row: Row) => ColorValue | undefined);
}

export interface TreeNode<T = unknown> {
  /** Unique among all nodes of the tree */
  id: string;
  label: string;
  value?: T;
  children?: TreeNode<T>[];
  hint?: string;
  color?: ColorValue;
}

export interface Command {
  label: string;
  run: () => void;
  /** Shown before the label, e.g. `'File'` */
  group?: string;
  /** Shown on the right, e.g. `'ctrl+s'` */
  shortcut?: string;
  disabled?: boolean;
}

export interface BarChartItem {
  label: string;
  value: number;
  color?: ColorValue;
}

export interface KeyHint {
  key: string;
  label: string;
}
