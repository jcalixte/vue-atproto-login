import type { AtprotoProfile, ProfileResolver } from "../types"

export const SLINGSHOT_BASE_URL = "https://slingshot.microcosm.blue"

/**
 * Identity straight off the DID document, via microcosm's slingshot. It answers
 * handle *and* PDS endpoint — which the appview does not — and never touches
 * bsky.app, so an app that is not a Bluesky client stays that way.
 *
 * There is no avatar in a DID document, so `avatar` is always undefined here.
 * Pair it with {@link bskyProfileResolver} through {@link combineResolvers} if
 * you want both.
 */
export const slingshotProfileResolver = ({
  baseUrl = SLINGSHOT_BASE_URL,
}: { baseUrl?: string } = {}): ProfileResolver => {
  const cache = new Map<string, Promise<AtprotoProfile | null>>()

  return (identifier, options) => {
    // Slingshot takes a handle or a DID; cache under both forms of whatever
    // comes back, so either lookup hits.
    const key = identifier.trim().replace(/^@/, "")
    const hit = cache.get(key)
    if (hit) return hit

    const pending = (async (): Promise<AtprotoProfile | null> => {
      const url = `${baseUrl}/xrpc/blue.microcosm.identity.resolveMiniDoc?identifier=${encodeURIComponent(key)}`
      const res = await fetch(url, { signal: options?.signal })
      if (!res.ok) return null
      const data = (await res.json()) as { did?: string; handle?: string; pds?: string }
      if (!data.did || !data.handle) return null

      const profile: AtprotoProfile = { did: data.did, handle: data.handle, pds: data.pds }
      cache.set(profile.did, Promise.resolve(profile))
      cache.set(profile.handle, Promise.resolve(profile))
      return profile
    })()

    pending.catch(() => cache.delete(key))
    cache.set(key, pending)
    return pending
  }
}

/**
 * Try resolvers in order and merge what they return, first answer winning per
 * field. `combineResolvers(slingshot, bsky)` is the remanso.space arrangement:
 * the DID document for handle and PDS, the appview only for the avatar.
 *
 * Resolvers run in parallel; one that throws is treated as no answer.
 */
export const combineResolvers = (...resolvers: ProfileResolver[]): ProfileResolver => {
  return async (did, options) => {
    const settled = await Promise.allSettled(resolvers.map((resolve) => resolve(did, options)))
    const answers = settled
      .map((result) => (result.status === "fulfilled" ? result.value : null))
      .filter((value): value is AtprotoProfile => !!value)

    if (!answers.length) return null

    return answers.reduce<AtprotoProfile>(
      (merged, answer) => ({
        did: merged.did || answer.did,
        handle: merged.handle || answer.handle,
        displayName: merged.displayName ?? answer.displayName,
        avatar: merged.avatar ?? answer.avatar,
        pds: merged.pds ?? answer.pds,
      }),
      { did, handle: "" },
    )
  }
}
