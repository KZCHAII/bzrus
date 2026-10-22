import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/helpers/global-setup.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    pool: "forks",
  },
});
