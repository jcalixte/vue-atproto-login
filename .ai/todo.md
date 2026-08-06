# vue-atproto-login — extraction plan

Extracted from three apps that each reimplemented the same atproto OAuth login:

| | remanso (`remanso.space`) | remanso-at (`remanso.at`) | speech-to-text (`stt.apoena.dev`) |
|---|---|---|---|
| composable | `useATProtoLogin.hook.ts` | `useSession.ts` | `useSession.ts` |
| identity | slingshot `getAuthor` + bsky `getProfile` for avatar | bsky `getProfile` (handle + avatar) | slingshot `resolveIdentityCached` (handle only) |
| cache | PouchDB (`data.get/update/remove`, async) | `localStorage` (sync) | `localStorage` (sync) |
| callback strip | `history.replaceState(pathname + search)` | `router.replace` dropping `code` | `history.replaceState` dropping `code`/`state`/`iss` |
| dev client id | loopback, **no scope** | loopback, **no scope** | loopback **+ `&scope=`** |
| UI | daisyUI + typeahead suggestions + Bluesky logo | plain CSS, no suggestions, avatar | plain, folded into header |
| extra | `withSignOut` prop | `?handle=` prefill + auto sign-in | — |

Everything else was byte-identical: `getOAuthClient` singleton, `signInWithHandle`,
`restoreSession`, `sdkSignOut`, `getActiveSession`, the `null` / `""` / did tri-state,
and the cache-first-then-`init()` restore dance.

## Tasks

- [x] Read all three implementations, diff them
- [x] Check `@atproto/oauth-client-browser` current API (0.5.3)
- [x] `configureAtprotoLogin()` — one config object covering every divergence
- [x] Pluggable `SessionStorage` (localStorage default, async-capable for PouchDB)
- [x] Pluggable `ProfileResolver` (bsky appview default, slingshot alternative)
- [x] `useAtprotoLogin()` composable — union of the three composables
- [x] `<AtprotoLogin>` component — remanso's typeahead version as the baseline
- [x] `searchActors` typeahead helper
- [x] `deleted` event wiring (none of the three had it — grant death now clears cache live)
- [x] Vite library build + `vite-plugin-dts`
- [x] Vitest unit tests
- [x] Example app (most complete: typeahead + avatar + sign-out)
- [x] README with a migration section per app

## Review

Shipped `vue-atproto-login` 0.1.0. Public surface:

- `configureAtprotoLogin(options)` / `atprotoLoginPlugin(options)`
- `useAtprotoLogin()` → `{ did, handle, avatar, pds, isReady, isLoggedIn, prefillHandle,
  signIn, signOut, refresh, getSession }`
- `<AtprotoLogin>` + `<AtprotoHandleInput>`
- `getOAuthClient()`, `getActiveSession(did)`, `signInWithHandle()`, `restoreSession()`
- `localStorageSession()`, `memoryStorageSession()`
- `bskyProfileResolver()`, `slingshotProfileResolver()`, `combineResolvers()`
- `searchActors()`, `bskySearchActors()`

Deliberately left out: PDS write helpers (`uploadRecording`, `putRecord`…). They are
app-lexicon-specific; the package hands back a live `OAuthSession` and stops there.
