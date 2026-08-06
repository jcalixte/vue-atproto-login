import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

// The example imports the library from source, so editing `src/` reloads here.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [vue()],
  server: { port: 5180 },
})
