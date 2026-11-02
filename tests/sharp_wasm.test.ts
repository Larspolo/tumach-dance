// The WebAssembly build of sharp (2026-10-31): the prebuilt linux-x64 binary of sharp needs a CPU with x86-64-v2. The
// CPU of the home server has no x86-64-v2, so the start hook of the site failed and each page gave a server error.
// sharp then loads `@img/sharp-wasm32`, but only when it is installed, and only at the same version as sharp.
import { createRequire } from "node:module";
import { expect, test } from "vitest";
import pkg from "../package.json";

const require = createRequire(import.meta.url);

test("the WebAssembly build of sharp is a dependency at the version of sharp", () => {
  const deps: Record<string, string> = pkg.dependencies;
  expect(deps["@img/sharp-wasm32"]).toBeDefined();
  expect(deps["@img/sharp-wasm32"]).toBe(deps.sharp);
});

test("the WebAssembly build of sharp loads", () => {
  const binding = require("@img/sharp-wasm32/sharp.node") as { libvipsVersion(): { isWasm: boolean } };
  expect(binding.libvipsVersion().isWasm).toBe(true);
});
