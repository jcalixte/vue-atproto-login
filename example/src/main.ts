import { createApp } from "vue"

import { atprotoLoginPlugin } from "../../src"
import App from "./App.vue"

createApp(App)
  .use(
    atprotoLoginPlugin({
      // On localhost the library builds a loopback client id instead, so this
      // value is never used by `pnpm example`.
      clientId: "https://example.com/client-metadata.json",
      // Cross-app hand-off: /?handle=alice.bsky.social signs straight in.
      autoSignInFromQuery: "handle",
    }),
  )
  .mount("#app")
