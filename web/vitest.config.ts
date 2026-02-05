import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "test/",
        "**/*.config.{js,ts}",
        "**/*.d.ts",
        "app/api/**",
        "components/**",
        ".next/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Force single React instance from workspace root (ensures test renderer uses same React as components)
      react: path.resolve(__dirname, "../node_modules/react"),
      "react-dom": path.resolve(__dirname, "../node_modules/react-dom"),
      // Force single Zod instance from workspace root (critical for OpenAPI extension to work across shared + web)
      zod: path.resolve(__dirname, "../node_modules/zod"),
    },
  },
});
