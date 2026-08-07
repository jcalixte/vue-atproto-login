import { beforeEach, describe, expect, it } from "vitest"

import {
  configureAtprotoLogin,
  DEFAULT_HANDLE_RESOLVER,
  DEFAULT_SCOPE,
  getOptions,
  resetAtprotoLogin,
} from "./config"
import { SLINGSHOT_BASE_URL } from "./resolvers/slingshot"

const CLIENT_ID = "https://app.example/client-metadata.json"

describe("configureAtprotoLogin defaults", () => {
  beforeEach(() => resetAtprotoLogin())

  it("resolves handles through slingshot", () => {
    // The resolver is passed straight to BrowserOAuthClient, so a wrong default
    // is only visible as a failed sign-in in production.
    expect(DEFAULT_HANDLE_RESOLVER).toBe("https://slingshot.microcosm.blue")
    expect(DEFAULT_HANDLE_RESOLVER).toBe(SLINGSHOT_BASE_URL)
    expect(configureAtprotoLogin({ clientId: CLIENT_ID }).handleResolver).toBe(
      SLINGSHOT_BASE_URL,
    )
  })

  it("lets a PDS be used instead", () => {
    configureAtprotoLogin({ clientId: CLIENT_ID, handleResolver: "https://bsky.social" })
    expect(getOptions().handleResolver).toBe("https://bsky.social")
  })

  it("keeps the rest of the defaults", () => {
    const options = configureAtprotoLogin({ clientId: CLIENT_ID })
    expect(options.scope).toBe(DEFAULT_SCOPE)
    expect(options.devClientId).toBe("loopback")
    expect(options.stripCallbackParams).toBe(true)
    expect(options.autoSignInFromQuery).toBe(false)
  })
})
