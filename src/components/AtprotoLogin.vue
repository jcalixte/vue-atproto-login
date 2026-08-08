<script setup lang="ts">
import { ref, watch } from "vue"

import type { ActorSuggestion } from "../types"
import { useAtprotoLogin } from "../useAtprotoLogin"
import AtprotoHandleInput from "./AtprotoHandleInput.vue"
import BlueskyLogo from "./BlueskyLogo.vue"
import { type AtprotoLoginUi, resolveUi } from "./ui"

const props = withDefaults(
  defineProps<{
    withSignOut?: boolean
    withAvatar?: boolean
    withLogo?: boolean
    /** Turn the typeahead off and behave as a plain text field. */
    suggestions?: boolean
    /** Keystroke-to-search delay, in ms. */
    debounce?: number
    placeholder?: string
    signInLabel?: string
    redirectingLabel?: string
    signOutLabel?: string
    ui?: AtprotoLoginUi
    unstyled?: boolean
  }>(),
  {
    withSignOut: true,
    withAvatar: true,
    withLogo: true,
    suggestions: true,
    debounce: 180,
    placeholder: "alice.bsky.social",
    signInLabel: "Sign in with",
    redirectingLabel: "Redirecting…",
    signOutLabel: "Sign out",
    unstyled: false,
  },
)

const emit = defineEmits<{
  error: [error: unknown]
  redirecting: []
  signedOut: []
}>()

defineSlots<{
  loading?: () => unknown
  "signed-in"?: (props: {
    did: string | null
    handle: string | null
    avatar: string | null
    signOut: () => Promise<void>
  }) => unknown
  suggestion?: (props: { suggestion: ActorSuggestion; active: boolean }) => unknown
}>()

const { did, handle, avatar, prefillHandle, isReady, isLoggedIn, signIn, signOut } =
  useAtprotoLogin()

const classes = () => resolveUi(props.ui, props.unstyled)

const inputHandle = ref("")

// Set once the browser is on its way to the PDS. The redirect replaces the page,
// so this only resets if signIn rejects before it can navigate.
const redirecting = ref(false)

// A cross-app link may set the prefill after this component has mounted.
watch(
  prefillHandle,
  (value) => {
    if (value) inputHandle.value = value
  },
  { immediate: true },
)

const onSubmit = async (target: string) => {
  if (redirecting.value) return
  redirecting.value = true
  emit("redirecting")
  try {
    await signIn(target)
  } catch (error) {
    // Never made it to the PDS — let the user try again.
    redirecting.value = false
    emit("error", error)
  }
}

const onSignOut = async () => {
  try {
    await signOut()
    emit("signedOut")
  } catch (error) {
    emit("error", error)
  }
}
</script>

<template>
  <div :class="classes().root">
    <slot v-if="!isReady" name="loading">
      <span :class="classes().loading" aria-busy="true">…</span>
    </slot>

    <slot
      v-else-if="isLoggedIn"
      name="signed-in"
      :did="did"
      :handle="handle"
      :avatar="avatar"
      :sign-out="onSignOut"
    >
      <div :class="classes().signedIn">
        <img
          v-if="withAvatar && avatar"
          :class="classes().avatar"
          :src="avatar"
          alt=""
          width="24"
          height="24"
        />
        <span :class="classes().handle">{{ handle }}</span>
        <button v-if="withSignOut" type="button" :class="classes().signOut" @click="onSignOut">
          {{ signOutLabel }}
        </button>
      </div>
    </slot>

    <div v-else :class="classes().form">
      <AtprotoHandleInput
        ref="input"
        v-model="inputHandle"
        :placeholder="placeholder"
        :disabled="redirecting"
        :suggestions="suggestions"
        :debounce="debounce"
        :ui="ui"
        :unstyled="unstyled"
        @submit="onSubmit"
      >
        <template v-if="$slots.suggestion" #suggestion="slotProps">
          <slot name="suggestion" v-bind="slotProps" />
        </template>
      </AtprotoHandleInput>

      <button
        type="button"
        :class="classes().button"
        :disabled="redirecting"
        @click="onSubmit(inputHandle)"
      >
        <template v-if="redirecting">{{ redirectingLabel }}</template>
        <template v-else>
          {{ signInLabel }}
          <BlueskyLogo v-if="withLogo" />
        </template>
      </button>
    </div>
  </div>
</template>

<style scoped>
.atp-root {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.atp-loading {
  opacity: 0.6;
  font-size: 0.9rem;
}

.atp-signed-in {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.atp-avatar {
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.atp-handle {
  font-size: 0.85rem;
  max-width: 16ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atp-sign-out {
  font: inherit;
  font-size: 0.85rem;
  opacity: 0.7;
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0;
}

.atp-sign-out:hover {
  opacity: 1;
  color: var(--atp-accent, #1185fe);
}

.atp-form {
  position: relative;
  display: flex;
  align-items: stretch;
}

.atp-button {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font: inherit;
  font-weight: 600;
  font-size: var(--atp-font-size, 0.85rem);
  padding: 0.3rem 0.8rem;
  border: 1px solid var(--atp-border, currentColor);
  border-radius: 0 var(--atp-radius, 4px) var(--atp-radius, 4px) 0;
  background: var(--atp-accent, #1185fe);
  color: var(--atp-on-accent, white);
  cursor: pointer;
  white-space: nowrap;
}

.atp-button:disabled {
  cursor: progress;
  opacity: 0.7;
}
</style>
