import type { BrowserOAuthClient, OAuthSession } from "@atproto/oauth-client-browser"

/**
 * The identity we cache locally so the UI can paint a handle before any network
 * call. This is a *hint*, not the grant: the tokens and the DPoP keypair live in
 * origin-scoped IndexedDB managed by `BrowserOAuthClient`. Clearing this cache
 * signs nobody out.
 */
export interface CachedSession {
  did: string
  handle: string
}

/**
 * Where that hint is kept. The default is `localStorage`, but every method may
 * return a promise, so a PouchDB / IndexedDB / Dexie store drops in unchanged.
 */
export interface SessionStorage {
  load(): CachedSession | null | Promise<CachedSession | null>
  save(session: CachedSession): void | Promise<void>
  clear(): void | Promise<void>
}

/** What we can learn about a DID beyond the DID itself. */
export interface AtprotoProfile {
  did: string
  handle: string
  displayName?: string
  avatar?: string
  /** The account's PDS endpoint, when the resolver knows it (slingshot does). */
  pds?: string
}

/**
 * Turns a DID into a display identity. Returning `null` is not an error — it
 * means "no better answer than the DID", and the cached handle is kept.
 */
export type ProfileResolver = (
  did: string,
  options?: { signal?: AbortSignal },
) => Promise<AtprotoProfile | null>

/** One row of the handle typeahead. */
export interface ActorSuggestion {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

export type ActorSearch = (
  query: string,
  options?: { limit?: number; signal?: AbortSignal },
) => Promise<ActorSuggestion[]>

export interface AtprotoLoginOptions {
  /**
   * The production `client_id`, which in atproto OAuth *is* the URL of your
   * hosted `client-metadata.json` — e.g. `https://remanso.at/client-metadata.json`.
   *
   * Two origins are two clients: separate consent, refresh token and DPoP
   * keypair. Sessions are not shareable between them, by design.
   */
  clientId: string

  /**
   * `client_id` to use in development, where there is no public metadata URL to
   * point at. Defaults to `"loopback"`, which builds an atproto loopback client
   * id from `window.location.origin` **with `scope` appended**.
   *
   * That appended scope matters: `buildLoopbackClientId` only fills in
   * `redirect_uri`, so the implied scope is a bare `atproto` that authorizes no
   * repo writes at all — `putRecord` then fails in dev with an authorization
   * error that reads like a bug in your own code.
   */
  devClientId?: string | "loopback"

  /**
   * Whether this is a development build. Defaults to a runtime check for a
   * loopback host (`localhost`, `127.0.0.1`, `[::1]`).
   *
   * Pass `import.meta.env.DEV` explicitly if you'd rather your bundler decide —
   * this library cannot read your `import.meta.env`, since its own value was
   * frozen when *it* was built.
   */
  dev?: boolean

  /** OAuth scope. Writing records needs `transition:generic` on top of `atproto`. */
  scope?: string

  /** Handle-to-DID resolver service. Default `https://bsky.social`. */
  handleResolver?: string

  /** Local identity cache. Default: `localStorageSession()`. */
  storage?: SessionStorage

  /** How a DID becomes a handle and an avatar. Default: `bskyProfileResolver()`. */
  resolveProfile?: ProfileResolver

  /** Backs the typeahead in `<AtprotoLogin>`. Default: `bskySearchActors()`. */
  searchActors?: ActorSearch

  /**
   * What to do with the `?code=&state=&iss=` params the PDS redirects back with.
   * They must not be bookmarked or replayed.
   *
   * - `true` (default) — `history.replaceState` with those three params removed.
   * - `false` — leave the URL alone; you are handling it.
   * - a function — called with the current URL for you to rewrite, e.g. through
   *   a router: `(url) => router.replace({ path: url.pathname })`.
   */
  stripCallbackParams?: boolean | ((url: URL) => void | Promise<void>)

  /**
   * Read a handle out of this query param on load and start sign-in with it
   * automatically. Set to `"handle"` for the cross-app link pattern
   * (`https://remanso.at/?handle=alice.bsky.social`). Default: disabled.
   *
   * The param is stripped before the redirect, so it is never bookmarked.
   */
  autoSignInFromQuery?: string | false

  /** Called when restoring the session throws. Default: `console.warn`. */
  onError?: (error: unknown, context: string) => void
}

export type ResolvedOptions = Required<
  Omit<AtprotoLoginOptions, "devClientId" | "onError">
> & {
  devClientId: string | "loopback"
  onError: (error: unknown, context: string) => void
}

export type { BrowserOAuthClient, OAuthSession }
