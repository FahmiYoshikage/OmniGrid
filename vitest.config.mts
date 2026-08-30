import { join } from "node:path";
import { tmpdir } from "node:os";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": join(import.meta.dirname, "src"),
      "server-only": join(import.meta.dirname, "src/lib/security/server-only-test-shim.ts"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      OMNIGRID_MASTER_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      OMNIGRID_DB_PATH: join(tmpdir(), `omnigrid-vitest-${process.pid}.db`),
    },
  },
});
