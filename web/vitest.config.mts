import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the "@/..." imports from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Each test starts with fresh mocks, env vars, and globals.
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
