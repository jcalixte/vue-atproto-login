import { resolve } from "node:path"

import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"
import dts from "vite-plugin-dts"

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ["src"],
      entryRoot: "src",
      exclude: ["src/**/*.spec.ts", "src/**/__fixtures__/**"],
      rollupTypes: false,
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "vue-atproto-login.js",
    },
    rollupOptions: {
      // Peers stay external: one Vue instance and one OAuth client per page.
      external: ["vue", "@atproto/oauth-client-browser"],
      output: {
        assetFileNames: "vue-atproto-login.[ext]",
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.spec.ts"],
  },
})
