import { computed, readonly, ref, type ComputedRef, type Ref } from "vue"

import {
  getActiveSession,
  onSessionDeleted,
  restoreSession,
  revokeSession,
  signInWithHandle,
} from "./client"
import { getOptions } from "./config"
import type { AtprotoProfile, OAuthSession } from "./types"

// `null` = auth not resolved yet, so the UI can hold its tongue instead of
// flashing "Sign in" at someone who is already signed in. `""` = resolved and
// signed out. A DID = signed in.
const did = ref<string | null>(null)
const handle = ref<string | null>(null)
const avatar = ref<string | null>(null)
const pds = ref<string | null>(null)
const displayName = ref<string | null>(null)
// Seeds the sign-in input when a cross-app link arrives carrying `?handle=`.
const prefillHandle = ref("")

let initialized: Promise<void> | null = null

const applyProfile = (profile: AtprotoProfile | null) => {
  if (!profile) return
  if (profile.handle) handle.value = profile.handle
  avatar.value = profile.avatar ?? null
  pds.value = profile.pds ?? null
  displayName.value = profile.displayName ?? null
}

const clearIdentity = () => {
  did.value = ""
  handle.value = ""
  avatar.value = null
  pds.value = null
  displayName.value = null
}

const fetchProfile = async (actorDid: string) => {
  const { resolveProfile, storage, onError } = getOptions()
  try {
    const profile = await resolveProfile(actorDid)
    applyProfile(profile)
    if (profile?.handle) await storage.save({ did: actorDid, handle: profile.handle })
  } catch (error) {
    // Keep whatever the cache had; a missing handle costs a nicety, not a session.
    onError(error, "could not resolve the profile")
  }
}

const CALLBACK_PARAMS = ["code", "state", "iss"]

/**
 * Drop the OAuth callback params. They are single-use and must not be
 * bookmarked or replayed — a reload with a spent `?code=` is an error at the PDS.
 */
const stripCallback = async () => {
  const { stripCallbackParams, onError } = getOptions()
  if (!stripCallbackParams) return

  const url = new URL(window.location.href)

  if (typeof stripCallbackParams === "function") {
    try {
      await stripCallbackParams(url)
    } catch (error) {
      onError(error, "stripCallbackParams failed")
    }
    return
  }

  const before = url.search
  for (const param of CALLBACK_PARAMS) url.searchParams.delete(param)
  if (url.search !== before) window.history.replaceState(null, "", url)
}

const watchForRevocation = () => {
  const { storage } = getOptions()
  onSessionDeleted((sub) => {
    if (sub && did.value && sub !== did.value) return
    void storage.clear()
    clearIdentity()
  })
}

const autoSignIn = async () => {
  const { autoSignInFromQuery, onError } = getOptions()
  if (!autoSignInFromQuery || did.value) return

  const url = new URL(window.location.href)
  const inbound = url.searchParams.get(autoSignInFromQuery)
  if (!inbound) return

  prefillHandle.value = inbound
  url.searchParams.delete(autoSignInFromQuery)
  window.history.replaceState(null, "", url)

  try {
    await signInWithHandle(inbound)
  } catch (error) {
    onError(error, `?${autoSignInFromQuery}= prefill sign-in failed`)
  }
}

const initialize = async () => {
  const { storage, onError } = getOptions()

  watchForRevocation()

  // Local cache first, so the UI paints a handle before any network call.
  let stored = null
  try {
    stored = await storage.load()
  } catch (error) {
    onError(error, "could not read the cached session")
  }
  did.value = stored?.did ?? ""
  handle.value = stored?.handle ?? ""
  if (stored?.did) void fetchProfile(stored.did)

  try {
    // init() consumes the callback params on the redirect that created the
    // session, and hands the session back exactly once.
    const session = await restoreSession()

    if (session) {
      did.value = session.did
      await fetchProfile(session.did)
      await stripCallback()
      return
    }

    if (stored?.did) {
      // The client resolved with no session: the stored grant is gone, revoked
      // or expired past refresh.
      await storage.clear()
      clearIdentity()
    }
  } catch (error) {
    // A throw is a transport problem, not a revoked grant — keep the cached
    // identity so going offline does not read as being signed out.
    onError(error, "could not restore the OAuth session")
  }

  await autoSignIn()
}

/**
 * Kick off the OAuth client and consume any pending callback. Idempotent.
 *
 * `useAtprotoLogin()` calls this for you; call it directly from `main.ts` only
 * if you want the redirect handled before the first component mounts.
 */
export const initAtprotoLogin = (): Promise<void> => {
  if (!initialized) initialized = initialize()
  return initialized
}

export interface UseAtprotoLogin {
  /** `null` until auth resolves, then `""` when signed out, else the DID. */
  did: Readonly<Ref<string | null>>
  handle: Readonly<Ref<string | null>>
  displayName: Readonly<Ref<string | null>>
  avatar: Readonly<Ref<string | null>>
  /** The account's PDS endpoint, if the profile resolver reports one. */
  pds: Readonly<Ref<string | null>>
  /** Seeds the sign-in input, e.g. from an inbound `?handle=`. */
  prefillHandle: Ref<string>
  /** False until the OAuth client has answered — render a skeleton, not "Sign in". */
  isReady: ComputedRef<boolean>
  isLoggedIn: ComputedRef<boolean>
  /** Redirects the page to the user's PDS. On success it does not return. */
  signIn: (handle: string, options?: { signal?: AbortSignal }) => Promise<void>
  /** Revokes the grant at the PDS, so the user is signed out everywhere. */
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  /** The live `OAuthSession` for writing to the signed-in user's repo. */
  getSession: () => Promise<OAuthSession | null>
}

/**
 * Who is signed in, app-wide. The refs are module-level rather than per-call:
 * the header and the save panel are looking at one session, not two.
 */
export const useAtprotoLogin = (): UseAtprotoLogin => {
  // Read the config here, synchronously, so a missing configureAtprotoLogin()
  // throws where the component called it — not as an unhandled rejection out of
  // the async initializer, which points at nothing useful.
  getOptions()
  void initAtprotoLogin()

  const isLoggedIn = computed(() => !!did.value)
  const isReady = computed(() => did.value !== null)

  const signIn = (inputHandle: string, options?: { signal?: AbortSignal }) =>
    signInWithHandle(inputHandle.trim().replace(/^@/, ""), options)

  const signOut = async () => {
    const { storage, onError } = getOptions()
    if (did.value) {
      try {
        await revokeSession(did.value)
      } catch (error) {
        // The grant may already be gone server-side; sign out locally regardless.
        onError(error, "revoke failed; clearing the local session anyway")
      }
    }
    await storage.clear()
    clearIdentity()
  }

  const refresh = async () => {
    if (did.value) await fetchProfile(did.value)
  }

  const getSession = async () => (did.value ? getActiveSession(did.value) : null)

  return {
    did: readonly(did),
    handle: readonly(handle),
    displayName: readonly(displayName),
    avatar: readonly(avatar),
    pds: readonly(pds),
    prefillHandle,
    isReady,
    isLoggedIn,
    signIn,
    signOut,
    refresh,
    getSession,
  }
}

/** Test seam. */
export const resetAtprotoLoginState = (): void => {
  initialized = null
  did.value = null
  handle.value = null
  avatar.value = null
  pds.value = null
  displayName.value = null
  prefillHandle.value = ""
}
