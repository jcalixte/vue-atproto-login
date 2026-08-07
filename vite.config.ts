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
    // ESM only. This is a browser OAuth client for Vue 3 apps — every consumer
    // is a bundler, and a UMD build would only be dead weight in the tarball.
    lib: {
      entry: resolve(import.meta.dirname, "src/index.ts"),
      formats: ["es"],
      fileName: () => "vue-atproto-login.js",
    },
    rollupOptions: {
      // Peers stay external: one Vue instance, one OAuth client per page.
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
