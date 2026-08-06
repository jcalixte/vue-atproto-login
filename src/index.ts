export { default as AtprotoHandleInput } from "./components/AtprotoHandleInput.vue"
export { default as AtprotoLogin } from "./components/AtprotoLogin.vue"
export { default as BlueskyLogo } from "./components/BlueskyLogo.vue"
export { type AtprotoLoginUi, DEFAULT_UI } from "./components/ui"

export {
  getActiveSession,
  getOAuthClient,
  resolveClientId,
  resetOAuthClient,
  restoreSession,
  revokeSession,
  signInWithHandle,
} from "./client"

export {
  configureAtprotoLogin,
  DEFAULT_HANDLE_RESOLVER,
  DEFAULT_SCOPE,
  isConfigured,
  isLoopbackHost,
  resetAtprotoLogin,
} from "./config"

export { atprotoLoginPlugin, type PluginOptions } from "./plugin"

export {
  BSKY_PUBLIC_API,
  bskyProfileResolver,
  bskySearchActors,
} from "./resolvers/bsky"
export {
  combineResolvers,
  SLINGSHOT_BASE_URL,
  slingshotProfileResolver,
} from "./resolvers/slingshot"

export {
  DEFAULT_STORAGE_KEY,
  localStorageSession,
  memoryStorageSession,
} from "./storage"

export {
  initAtprotoLogin,
  resetAtprotoLoginState,
  useAtprotoLogin,
  type UseAtprotoLogin,
} from "./useAtprotoLogin"

export type {
  ActorSearch,
  ActorSuggestion,
  AtprotoLoginOptions,
  AtprotoProfile,
  CachedSession,
  OAuthSession,
  ProfileResolver,
  SessionStorage,
} from "./types"
