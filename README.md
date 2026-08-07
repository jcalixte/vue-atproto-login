# vue-atproto-login

atproto / Bluesky OAuth sign-in for Vue 3: a composable, a component, and a handle typeahead.

Extracted from three apps that had each grown their own copy of the same flow
([remanso.space](https://remanso.space), [remanso.at](https://remanso.at),
[stt.apoena.dev](https://stt.apoena.dev)). Every place they diverged is now an option;
everything they agreed on is the default.

```bash
pnpm add vue-atproto-login @atproto/oauth-client-browser
```

## Quick start

```ts
// main.ts
import { createApp } from "vue"
import { atprotoLoginPlugin } from "vue-atproto-login"
import "vue-atproto-login/style.css"

createApp(App)
  .use(atprotoLoginPlugin({ clientId: "https://my-app.example/client-metadata.json" }))
  .mount("#app")
```

```vue
<script setup lang="ts">
import { AtprotoLogin } from "vue-atproto-login"
</script>

<template>
  <header>
    <AtprotoLogin />
  </header>
</template>
```

That is the whole login: a skeleton while auth resolves, the signed-in handle and avatar
once it has, and a handle box with typeahead when it hasn't.

You also need to host a `client-metadata.json` at the URL you passed as `clientId` — in
atproto OAuth the client id *is* that document. See
[`client-metadata.example.json`](./client-metadata.example.json).

## The composable

```vue
<script setup lang="ts">
import { useAtprotoLogin } from "vue-atproto-login"

const { did, handle, avatar, isReady, isLoggedIn, signIn, signOut, getSession } =
  useAtprotoLogin()
</script>
```

| | |
|---|---|
| `did` | `null` until auth resolves, then `""` when signed out, else the DID |
| `handle` `displayName` `avatar` `pds` | whatever the profile resolver knows |
| `isReady` | false until the OAuth client answers — render a skeleton, not "Sign in" |
| `isLoggedIn` | |
| `prefillHandle` | writable; seeds the sign-in input |
| `signIn(handle)` | redirects the page to the user's PDS; on success it does not return |
| `signOut()` | revokes the grant at the PDS and clears the local identity |
| `refresh()` | re-resolve handle and avatar |
| `getSession()` | the live `OAuthSession` for writing to the user's repo |

The refs are module-level: the header and a save panel are looking at one session, not two.
`init()` runs exactly once per page load however many components call the composable.

### The tri-state

`did` is deliberately three-valued. `null` means "we have not asked yet" — render nothing
or a skeleton. Collapsing it to a boolean is what makes a header flash "Sign in" at someone
who is already signed in, on every reload.

### Writing to the PDS

Sign-in only matters because of what it lets you write. `getSession()` hands back the live
session; the package stops there, since the records are yours.

```ts
import { Agent } from "@atproto/api"

const session = await getSession()
if (session) {
  const agent = new Agent(session)
  await agent.com.atproto.repo.putRecord({ repo: session.did, collection: "…", rkey: "…", record })
}
```

## Options

```ts
configureAtprotoLogin({
  clientId: "https://my-app.example/client-metadata.json",

  // Dev. Default: a loopback client id built from window.location.origin, with
  // the scope appended — see "The dev scope trap" below.
  devClientId: "loopback",
  dev: import.meta.env.DEV,          // default: hostname is localhost / 127.0.0.1 / [::1]

  scope: "atproto transition:generic",
  handleResolver: "https://bsky.social",

  storage: localStorageSession(),     // or your own; every method may return a promise
  resolveProfile: bskyProfileResolver(),
  searchActors: bskySearchActors(),

  stripCallbackParams: true,          // false, or (url) => router.replace(...)
  autoSignInFromQuery: false,         // "handle" enables cross-app hand-off links
  onError: (error, context) => console.warn(context, error),
})
```

`atprotoLoginPlugin(options)` takes the same object, plus `registerComponents` (default
`false`) and `eager` (default `true` — start the client at `app.use()` time so no view
ever sees the callback params).

### The dev scope trap

`buildLoopbackClientId` only fills in `redirect_uri`. Its implied scope is a bare `atproto`,
which authorizes no repo writes at all — so `pnpm dev` can read fine and every `putRecord`
fails with an authorization error that reads like a bug in your own code. This library
appends `&scope=` to the loopback id by default. Two of the three apps it came from were
quietly missing it.

### Identity resolvers

| resolver | handle | avatar | pds | talks to |
|---|:-:|:-:|:-:|---|
| `bskyProfileResolver()` *(default)* | ✅ | ✅ | — | `public.api.bsky.app` |
| `slingshotProfileResolver()` | ✅ | — | ✅ | `slingshot.microcosm.blue` |
| `combineResolvers(slingshot, bsky)` | ✅ | ✅ | ✅ | both |

Both memoize per DID and never cache a failure. An app that is not a Bluesky client and
would rather not add one as a third party can use slingshot alone and go without the avatar.

### Storage

The `{ did, handle }` cache is a *hint*, so the UI can paint a handle before any network
call. The grant itself — tokens and DPoP key — lives in origin-scoped IndexedDB managed by
`BrowserOAuthClient`. Clearing this cache signs nobody out.

Every method may return a promise, so a PouchDB-backed store drops in:

```ts
const pouchStorage: SessionStorage = {
  load: () => data.get(SESSION_ID),
  save: (session) => data.update({ _id: SESSION_ID, ...session }),
  clear: () => data.remove(SESSION_ID),
}
```

### Callback params

`?code=&state=&iss=` are single-use and must not be bookmarked or replayed. By default they
are removed with `history.replaceState`. With a router that owns the URL, hand it over:

```ts
stripCallbackParams: (url) => router.replace({ path: url.pathname, query: {} })
```

### Cross-app hand-off

`autoSignInFromQuery: "handle"` reads `?handle=alice.bsky.social` on load, prefills the box,
strips the param so it is never bookmarked, and starts sign-in. It never fires for a visitor
who is already signed in.

## The component

```vue
<AtprotoLogin
  :with-sign-out="true"
  :with-avatar="true"
  :with-logo="true"
  :suggestions="true"
  :debounce="180"
  placeholder="alice.bsky.social"
  sign-in-label="Sign in with"
  @error="onError"
  @signed-out="onSignedOut"
/>
```

Slots: `loading`, `signed-in` (`{ did, handle, avatar, signOut }`), `suggestion`
(`{ suggestion, active }`).

### Styling

The built-in CSS is minimal and driven by custom properties:

```css
:root {
  --atp-accent: #1185fe;
  --atp-on-accent: white;
  --atp-border: #c9c9c9;
  --atp-surface: white;
  --atp-radius: 6px;
  --atp-input-width: 12rem;
  --atp-font-size: 0.85rem;
}
```

For a design system, swap the class hooks. Overriding a key also opts that element out of
the default CSS, which is scoped to the default names:

```vue
<AtprotoLogin
  :ui="{
    form: 'join',
    input: 'input input-sm join-item',
    button: 'btn btn-sm join-item',
    signedIn: 'flex items-center gap-4',
  }"
/>
```

`:unstyled="true"` blanks every hook at once. Skip the `style.css` import if you are not
using the defaults at all.

#### With Tailwind / daisyUI

The package depends on neither, and never emits a daisyUI class. An app that wants the full
daisyUI treatment skips `style.css` entirely and passes its own classes:

```vue
<AtprotoLogin
  unstyled
  :ui="{
    signedIn: 'flex items-center gap-4',
    avatar: 'w-6 rounded-full',
    handle: 'text-sm opacity-70',
    signOut: 'btn btn-ghost btn-xs',
    form: 'join',
    input: 'input input-sm join-item',
    button: 'btn btn-sm join-item',
    suggestions: 'menu dropdown-content bg-base-100 rounded-box shadow z-20 w-full',
    suggestion: 'flex items-center gap-2',
    suggestionActive: 'menu-active',
  }"
/>
```

No CSS from this package is loaded, so there is nothing to override and no specificity
fight. Three things worth knowing:

- Write the class names **literally in your own template**. Tailwind finds classes by
  scanning source files, and it does not scan `node_modules` by default — a string built at
  runtime, or one living only inside this package, produces no CSS.
- Attributes fall through to the right element. `<AtprotoLogin class="…">` lands on the
  wrapper; `<AtprotoHandleInput class="join-item" required>` lands on the `<input>` itself,
  even though that component renders the input and its listbox as siblings.
- `<style scoped>` in your component reaches both. Around `<AtprotoLogin>` it needs
  `:deep(.your-class)`, since the scope attribute lands on the wrapper; around
  `<AtprotoHandleInput>` the input, listbox and rows carry it directly, so plain
  `.your-class` matches. Either way, name the elements through `:ui` and style those names.

Mixing is fine too: keep `style.css` and override only the hooks you care about. An
overridden hook loses its default rule (they are scoped to the default names), while
untouched elements keep theirs.

`<AtprotoHandleInput>` is the typeahead on its own, for handle pickers that are not sign-in
(a "whose notes do you want to read?" box, say).

## Migrating the three apps it came from

<details>
<summary><b>remanso.space</b> — PouchDB cache, slingshot + appview identity, daisyUI</summary>

```ts
configureAtprotoLogin({
  clientId: "https://remanso.space/client-metadata.json",
  dev: import.meta.env.DEV,
  storage: {
    load: () => loadSession(),
    save: ({ did, handle }) => saveSession(did, handle),
    clear: () => clearSession(),
  },
  resolveProfile: combineResolvers(slingshotProfileResolver(), bskyProfileResolver()),
})
```

Then `useATProtoLogin()` → `useAtprotoLogin()` (note `isATProtoReady` → `isReady`), and
`SignInAtproto.vue` → `<AtprotoLogin :ui="{ …daisyUI classes… }" />`. `searchActors.ts`,
`atprotoOAuth.ts` and `atprotoSession.ts` all go; keep `getAuthor.ts` if other code uses it.

**Behaviour change:** dev sign-ins now carry `transition:generic`, so `putRecord` works
against `pnpm dev`.
</details>

<details>
<summary><b>remanso.at</b> — localStorage, appview identity, vue-router, ?handle= hand-off</summary>

```ts
configureAtprotoLogin({
  clientId: "https://remanso.at/client-metadata.json",
  dev: import.meta.env.DEV,
  autoSignInFromQuery: "handle",
  stripCallbackParams: (url) => router.replace({ path: url.pathname, query: {} }),
})
```

Everything else is the default. `SignIn.vue` becomes `<AtprotoLogin :suggestions="false" />`
if you want to keep the plain box — or drop the prop and gain the typeahead.
</details>

<details>
<summary><b>stt.apoena.dev</b> — localStorage, slingshot identity, no router</summary>

```ts
configureAtprotoLogin({
  clientId: "https://stt.apoena.dev/client-metadata.json",
  dev: import.meta.env.DEV,
  resolveProfile: slingshotProfileResolver(),
})
```

The scope-appending loopback id this app worked out is now the default, so `getClientId`'s
comment can retire with it.
</details>

In all three, `getActiveSession(did)` keeps working — import it from `vue-atproto-login`
instead of the local `atprotoOAuth.ts`.

## Notes

- **ESM only.** No UMD or CommonJS build. Every consumer of a browser OAuth client for
  Vue 3 goes through a bundler, so a `require()` entry would be dead weight in the tarball.
- One config per origin. There is one signed-in user per origin, and the OAuth client's
  storage is origin-scoped: two configs in one page would be two clients fighting over the
  same IndexedDB.
- `client_id` *is* the metadata URL, so two origins are two clients — separate consent,
  refresh token and DPoP keypair. Signing in on one does not sign you in on the other, and
  cannot.
- A grant that dies while the tab is open (revoked elsewhere, refresh expired) clears the
  cached identity live, through the SDK's `onSessionDeleted`. None of the three apps did
  this; they only noticed on the next reload.
- Peer range `@atproto/oauth-client-browser` `>=0.3.40 <0.6`. The revocation hook is wired
  both ways — the load-time callback on 0.4+, the `deleted` event on 0.3.

## Development

```bash
pnpm install
pnpm test        # vitest
pnpm types       # vue-tsc
pnpm build       # vite lib build + d.ts
pnpm verify      # all three, the same gate CI and the release run
pnpm example     # playground at http://localhost:5180
```

## Releasing

One command:

```bash
pnpm release            # patch
pnpm release minor      # or major, or an explicit 1.0.0-rc.1
```

It refuses to start unless you are on `main`, the tree is clean, you are level with
`origin/main`, and `gh` is authenticated — each of those otherwise produces a release that
looks fine and is wrong. Then it runs `pnpm verify`, bumps, commits, tags `vX.Y.Z`, pushes
to every mirror, makes sure the publish workflow is running, and waits for it, ending on
the npm URL or the failing log.

The publish itself happens in CI, never on your machine. `.github/workflows/publish.yml`
re-runs the full verification, checks the tag against `package.json`, and publishes.

> Tag pushes on this repository do not currently start workflow runs — GitHub records the
> PushEvent and spawns nothing, while `workflow_dispatch` works. The release script handles
> this: it waits for a tag-triggered run, and dispatches one only if none appeared. If push
> triggers start working again it will notice, and will not publish twice.

There is **no npm token** in the repository or in GitHub secrets. Publishing uses
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/): GitHub hands the
workflow a short-lived OIDC token, npm swaps it for a one-shot publish credential, and the
package gets a provenance attestation showing which commit and workflow built it. That is
why the workflow asks for `id-token: write`, and why nothing needs rotating.

### One-time setup

Trusted publishing is configured per package on npmjs.com, and that page only exists once
the package does. So the first release is manual:

```bash
npm login
pnpm verify
npm publish --access public    # 0.1.0, no provenance — there is no CI to attest to it
```

Then at `https://www.npmjs.com/package/vue-atproto-login/access`, add a trusted publisher:

| field | value |
|---|---|
| Provider | GitHub Actions |
| Organization / user | `jcalixte` |
| Repository | `vue-atproto-login` |
| Workflow filename | `publish.yml` |
| Environment | *(leave empty)* |

Every release after that is just `pnpm version patch`.

Two things that will bite if changed carelessly: renaming `publish.yml` breaks the trust
relationship until the npm setting is updated to match, and a tag that disagrees with
`package.json` is rejected by the workflow rather than published (npm has no undo past
72 hours).

### Why not release-it / semantic-release / changesets

They all fit, and any of them would work. They are also built for problems this repository
does not have: `changesets` coordinates versions across a monorepo and collects
contributor-written notes; `semantic-release` derives versions from commit history for
teams who want releases to need no decision; `release-it` is the closest fit and mostly
wraps the same six git commands.

What is actually specific here — the broken push trigger, three push mirrors, publishing
through OIDC rather than a token — is the part none of them handle out of the box, and
would need config and hooks anyway. So `scripts/release.mjs` is ~100 lines of plain Node
with no dependencies, and it does exactly this repository's release. Reach for one of the
packages when there are several packages to version together, or several people writing
changelog entries.

## Where this lives

- [github.com/jcalixte/vue-atproto-login](https://github.com/jcalixte/vue-atproto-login) — issues, CI, releases
- [tangled.org/apoena.dev/vue-atproto-login](https://tangled.org/apoena.dev/vue-atproto-login) — mirror, on atproto, which feels right for this one
- [git.apoena.dev/julien/vue-atproto-login](https://git.apoena.dev/julien/vue-atproto-login) — mirror

## License

MIT
