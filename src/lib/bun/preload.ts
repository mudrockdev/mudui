/**
 * Registers the mudui Svelte plugin. Use it from `bunfig.toml`:
 *
 * ```toml
 * preload = ["mudui/preload"]
 *
 * [test]
 * preload = ["mudui/preload"]
 * ```
 */
import { plugin } from "bun";
import { mudui } from "./plugin.js";

plugin(mudui());
