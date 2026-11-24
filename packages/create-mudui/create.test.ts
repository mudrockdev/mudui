import { afterAll, describe, expect, test } from "bun:test";
import { absolute, create, packageName } from "./index.ts";

const root = `${Bun.env.TMPDIR ?? Bun.env.TEMP ?? "/tmp"}/create-mudui-${crypto.randomUUID()}`;
afterAll(async () => {
  await Bun.$`rm -rf ${root}`.quiet();
});

const read = (path: string) => Bun.file(path).text();
const list = (dir: string) =>
  [...new Bun.Glob("**").scanSync({ cwd: dir, dot: true, onlyFiles: false })]
    .map((path) => path.replaceAll("\\", "/"))
    .sort();

describe("create-mudui", () => {
  test("scaffolds a minimal project", async () => {
    const dir = `${root}/My App`;
    const name = await create({ dir });
    expect(name).toBe("my-app");

    expect(list(dir)).toEqual([
      ".gitignore",
      "README.md",
      "build.ts",
      "bunfig.toml",
      "package.json",
      "src",
      "src/App.svelte",
      "src/main.ts",
      "svelte.config.js",
      "tests",
      "tests/App.test.ts",
      "tsconfig.json",
    ]);

    const manifest = await Bun.file(`${dir}/package.json`).json();
    expect(manifest.name).toBe("my-app");
    expect(Object.keys(manifest.dependencies)).toEqual(["mudui", "svelte"]);
    expect(Object.keys(manifest.devDependencies)).toEqual(["@types/bun"]);
    expect(manifest.scripts.start).toBe("bun src/main.ts");
    expect(manifest.scripts.test).toBe("bun test");
    expect(manifest.scripts["build:windows"]).toBe("bun build.ts windows");
    expect(manifest.scripts["build:linux"]).toBe("bun build.ts linux");
    expect(manifest.scripts["build:darwin"]).toBe("bun build.ts darwin");
    expect(await read(`${dir}/README.md`)).toStartWith("# my-app\n");
    expect(await read(`${dir}/.gitignore`)).toBe(await read(`${import.meta.dir}/template/_gitignore`));
  });

  test("uses the given mudui specifier", async () => {
    const dir = `${root}/custom`;
    await create({ dir, mudui: "file:../mudui.tgz" });
    const manifest = await Bun.file(`${dir}/package.json`).json();
    expect(manifest.dependencies.mudui).toBe("file:../mudui.tgz");
  });

  test("refuses to overwrite a non-empty directory", async () => {
    const dir = `${root}/taken`;
    await create({ dir });
    await Bun.write(`${dir}/extra`, "");
    expect(create({ dir })).rejects.toThrow("is not empty");
  });

  test("package names", () => {
    expect(packageName("/x/Hello World!")).toBe("hello-world");
    expect(packageName("/x/__")).toBe("mudui-app");
    expect(packageName("/x/tui.app")).toBe("tui.app");
  });

  test("paths are resolved against the current directory", () => {
    const cwd = process.cwd();
    expect(absolute("my-app")).toBe(`${cwd}/my-app`);
    expect(absolute("./a/../b#1 %x/")).toBe(`${cwd}/b#1 %x`);
    expect(absolute("/tmp/x/")).toBe("/tmp/x");
    expect(absolute(".")).toBe(cwd);
  });
});
