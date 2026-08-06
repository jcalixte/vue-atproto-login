import { BrowserOAuthClient, buildLoopbackClientId } from "@atproto/oauth-client-browser"

import { getOptions } from "./config"
import type { OAuthSession } from "./types"

let clientPromise: Promise<BrowserOAuthClient> | null = null

type SessionDeletedListener = (sub: string) => void

const sessionDeletedListeners = new Set<SessionDeletedListener>()

/**
 * Fires when a grant dies underneath us — revoked from another device, or its
 * refresh token expired. The composable uses it to drop the cached identity so
 * the UI stops offering writes it can no longer perform.
 *
 * Where this comes from depends on the SDK version: `@atproto/oauth-client` 0.4+
 * takes an `onSessionDeleted` option at load time, while 0.3 emitted a `deleted`
 * event off the client. Both are wired below, and the handler is idempotent, so
 * a version that somehow has both does no harm.
 */
export const onSessionDeleted = (listener: SessionDeletedListener): (() => void) => {
  sessionDeletedListeners.add(listener)
  return () => sessionDeletedListeners.delete(listener)
}

const notifySessionDeleted = (sub: string) => {
  for (const listener of sessionDeletedListeners) listener(sub)
}

/**
 * The `client_id` for the current environment.
 *
 * In production this is simply the URL of your hosted `client-metadata.json` —
 * in atproto OAuth the id *is* the metadata document.
 *
 * In development there is no such URL, so we build a loopback id, and append the
 * scope to it. `buildLoopbackClientId` only fills in `redirect_uri`; its implied
 * scope is a bare `atproto`, which authorizes no repo writes. Without this,
 * `pnpm dev` can read but every `putRecord` fails with an authorization error
 * that looks like a bug in your own code.
 */
export const resolveClientId = (): string => {
  const { clientId, devClientId, dev, scope } = getOptions()
  if (!dev) return clientId
  if (devClientId !== "loopback") return devClientId
  const loopback = buildLoopbackClientId(new URL(window.location.origin))
  return `${loopback}&scope=${encodeURIComponent(scope)}`
}

/** The one `BrowserOAuthClient` for this origin, loaded lazily and memoized. */
export const getOAuthClient = (): Promise<BrowserOAuthClient> => {
  if (!clientPromise) {
    const { handleResolver } = getOptions()
    clientPromise = BrowserOAuthClient.load({
      clientId: resolveClientId(),
      handleResolver,
      onSessionDeleted: (sub: string) => notifySessionDeleted(sub),
    }).then((client) => {
      // 0.3.x route: the client was an EventTarget emitting `deleted`.
      const legacy = client as unknown as Partial<EventTarget>
      legacy.addEventListener?.("deleted", (event) => {
        const sub = (event as CustomEvent<{ sub?: string }>).detail?.sub
        if (sub) notifySessionDeleted(sub)
      })
      return client
    })
  }
  return clientPromise
}

/** Hand the browser to the user's PDS. On success this call never returns. */
export const signInWithHandle = async (
  handle: string,
  options?: { signal?: AbortSignal },
): Promise<void> => {
  const client = await getOAuthClient()
  await client.signInRedirect(handle, options)
}

/**
 * Consume the `?code=&state=` the PDS redirected back with, and hand back the
 * session it created. Returns `null` when there is no session to restore.
 *
 * `init()` must run exactly once per page load, which is why this lives behind
 * the composable's one-shot initializer rather than being called from a view.
 */
export const restoreSession = async (): Promise<OAuthSession | null> => {
  const client = await getOAuthClient()
  const result = await client.init()
  return result?.session ?? null
}

/** Revoke the grant at the PDS. The user is signed out everywhere, not just here. */
export const revokeSession = async (sub: string): Promise<void> => {
  const client = await getOAuthClient()
  await client.revoke(sub)
}

/**
 * Re-derive the live OAuth session for a DID — the object you pass to
 * `new Agent(session)` from `@atproto/api`, or use as a `fetch` handler, to
 * write to that user's repo.
 *
 * `init()` hands the session back only once, on the redirect that created it,
 * so anything writing to the PDS later restores it from storage by DID instead.
 */
export const getActiveSession = async (did: string): Promise<OAuthSession | null> => {
  try {
    const client = await getOAuthClient()
    return (await client.restore(did)) ?? null
  } catch (error) {
    getOptions().onError(error, "getActiveSession: could not restore session")
    return null
  }
}

/** Test seam. Forgets the memoized client so the next call reloads it. */
export const resetOAuthClient = (): void => {
  clientPromise = null
  sessionDeletedListeners.clear()
}
