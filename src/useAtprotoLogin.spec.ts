import { beforeEach, describe, expect, it, vi } from "vitest"
import { nextTick } from "vue"

const load = vi.fn()
const signInRedirect = vi.fn()
const init = vi.fn()
const revoke = vi.fn()
const restore = vi.fn()
const addEventListener = vi.fn()

vi.mock("@atproto/oauth-client-browser", () => ({
  BrowserOAuthClient: {
    load: (...args: unknown[]) => {
      load(...args)
      return Promise.resolve({ signInRedirect, init, revoke, restore, addEventListener })
    },
  },
  buildLoopbackClientId: (url: URL) =>
    `http://localhost?redirect_uri=${encodeURIComponent(url.origin)}`,
}))

import { resetOAuthClient, resolveClientId } from "./client"
import { configureAtprotoLogin, resetAtprotoLogin } from "./config"
import { memoryStorageSession } from "./storage"
import type { AtprotoLoginOptions, SessionStorage } from "./types"
import { resetAtprotoLoginState, useAtprotoLogin } from "./useAtprotoLogin"

const ALICE = "did:plc:alice"

const setup = (overrides: Partial<AtprotoLoginOptions> = {}) =>
  configureAtprotoLogin({
    clientId: "https://example.com/client-metadata.json",
    dev: false,
    storage: memoryStorageSession(),
    resolveProfile: async (did) => ({ did, handle: "alice.bsky.social", avatar: "a.png" }),
    ...overrides,
  })

/** Lets the chain of awaits inside `initialize()` settle. */
const settle = async () => {
  for (let i = 0; i < 12; i++) await nextTick()
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAtprotoLogin()
  resetAtprotoLoginState()
  resetOAuthClient()
  init.mockResolvedValue(undefined)
  window.history.replaceState(null, "", "/")
})

describe("client id", () => {
  it("uses the metadata URL in production", () => {
    setup()
    expect(resolveClientId()).toBe("https://example.com/client-metadata.json")
  })

  it("appends the scope to the loopback id in dev, so repo writes are authorized", () => {
    setup({ dev: true, scope: "atproto transition:generic" })
    expect(resolveClientId()).toContain("&scope=atproto%20transition%3Ageneric")
  })

  it("honours an explicit dev client id", () => {
    setup({ dev: true, devClientId: "http://127.0.0.1:5173/client-metadata.json" })
    expect(resolveClientId()).toBe("http://127.0.0.1:5173/client-metadata.json")
  })
})

describe("restore", () => {
  it("stays unresolved until the client answers, so the UI does not flash 'sign in'", () => {
    setup()
    const { isReady, isLoggedIn } = useAtprotoLogin()
    expect(isReady.value).toBe(false)
    expect(isLoggedIn.value).toBe(false)
  })

  it("paints the cached identity before the network answers", async () => {
    const storage = memoryStorageSession()
    await storage.save({ did: ALICE, handle: "alice.bsky.social" })
    setup({ storage })
    // init() never settles, so anything on screen came out of the cache.
    init.mockReturnValue(new Promise(() => {}))

    const { did, handle, isLoggedIn } = useAtprotoLogin()
    await settle()

    expect(did.value).toBe(ALICE)
    expect(handle.value).toBe("alice.bsky.social")
    expect(isLoggedIn.value).toBe(true)
  })

  it("adopts the session init() hands back and caches it", async () => {
    const storage = memoryStorageSession()
    setup({ storage })
    init.mockResolvedValue({ session: { did: ALICE } })

    const { did, handle, avatar } = useAtprotoLogin()
    await settle()

    expect(did.value).toBe(ALICE)
    expect(handle.value).toBe("alice.bsky.social")
    expect(avatar.value).toBe("a.png")
    expect(await storage.load()).toEqual({ did: ALICE, handle: "alice.bsky.social" })
  })

  it("drops a cached identity whose grant is gone", async () => {
    const storage = memoryStorageSession()
    await storage.save({ did: ALICE, handle: "alice.bsky.social" })
    setup({ storage })
    init.mockResolvedValue(undefined)

    const { did, isLoggedIn, isReady } = useAtprotoLogin()
    await settle()

    expect(did.value).toBe("")
    expect(isLoggedIn.value).toBe(false)
    expect(isReady.value).toBe(true)
    expect(await storage.load()).toBeNull()
  })

  it("keeps the cached identity when restoring throws, so offline is not signed out", async () => {
    const storage = memoryStorageSession()
    await storage.save({ did: ALICE, handle: "alice.bsky.social" })
    setup({ storage, onError: () => {} })
    init.mockRejectedValue(new Error("offline"))

    const { did, isLoggedIn } = useAtprotoLogin()
    await settle()

    expect(did.value).toBe(ALICE)
    expect(isLoggedIn.value).toBe(true)
    expect(await storage.load()).toEqual({ did: ALICE, handle: "alice.bsky.social" })
  })

  it("runs init() once however many components ask", async () => {
    setup()
    useAtprotoLogin()
    useAtprotoLogin()
    useAtprotoLogin()
    await settle()
    expect(init).toHaveBeenCalledTimes(1)
  })
})

