<script lang="ts">
// Ids are document-global, so two boxes on one page — a header and a modal, say —
// would otherwise both answer to `atp-handle-suggestions`, and aria-activedescendant
// on one would resolve into the other one's list. Module scope, not setup scope:
// `<script setup>` runs once per instance and would hand every box the same number.
// Browser-only component, so a counter is enough — there is no server render to
// agree with.
let boxes = 0
</script>

<script setup lang="ts">
import { getCurrentInstance, onUnmounted, ref } from "vue"

import { getOptions, isConfigured } from "../config"
import type { ActorSearch, ActorSuggestion } from "../types"
import { type AtprotoLoginUi, resolveUi } from "./ui"

/**
 * A handle box with a typeahead over the public appview.
 *
 * Typing your own handle from memory is fine, but there is no way to discover
 * the exact spelling of one you half-remember. The list is a shortcut, never a
 * gate: a free-typed handle the appview has never indexed still submits.
 */

// The suggestion list is a sibling of the input, so this renders a fragment and
// Vue cannot pick a root to inherit attributes onto — it drops them with a
// warning instead. Attributes belong on the input, so route them there by hand:
// `<AtprotoHandleInput class="join-item" required>` then behaves as written.
defineOptions({ inheritAttrs: false })

// Vue applies a parent's scoped-style attribute to a child's *root element*, and
// a fragment has none — so `<style scoped>` around an <AtprotoHandleInput> styles
// nothing at all, while the same rules reach the whole tree through <AtprotoLogin>
// (single root div). The attribute never passes through $attrs; it lives on our
// own vnode. Apply it by hand so both components style the same way.
const hostScopeId = getCurrentInstance()?.vnode.scopeId
const scopeAttrs = hostScopeId ? { [hostScopeId]: "" } : {}

const uid = ++boxes
const listboxId = `atp-handle-suggestions-${uid}`
const optionId = (index: number) => `atp-suggestion-${uid}-${index}`

const props = withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    disabled?: boolean
    /** Turn the typeahead off and behave as a plain text field. */
    suggestions?: boolean
    /** Overrides the configured search, e.g. to point at another appview. */
    search?: ActorSearch
    limit?: number
    debounce?: number
    ui?: AtprotoLoginUi
    unstyled?: boolean
    ariaLabel?: string
  }>(),
  {
    modelValue: "",
    placeholder: "alice.bsky.social",
    disabled: false,
    suggestions: true,
    limit: 8,
    debounce: 180,
    unstyled: false,
    ariaLabel: "Bluesky or atproto handle",
  },
)

const emit = defineEmits<{
  "update:modelValue": [value: string]
  submit: [handle: string]
}>()

defineSlots<{
  suggestion?: (props: { suggestion: ActorSuggestion; active: boolean }) => unknown
}>()

const classes = () => resolveUi(props.ui, props.unstyled)

const found = ref<ActorSuggestion[]>([])
const open = ref(false)
const activeIndex = ref(-1)

let timer: ReturnType<typeof setTimeout> | undefined
let abort: AbortController | undefined

const searchFn = (): ActorSearch | null =>
  props.search ?? (isConfigured() ? getOptions().searchActors : null)

const run = async (query: string) => {
  const search = searchFn()
  if (!search) return

  abort?.abort()
  const controller = new AbortController()
  abort = controller

  const results = await search(query, { limit: props.limit, signal: controller.signal })
  if (controller.signal.aborted) return
  found.value = results
  open.value = results.length > 0
  activeIndex.value = -1
}

const close = () => {
  open.value = false
  activeIndex.value = -1
}

const onInput = (event: Event) => {
  const value = (event.target as HTMLInputElement).value
  emit("update:modelValue", value)
  if (!props.suggestions) return

  const query = value.trim()
  clearTimeout(timer)

  if (!query) {
    abort?.abort()
    found.value = []
    close()
    return
  }
  timer = setTimeout(() => void run(query), props.debounce)
}

const submit = (value: string) => {
  const target = value.trim().replace(/^@/, "")
  if (!target || props.disabled) return
  clearTimeout(timer)
  abort?.abort()
  close()
  emit("submit", target)
}

const pick = (suggestion: ActorSuggestion) => {
  emit("update:modelValue", suggestion.handle)
  submit(suggestion.handle)
}

// Enter with a row highlighted takes that row; with none it takes what is typed,
// so a handle the appview has never indexed is still reachable.
const onSubmit = () => {
  const highlighted = open.value ? found.value[activeIndex.value] : undefined
  if (highlighted) {
    pick(highlighted)
    return
  }
  submit(props.modelValue)
}

