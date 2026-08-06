import type { ActorSearch, ActorSuggestion, AtprotoProfile, ProfileResolver } from "../types"

export const BSKY_PUBLIC_API = "https://public.api.bsky.app"

/**
 * Identity from the public Bluesky appview. One call answers handle *and*
 * avatar, needs no auth and no SDK — which is why it is the default.
 *
 * It does mean a request to bsky.app. If your app deliberately talks to as few
 * third parties as it can, use {@link slingshotProfileResolver} instead and go
 * without the avatar.
 */
export const bskyProfileResolver = ({
  appView = BSKY_PUBLIC_API,
}: { appView?: string } = {}): ProfileResolver => {
  const cache = new Map<string, Promise<AtprotoProfile | null>>()

  return (did, options) => {
    const hit = cache.get(did)
    if (hit) return hit

    const pending = (async (): Promise<AtprotoProfile | null> => {
      const url = `${appView}/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(did)}`
      const res = await fetch(url, { signal: options?.signal })
      if (!res.ok) return null
      const data = (await res.json()) as {
        did?: string
        handle?: string
        displayName?: string
        avatar?: string
      }
      if (!data.handle) return null
      return {
        did: data.did ?? did,
        handle: data.handle,
        displayName: data.displayName,
        avatar: data.avatar,
      }
    })()

    // Don't cache failures — a transient network error shouldn't stick.
    pending.catch(() => cache.delete(did))
    cache.set(did, pending)
    return pending
  }
}

/**
 * Handles matching a typed prefix, best match first. Never throws and never
 * rejects: a suggestion list is a convenience, and a network hiccup should leave
 * the box behaving like a plain text field rather than showing an error.
 */
export const bskySearchActors = ({
  appView = BSKY_PUBLIC_API,
}: { appView?: string } = {}): ActorSearch => {
  return async (query, { limit = 8, signal } = {}) => {
    const q = query.trim()
    if (!q) return []

    const params = new URLSearchParams({ q, limit: String(limit) })

    try {
      const res = await fetch(
        `${appView}/xrpc/app.bsky.actor.searchActorsTypeahead?${params}`,
        { signal },
      )
      if (!res.ok) return []

      const body = (await res.json()) as { actors?: ActorSuggestion[] }
      return (body.actors ?? []).map(({ did, handle, displayName, avatar }) => ({
        did,
        handle,
        displayName,
        avatar,
      }))
    } catch {
      // Includes the abort of a superseded keystroke, which is not a failure
      // worth surfacing.
      return []
    }
  }
}