describe("callback params", () => {
  it("strips code, state and iss from the URL", async () => {
    window.history.replaceState(null, "", "/notes?code=abc&state=xyz&iss=https%3A%2F%2Fpds&keep=1")
    setup()
    init.mockResolvedValue({ session: { did: ALICE } })

    useAtprotoLogin()
    await settle()

    expect(window.location.search).toBe("?keep=1")
    expect(window.location.pathname).toBe("/notes")
  })

  it("delegates to a custom stripper, e.g. a router", async () => {
    const strip = vi.fn()
    window.history.replaceState(null, "", "/?code=abc")
    setup({ stripCallbackParams: strip })
    init.mockResolvedValue({ session: { did: ALICE } })

    useAtprotoLogin()
    await settle()

    expect(strip).toHaveBeenCalledOnce()
    expect(strip.mock.calls[0][0]).toBeInstanceOf(URL)
  })

  it("leaves the URL alone when disabled", async () => {
    window.history.replaceState(null, "", "/?code=abc")
    setup({ stripCallbackParams: false })
    init.mockResolvedValue({ session: { did: ALICE } })

    useAtprotoLogin()
    await settle()

    expect(window.location.search).toBe("?code=abc")
  })
})

describe("?handle= hand-off", () => {
  it("prefills, strips the param and starts sign-in", async () => {
    window.history.replaceState(null, "", "/?handle=bob.bsky.social")
    setup({ autoSignInFromQuery: "handle" })

    const { prefillHandle } = useAtprotoLogin()
    await settle()

    expect(prefillHandle.value).toBe("bob.bsky.social")
    expect(window.location.search).toBe("")
    expect(signInRedirect).toHaveBeenCalledWith("bob.bsky.social", undefined)
  })

  it("does not hijack an already signed-in visitor", async () => {
    window.history.replaceState(null, "", "/?handle=bob.bsky.social")
    setup({ autoSignInFromQuery: "handle" })
    init.mockResolvedValue({ session: { did: ALICE } })

    useAtprotoLogin()
    await settle()

    expect(signInRedirect).not.toHaveBeenCalled()
  })

  it("is off unless asked for", async () => {
    window.history.replaceState(null, "", "/?handle=bob.bsky.social")
    setup()

    useAtprotoLogin()
    await settle()

    expect(signInRedirect).not.toHaveBeenCalled()
  })
})

describe("sign in / out", () => {
  it("normalizes a pasted @handle", async () => {
    setup()
    const { signIn } = useAtprotoLogin()
    await signIn("  @alice.bsky.social ")
    expect(signInRedirect).toHaveBeenCalledWith("alice.bsky.social", undefined)
  })

  it("revokes the grant and clears the cache", async () => {
    const storage = memoryStorageSession()
    setup({ storage })
    init.mockResolvedValue({ session: { did: ALICE } })

    const { signOut, did, isLoggedIn } = useAtprotoLogin()
    await settle()
    await signOut()

    expect(revoke).toHaveBeenCalledWith(ALICE)
    expect(did.value).toBe("")
    expect(isLoggedIn.value).toBe(false)
    expect(await storage.load()).toBeNull()
  })

  it("signs out locally even when revoke fails", async () => {
    setup({ onError: () => {} })
    init.mockResolvedValue({ session: { did: ALICE } })
    revoke.mockRejectedValue(new Error("gone"))

    const { signOut, isLoggedIn } = useAtprotoLogin()
    await settle()
    await signOut()

    expect(isLoggedIn.value).toBe(false)
  })
})

describe("revocation while the tab is open", () => {
  it("clears the identity when the client reports the grant deleted", async () => {
    const storage = memoryStorageSession()
    setup({ storage })
    init.mockResolvedValue({ session: { did: ALICE } })

    const { isLoggedIn } = useAtprotoLogin()
    await settle()
    expect(isLoggedIn.value).toBe(true)

    // The SDK reports the deletion through the load-time callback.
    const { onSessionDeleted } = load.mock.calls[0][0] as {
      onSessionDeleted: (sub: string) => void
    }
    onSessionDeleted(ALICE)
    await settle()

    expect(isLoggedIn.value).toBe(false)
    expect(await storage.load()).toBeNull()
  })
})

describe("async storage", () => {
  it("works with a promise-based store, as PouchDB apps need", async () => {
    const rows = new Map<string, { did: string; handle: string }>()
    const pouchish: SessionStorage = {
      load: async () => rows.get("current") ?? null,
      save: async (session) => void rows.set("current", session),
      clear: async () => void rows.delete("current"),
    }
    setup({ storage: pouchish })
    init.mockResolvedValue({ session: { did: ALICE } })

    const { handle } = useAtprotoLogin()
    await settle()

    expect(handle.value).toBe("alice.bsky.social")
    expect(rows.get("current")).toEqual({ did: ALICE, handle: "alice.bsky.social" })
  })
})

describe("configuration", () => {
  it("says what to do when it has not been configured", () => {
    expect(() => useAtprotoLogin()).toThrow(/configureAtprotoLogin/)
  })
})
