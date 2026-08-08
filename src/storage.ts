import type { CachedSession, SessionStorage } from "./types"

export const DEFAULT_STORAGE_KEY = "atproto-session-current"

/**
 * The default identity cache: one `localStorage` key holding `{ did, handle }`.
 *
 * A half-written or hand-edited value must read as "signed out" rather than
 * throw during app boot, so reads swallow everything.
 */
export const localStorageSession = (key = DEFAULT_STORAGE_KEY): SessionStorage => ({
  load() {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as Partial<CachedSession>
      return parsed?.did ? { did: parsed.did, handle: parsed.handle ?? "" } : null
    } catch {
      return null
    }
  },
  save(session) {
    try {
      localStorage.setItem(key, JSON.stringify(session))
    } catch {
      // Private mode, or a full quota. Losing the hint costs a paint, not a session.
    }
  },
  clear() {
    try {
      localStorage.removeItem(key)
    } catch {
      // Private mode, or a full quota.
    }
  },
})

/** No persistence at all — for tests and SSR-ish environments. */
export const memoryStorageSession = (): SessionStorage => {
  let current: CachedSession | null = null
  return {
    load: () => current,
    save: (session) => {
      current = session
    },
    clear: () => {
      current = null
    },
  }
}