// Arrows cycle through the rows and back out to "nothing highlighted", so
// holding ArrowUp returns you to what you typed instead of trapping you in the
// list. Slot 0 is that no-selection state, slots 1..n are the rows.
const moveActive = (step: number) => {
  if (!found.value.length) return
  if (!open.value) {
    open.value = true
    return
  }
  const slots = found.value.length + 1
  activeIndex.value = ((activeIndex.value + 1 + step + slots) % slots) - 1
}

onUnmounted(() => {
  clearTimeout(timer)
  abort?.abort()
})

defineExpose({ submit: onSubmit, close })
</script>

<template>
  <input
    v-bind="{ ...scopeAttrs, ...$attrs }"
    :value="modelValue"
    :class="classes().input"
    type="text"
    role="combobox"
    :aria-label="ariaLabel"
    aria-autocomplete="list"
    :aria-controls="listboxId"
    :aria-expanded="open"
    :aria-activedescendant="activeIndex >= 0 ? optionId(activeIndex) : undefined"
    autocapitalize="none"
    autocorrect="off"
    autocomplete="off"
    spellcheck="false"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="onInput"
    @keydown.enter.prevent="onSubmit"
    @keydown.down.prevent="moveActive(1)"
    @keydown.up.prevent="moveActive(-1)"
    @keydown.esc.prevent="close"
    @blur="close"
  />

  <ul
    v-if="open"
    v-bind="scopeAttrs"
    :id="listboxId"
    :class="classes().suggestions"
    role="listbox"
    aria-label="Matching handles"
  >
    <li
      v-for="(suggestion, index) in found"
      v-bind="scopeAttrs"
      :id="optionId(index)"
      :key="suggestion.did"
      :class="[classes().suggestion, index === activeIndex && classes().suggestionActive]"
      role="option"
      :aria-selected="index === activeIndex"
      @mousedown.prevent="pick(suggestion)"
      @mouseenter="activeIndex = index"
    >
      <slot name="suggestion" :suggestion="suggestion" :active="index === activeIndex">
        <img
          v-if="suggestion.avatar"
          :class="classes().suggestionAvatar"
          :src="suggestion.avatar"
          alt=""
          loading="lazy"
        />
        <span
          v-else
          :class="[classes().suggestionAvatar, classes().suggestionAvatarPlaceholder]"
          aria-hidden="true"
        />
        <span :class="classes().suggestionText">
          <span :class="classes().suggestionHandle">{{ suggestion.handle }}</span>
          <span v-if="suggestion.displayName" :class="classes().suggestionName">
            {{ suggestion.displayName }}
          </span>
        </span>
      </slot>
    </li>
  </ul>
</template>

<style scoped>
.atp-input {
  font: inherit;
  font-size: var(--atp-font-size, 0.85rem);
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--atp-border, currentColor);
  border-right: 0;
  border-radius: var(--atp-radius, 4px) 0 0 var(--atp-radius, 4px);
  background: var(--atp-surface, transparent);
  color: inherit;
  width: var(--atp-input-width, 12rem);
  max-width: 40vw;
}

.atp-input:focus {
  outline: none;
  border-color: var(--atp-accent, #1185fe);
}

.atp-suggestions {
  position: absolute;
  z-index: 20;
  top: calc(100% + 0.3rem);
  left: 0;
  right: 0;
  list-style: none;
  margin: 0;
  padding: 0.25rem;
  max-height: 17rem;
  overflow-y: auto;
  border: 1px solid var(--atp-border, currentColor);
  border-radius: var(--atp-radius, 4px);
  background: var(--atp-surface, canvas);
  box-shadow: 0 8px 24px rgb(0 0 0 / 18%);
}

.atp-suggestion {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.5rem;
  border-radius: calc(var(--atp-radius, 4px) - 1px);
  cursor: pointer;
}

.atp-suggestion-active {
  background: var(--atp-accent, #1185fe);
  color: var(--atp-on-accent, white);
}

.atp-suggestion-avatar {
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}

.atp-suggestion-avatar.atp-placeholder {
  background: currentColor;
  opacity: 0.15;
}

.atp-suggestion-text {
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.atp-suggestion-handle,
.atp-suggestion-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atp-suggestion-handle {
  font-size: 0.9rem;
}

.atp-suggestion-name {
  font-size: 0.8rem;
  opacity: 0.7;
}
</style>
