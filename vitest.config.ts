import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/tests/**/*.test.ts"],
    // Each test file runs in its own environment so config module-cache
    // doesn't bleed between tests that mutate env vars.
    isolate: true,
    // cli.test.ts spawns child processes via spawnSync("npx", ["tsx", ...])
    // which can take 3–8s on slow CI runners. 15s catches real hangs while
    // giving subprocess tests enough headroom on any runner.
    testTimeout: 15_000,
  },
});
