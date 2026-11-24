/**
 * The mudui custom renderer module.
 *
 * Components compiled with `experimental.customRenderer` pointing at this module
 * import its default export and use it instead of the DOM. The renderer only
 * maintains the node tree; the app runtime (`../runtime/app.ts`) lays it out and
 * paints it to the terminal whenever it changes.
 */
import { createRenderer } from "svelte/renderer";
import { TComment, TElement, TFragment, TText } from "./nodes.js";

const renderer = createRenderer<{
  fragment: TFragment;
  element: TElement;
  text: TText;
  comment: TComment;
}>({
  createFragment: () => new TFragment(),
  createElement: (name) => new TElement(name),
  createText: (data) => new TText(data),
  createComment: (data) => new TComment(data),

  getNodeType: (node) => node.kind,

  getText: (node) => node.data,
  setText(node, text) {
    node.data = text;
  },

  getAttribute(element, name) {
    const value = element.getAttribute(name);
    return value == null ? null : String(value);
  },
  setAttribute(element, name, value) {
    element.setAttribute(name, value);
  },
  removeAttribute(element, name) {
    element.removeAttribute(name);
  },
  hasAttribute: (element, name) => element.attributes.has(name),

  getFirstChild: (parent) => parent.first,
  getLastChild: (parent) => parent.last,
  getNextSibling: (node) => node.next,
  getParent: (node) => node.parent as TElement | TFragment | null,

  insert(parent, node, anchor) {
    parent.insertBefore(node, anchor);
  },
  remove(node) {
    node.parent?.removeChild(node);
  },

  addEventListener(target, type, handler) {
    target.addEventListener(type, handler);
  },
  removeEventListener(target, type, handler) {
    target.removeEventListener(type, handler);
  },
});

export default renderer;
