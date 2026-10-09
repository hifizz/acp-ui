import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@acp-render/core": fileURLToPath(new URL("./packages/core/src/index.ts", import.meta.url)),
  "@acp-render/react": fileURLToPath(new URL("./packages/react/src/index.ts", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: { name: "core", include: ["packages/core/src/**/*.test.ts"], environment: "node" },
      },
      {
        resolve: { alias },
        test: {
          name: "react",
          include: ["packages/react/src/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
    ],
  },
});
