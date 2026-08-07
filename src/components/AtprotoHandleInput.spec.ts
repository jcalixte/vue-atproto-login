import { flushPromises, mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@atproto/oauth-client-browser", () => ({
  BrowserOAuthClient: {
    load: async () => ({
      signInRedirect: vi.fn(),
      init: async () => undefined,
      revoke: vi.fn(),
      restore: vi.fn(),
      addEventListener: vi.fn(),
    }),
  },
  buildLoopbackClientId: () => "http://localhost",
}))

import { resetOAuthClient } from "../client"
import { configureAtprotoLogin, resetAtprotoLogin } from "../config"
import { memoryStorageSession } from "../storage"
import { resetAtprotoLoginState } from "../useAtprotoLogin"
import AtprotoHandleInput from "./AtprotoHandleInput.vue"
import ScopedHost from "./__fixtures__/ScopedHost.vue"

const search = async () => [
  { did: "did:plc:bob", handle: "bob.bsky.social", displayName: "Bob" },
]

// The typeahead debounces before it searches. These mounts pass `debounce: 0`, so
// waiting one macrotask is enough — no fake clock, which Vue's event-timestamp
// guard does not survive.
const typeAndDebounce = async (wrapper: ReturnType<typeof mount>, value: string) => {
  await wrapper.find("input").setValue(value)
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

const attrNames = (element: { attributes(): Record<string, string> }) =>
  Object.keys(element.attributes())

const scopeAttrOf = (element: { attributes(): Record<string, string> }) => {
  const scopeId = attrNames(element).find((name) => name.startsWith("data-v-"))
  expect(scopeId, "the fixture must be compiled with <style scoped>").toBeDefined()
  return scopeId
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAtprotoLogin()
  resetAtprotoLoginState()
  resetOAuthClient()
  configureAtprotoLogin({
    clientId: "https://example.com/client-metadata.json",
    dev: false,
    storage: memoryStorageSession(),
    resolveProfile: async (did) => ({ did, handle: "alice.bsky.social" }),
    searchActors: search,
  })
})

describe("<AtprotoHandleInput>", () => {
  it("gives each box its own listbox and option ids", async () => {
    // A page with a header box and a modal box shares one document. Reusing the
    // ids there points one combobox's aria-activedescendant into the other's list.
    const first = mount(AtprotoHandleInput, { props: { debounce: 0 } })
    const second = mount(AtprotoHandleInput, { props: { debounce: 0 } })
    await typeAndDebounce(first, "bo")
    await typeAndDebounce(second, "bo")

    const listboxId = (wrapper: ReturnType<typeof mount>) =>
      wrapper.find('[role="listbox"]').attributes("id")
    const optionId = (wrapper: ReturnType<typeof mount>) =>
      wrapper.find('[role="option"]').attributes("id")

    expect(listboxId(first)).not.toBe(listboxId(second))
    expect(optionId(first)).not.toBe(optionId(second))

    // Still wired to its own list, whatever the id turned out to be.
    expect(first.find("input").attributes("aria-controls")).toBe(listboxId(first))
  })

  it("points aria-activedescendant at the highlighted row of its own list", async () => {
    const wrapper = mount(AtprotoHandleInput, { props: { debounce: 0 } })
    await typeAndDebounce(wrapper, "bo")
    await wrapper.find("input").trigger("keydown.down")

    expect(wrapper.find("input").attributes("aria-activedescendant")).toBe(
      wrapper.find('[role="option"]').attributes("id"),
    )
  })

  it("carries the consumer's scoped-style attribute onto its own listbox", async () => {
    // Fragment root: Vue writes a parent's scope attribute onto a child's *root
    // element*, and there is none here — so without help a consumer's `<style
    // scoped>` reaches nothing at all, not even through `:deep()`.
    const wrapper = mount(ScopedHost, { attachTo: document.body })
    await flushPromises()
    const host = scopeAttrOf(wrapper.find(".host"))

    // The fixture renders <AtprotoLogin> first, so the trailing input is the
    // stand-alone box and its listbox is the trailing one.
    await wrapper.findAll("input")[1].setValue("bo")
    await new Promise((resolve) => setTimeout(resolve, 0))
    await flushPromises()

    expect(attrNames(wrapper.findAll("input")[1])).toContain(host)
    expect(attrNames(wrapper.findAll('[role="listbox"]').at(-1)!)).toContain(host)
    expect(attrNames(wrapper.findAll('[role="option"]').at(-1)!)).toContain(host)

    wrapper.unmount()
  })

  it("stays reachable from the consumer when nested in <AtprotoLogin>", async () => {
    // That component has a single root div, so Vue puts the host's attribute there
    // and `:deep(.atp-suggestions)` from the app matches the whole subtree. Pinned
    // here because the fragment-root fix above must not be what holds it up.
    const wrapper = mount(ScopedHost, { attachTo: document.body })
    await flushPromises()

    expect(attrNames(wrapper.find(".atp-root"))).toContain(scopeAttrOf(wrapper.find(".host")))

    wrapper.unmount()
  })

  it("still routes attributes to the input, scope attribute or not", () => {
    const wrapper = mount(AtprotoHandleInput, { attrs: { class: "join-item", required: true } })
    expect(wrapper.find("input").classes()).toContain("join-item")
    expect(wrapper.find("input").attributes("required")).toBeDefined()
  })
})
