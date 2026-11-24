import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

/** Components that render to the terminal, through mudui's custom renderer */
const renderer = `${import.meta.dirname}/src/lib/renderer/index.ts`;
const terminal = (filename: string) =>
  /[/\\](src[/\\]lib|examples|tests)[/\\]/.test(filename) &&
  !filename.includes("node_modules");

export default defineConfig({
  plugins: [
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
        experimental: {
          customRenderer: ({ filename }) =>
            terminal(filename) ? renderer : null,
        },
      },

      // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
      // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
      // See https://svelte.dev/docs/kit/adapters for more information about adapters.
      adapter: adapter(),
    }),
  ],
});
