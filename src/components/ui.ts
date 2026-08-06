/**
 * Class hooks for every element the components render.
 *
 * The built-in styles are scoped to these default names, so overriding a key
 * both restyles the element *and* opts it out of the default CSS — which is what
 * a daisyUI or Tailwind app wants:
 *
 * ```vue
 * <AtprotoLogin :ui="{ input: 'input input-sm join-item', button: 'btn btn-sm join-item' }" />
 * ```
 *
 * `unstyled` blanks every key at once.
 */
export interface AtprotoLoginUi {
  root?: string
  loading?: string
  signedIn?: string
  avatar?: string
  handle?: string
  signOut?: string
  form?: string
  input?: string
  button?: string
  suggestions?: string
  suggestion?: string
  suggestionActive?: string
  suggestionAvatar?: string
  /** Modifier on the avatar slot when the actor has no avatar. */
  suggestionAvatarPlaceholder?: string
  suggestionText?: string
  suggestionHandle?: string
  suggestionName?: string
}

export const DEFAULT_UI: Required<AtprotoLoginUi> = {
  root: "atp-root",
  loading: "atp-loading",
  signedIn: "atp-signed-in",
  avatar: "atp-avatar",
  handle: "atp-handle",
  signOut: "atp-sign-out",
  form: "atp-form",
  input: "atp-input",
  button: "atp-button",
  suggestions: "atp-suggestions",
  suggestion: "atp-suggestion",
  suggestionActive: "atp-suggestion-active",
  suggestionAvatar: "atp-suggestion-avatar",
  suggestionAvatarPlaceholder: "atp-placeholder",
  suggestionText: "atp-suggestion-text",
  suggestionHandle: "atp-suggestion-handle",
  suggestionName: "atp-suggestion-name",
}

const BLANK_UI = Object.fromEntries(
  Object.keys(DEFAULT_UI).map((key) => [key, ""]),
) as Required<AtprotoLoginUi>

export const resolveUi = (
  overrides: AtprotoLoginUi | undefined,
  unstyled: boolean,
): Required<AtprotoLoginUi> => ({
  ...(unstyled ? BLANK_UI : DEFAULT_UI),
  ...overrides,
})
