import { bskyProfileResolver, bskySearchActors } from "./resolvers/bsky"
import { SLINGSHOT_BASE_URL } from "./resolvers/slingshot"
import { localStorageSession } from "./storage"
import type { AtprotoLoginOptions, ResolvedOptions } from "./types"

export const DEFAULT_SCOPE = "atproto transition:generic"

export const DEFAULT_HANDLE_RESOLVER = SLINGSHOT_BASE_URL

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", ""])

export const isLoopbackHost = (): boolean => {
  if (typeof window === "undefined") return false
  return LOOPBACK_HOSTS.has(window.location.hostname)
}

let options: ResolvedOptions | null = null

/**
 * Set up the login for this app. Call once, before anything renders — usually
 * right next to `createApp` in `main.ts`.
 *
 * Configuration is module-global: the OAuth client's own storage is
 * origin-scoped, so two configs in one page would be two clients fighting over
 * the same IndexedDB.
 */
export const configureAtprotoLogin = (input: AtprotoLoginOptions): ResolvedOptions => {
  options = {
    clientId: input.clientId,
    devClientId: input.devClientId ?? "loopback",
    dev: input.dev ?? isLoopbackHost(),
    scope: input.scope ?? DEFAULT_SCOPE,
    handleResolver: input.handleResolver ?? DEFAULT_HANDLE_RESOLVER,
    storage: input.storage ?? localStorageSession(),
    resolveProfile: input.resolveProfile ?? bskyProfileResolver(),
    searchActors: input.searchActors ?? bskySearchActors(),
    stripCallbackParams: input.stripCallbackParams ?? true,
    autoSignInFromQuery: input.autoSignInFromQuery ?? false,
    onError:
      input.onError ??
      ((error, context) => {
        console.warn(`[atproto-login] ${context}`, error)
      }),
  }
  return options
}

export const getOptions = (): ResolvedOptions => {
  if (!options) {
    throw new Error(
      "[atproto-login] not configured. Call configureAtprotoLogin({ clientId }) " +
        "— or app.use(atprotoLoginPlugin({ clientId })) — before using the composable.",
    )
  }
  return options
}

export const isConfigured = (): boolean => options !== null

/** Test seam. */
export const resetAtprotoLogin = (): void => {
  options = null
}
