import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", "tailwind-preset": "src/tailwind-preset.ts" },
  format: ["esm"],
  dts: true,
  clean: true,
  splitting: true,
  external: ["react", "react-dom", "react/jsx-runtime"],
});
