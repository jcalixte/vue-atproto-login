<script setup lang="ts">
import { ref } from "vue"

import { AtprotoLogin, useAtprotoLogin } from "../../src"

const { did, handle, avatar, pds, isReady, isLoggedIn, getSession, refresh } = useAtprotoLogin()

const lastError = ref("")
const sessionProbe = ref("")

const probeSession = async () => {
  sessionProbe.value = "…"
  const session = await getSession()
  sessionProbe.value = session
    ? `live OAuthSession for ${session.did} — ready for new Agent(session)`
    : "no live session (the grant is gone)"
}
</script>

<template>
  <main>
    <header>
      <h1>vue-atproto-login</h1>
      <AtprotoLogin @error="lastError = String($event)" />
    </header>

    <p v-if="lastError" class="error">{{ lastError }}</p>

    <section>
      <h2>State</h2>
      <dl>
        <dt>isReady</dt>
        <dd>{{ isReady }}</dd>
        <dt>isLoggedIn</dt>
        <dd>{{ isLoggedIn }}</dd>
        <dt>did</dt>
        <dd>{{ did || "—" }}</dd>
        <dt>handle</dt>
        <dd>{{ handle || "—" }}</dd>
        <dt>avatar</dt>
        <dd>{{ avatar || "—" }}</dd>
        <dt>pds</dt>
        <dd>{{ pds || "— (the bsky resolver does not report one)" }}</dd>
      </dl>
      <button v-if="isLoggedIn" type="button" @click="refresh">Re-resolve profile</button>
      <button v-if="isLoggedIn" type="button" @click="probeSession">Get a live session</button>
      <p v-if="sessionProbe" class="probe">{{ sessionProbe }}</p>
    </section>

    <section>
      <h2>Plain, no suggestions</h2>
      <AtprotoLogin :suggestions="false" :with-logo="false" sign-in-label="Sign in" />
    </section>

    <section>
      <h2>Own the signed-in markup</h2>
      <AtprotoLogin>
        <template #signed-in="{ handle: who, avatar: face, signOut }">
          <span class="pill">
            <img v-if="face" :src="face" alt="" width="24" height="24" />
            {{ who }}
            <button type="button" @click="signOut">×</button>
          </span>
        </template>
      </AtprotoLogin>
    </section>

    <section>
      <h2>Restyled through <code>ui</code></h2>
      <AtprotoLogin :ui="{ input: 'custom-input', button: 'custom-button' }" />
    </section>
  </main>
</template>

<style>
:root {
  font-family: system-ui, sans-serif;
  --atp-radius: 6px;
  --atp-border: #c9c9c9;
  --atp-surface: white;
}

body {
  margin: 0;
  background: #fafafa;
  color: #1a1a1a;
}

main {
  max-width: 46rem;
  margin: 0 auto;
  padding: 2rem 1.5rem 6rem;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  border-bottom: 1px solid #e4e4e4;
  padding-bottom: 1rem;
}

h1 {
  font-size: 1.1rem;
  margin: 0;
}

h2 {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.55;
  margin: 2.5rem 0 0.75rem;
}

dl {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: 0.25rem 1rem;
  margin: 0 0 1rem;
  font-size: 0.9rem;
}

dt {
  opacity: 0.6;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}

button {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid #c9c9c9;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.error {
  color: #b3261e;
  font-size: 0.9rem;
}

.probe {
  font-size: 0.85rem;
  opacity: 0.7;
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.6rem 0.25rem 0.25rem;
  border: 1px solid #c9c9c9;
  border-radius: 999px;
  font-size: 0.9rem;
}

.pill img {
  border-radius: 50%;
}

.pill button {
  border: 0;
  padding: 0 0.2rem;
  background: transparent;
}

.custom-input {
  font: inherit;
  padding: 0.45rem 0.7rem;
  border: 2px solid #1185fe;
  border-right: 0;
  border-radius: 999px 0 0 999px;
}

.custom-button {
  font: inherit;
  padding: 0.45rem 1rem;
  border: 2px solid #1185fe;
  border-radius: 0 999px 999px 0;
  background: #1185fe;
  color: white;
  cursor: pointer;
}
</style>
