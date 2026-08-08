import { flushPromises, mount } from "@vue/test-utils"
import { beforeEach, describe, expect, it, vi } from "vitest"

const signInRedirect = vi.fn()
const init = vi.fn()
const revoke = vi.fn()

vi.mock("@atproto/oauth-client-browser", () => ({
  BrowserOAuthClient: {
    load: async () => ({
      signInRedirect,
      init,
      revoke,
      restore: vi.fn(),
      addEventListener: vi.fn(),
    }),
  },
  buildLoopbackClientId: () => "http://localhost",
}))

import { resetOAuthClient } from "../client"
import { configureAtprotoLogin, resetAtprotoLogin } from "../config"
import { memoryStorageSession } from "../storage"
import type { AtprotoLoginOptions } from "../types"
import { resetAtprotoLoginState } from "../useAtprotoLogin"
import AtprotoLogin from "./AtprotoLogin.vue"

const setup = (overrides: Partial<AtprotoLoginOptions> = {}) =>
  configureAtprotoLogin({
    clientId: "https://example.com/client-metadata.json",
    dev: false,
    storage: memoryStorageSession(),
    resolveProfile: async (did) => ({ did, handle: "alice.bsky.social", avatar: "a.png" }),
    searchActors: async () => [
      { did: "did:plc:bob", handle: "bob.bsky.social", displayName: "Bob" },
    ],
    ...overrides,
  })

// The typeahead debounces before it searches. These mounts pass `debounce: 0`, so
// waiting one macrotask is enough — no fake clock, which Vue's event-timestamp
// guard does not survive.
const typeAndDebounce = async (wrapper: ReturnType<typeof mount>, value: string) => {
  await wrapper.find("input").setValue(value)
  await new Promise((resolve) => setTimeout(resolve, 0))
  await flushPromises()
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAtprotoLogin()
  resetAtprotoLoginState()
  resetOAuthClient()
  init.mockResolvedValue(undefined)
  window.history.replaceState(null, "", "/")
})

describe("<AtprotoLogin>", () => {
  it("shows a placeholder while auth is unresolved, not a sign-in box", () => {
    setup()
    init.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(AtprotoLogin)
    expect(wrapper.find("input").exists()).toBe(false)
    expect(wrapper.find(".atp-loading").exists()).toBe(true)
  })

  it("shows the sign-in box once resolved and signed out", async () => {
    setup()
    const wrapper = mount(AtprotoLogin)
    await flushPromises()
    expect(wrapper.find("input").exists()).toBe(true)
  })

  it("signs in with the typed handle", async () => {
    setup()
    const wrapper = mount(AtprotoLogin)
    await flushPromises()

    await wrapper.find("input").setValue("alice.bsky.social")
    await wrapper.find("button").trigger("click")

    expect(signInRedirect).toHaveBeenCalledWith("alice.bsky.social", undefined)
    expect(wrapper.text()).toContain("Redirecting…")
  })

  it("re-enables the button when the redirect never happens", async () => {
    setup()
    signInRedirect.mockRejectedValueOnce(new Error("bad handle"))
    const wrapper = mount(AtprotoLogin)
    await flushPromises()

    await wrapper.find("input").setValue("nope")
    await wrapper.find("button").trigger("click")
    await flushPromises()

    expect(wrapper.emitted("error")).toHaveLength(1)
    expect(wrapper.find("button").attributes("disabled")).toBeUndefined()
  })

  it("shows the handle, avatar and sign-out once signed in", async () => {
    setup()
    init.mockResolvedValue({ session: { did: "did:plc:alice" } })
    const wrapper = mount(AtprotoLogin)
    await flushPromises()

    expect(wrapper.text()).toContain("alice.bsky.social")
    expect(wrapper.find("img").attributes("src")).toBe("a.png")
    expect(wrapper.find(".atp-sign-out").exists()).toBe(true)
  })

  it("hides sign-out when asked", async () => {
    setup()
    init.mockResolvedValue({ session: { did: "did:plc:alice" } })
    const wrapper = mount(AtprotoLogin, { props: { withSignOut: false } })
    await flushPromises()
    expect(wrapper.find(".atp-sign-out").exists()).toBe(false)
  })

  it("lets the app own the signed-in markup through a slot", async () => {
    setup()
    init.mockResolvedValue({ session: { did: "did:plc:alice" } })
    const wrapper = mount(AtprotoLogin, {
      slots: { "signed-in": `<template #signed-in="{ handle }">hi {{ handle }}</template>` },
    })
    await flushPromises()
    expect(wrapper.text()).toBe("hi alice.bsky.social")
  })

  it("swaps class hooks for a design system", async () => {
    setup()
    const wrapper = mount(AtprotoLogin, {
      props: { ui: { input: "input input-sm join-item", button: "btn btn-sm join-item" } },
    })
    await flushPromises()
    expect(wrapper.find("input").classes()).toContain("join-item")
    expect(wrapper.find("input").classes()).not.toContain("atp-input")
    expect(wrapper.find("button").classes()).toContain("btn")
  })

  it("drops the default class when a hook is overridden, so daisyUI does not fight it", async () => {
    setup()
    init.mockResolvedValue({ session: { did: "did:plc:alice" } })
    const wrapper = mount(AtprotoLogin, {
      props: { ui: { signedIn: "flex items-center gap-4", handle: "badge badge-ghost" } },
    })
    await flushPromises()

    expect(wrapper.find(".badge").classes()).toEqual(["badge", "badge-ghost"])
    expect(wrapper.find(".atp-handle").exists()).toBe(false)
    expect(wrapper.find(".atp-sign-out").exists()).toBe(true)
  })

  it("blanks every hook under unstyled, including the suggestion internals", async () => {
    setup()
    const wrapper = mount(AtprotoLogin, { props: { unstyled: true, debounce: 0 } })
    await flushPromises()

    await typeAndDebounce(wrapper, "bo")

    // ids stay — they wire the combobox to its listbox for screen readers.
    const classed = wrapper.findAll("[class]").flatMap((el) => el.classes())
    expect(classed.filter((name) => name.startsWith("atp-"))).toEqual([])
  })

  it("suggests handles as you type and signs in with the one picked", async () => {
    setup()
    const wrapper = mount(AtprotoLogin, { props: { debounce: 0 } })
    await flushPromises()

    await typeAndDebounce(wrapper, "bo")

    const rows = wrapper.findAll('[role="option"]')
    expect(rows).toHaveLength(1)
    expect(rows[0].text()).toContain("bob.bsky.social")

    await rows[0].trigger("mousedown")
    await flushPromises()
    expect(signInRedirect).toHaveBeenCalledWith("bob.bsky.social", undefined)
  })

  it("never opens the list when suggestions are off", async () => {
    setup()
    const wrapper = mount(AtprotoLogin, { props: { suggestions: false, debounce: 0 } })
    await flushPromises()

    await typeAndDebounce(wrapper, "bo")

    expect(wrapper.find('[role="listbox"]').exists()).toBe(false)
  })

  it("seeds the box from an inbound ?handle=", async () => {
    window.history.replaceState(null, "", "/?handle=carol.bsky.social")
    setup({ autoSignInFromQuery: "handle" })
    const wrapper = mount(AtprotoLogin)
    await flushPromises()
    expect((wrapper.find("input").element as HTMLInputElement).value).toBe("carol.bsky.social")
  })
})
