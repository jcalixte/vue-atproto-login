import type { App, Plugin } from "vue"

import AtprotoHandleInput from "./components/AtprotoHandleInput.vue"
import AtprotoLogin from "./components/AtprotoLogin.vue"
import { configureAtprotoLogin } from "./config"
import type { AtprotoLoginOptions } from "./types"
import { initAtprotoLogin } from "./useAtprotoLogin"

export interface PluginOptions extends AtprotoLoginOptions {
  /**
   * Register `<AtprotoLogin>` and `<AtprotoHandleInput>` globally.
   * Default `false` — import them where you use them.
   */
  registerComponents?: boolean
  /**
   * Start the OAuth client at `app.use()` time rather than on first component
   * use. Default `true`: the pending `?code=` is consumed while the app boots,
   * so no view ever sees the callback params.
   */
  eager?: boolean
}

/**
 * ```ts
 * createApp(App)
 *   .use(atprotoLoginPlugin({ clientId: "https://remanso.at/client-metadata.json" }))
 *   .mount("#app")
 * ```
 */
export const atprotoLoginPlugin = (options: PluginOptions): Plugin => ({
  install(app: App) {
    configureAtprotoLogin(options)

    if (options.registerComponents) {
      app.component("AtprotoLogin", AtprotoLogin)
      app.component("AtprotoHandleInput", AtprotoHandleInput)
    }

    if (options.eager !== false) void initAtprotoLogin()
  },
})
