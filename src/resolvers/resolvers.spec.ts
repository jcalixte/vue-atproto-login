import { afterEach, describe, expect, it, vi } from "vitest"

import { bskyProfileResolver, bskySearchActors } from "./bsky"
import { combineResolvers, slingshotProfileResolver } from "./slingshot"

const mockFetch = (handler: (url: string) => unknown) => {
  const spy = vi.fn(async (input: RequestInfo | URL) => ({
    ok: true,
    json: async () => handler(String(input)),
  }))
  vi.stubGlobal("fetch", spy)
  return spy
}

afterEach(() => vi.unstubAllGlobals())

describe("bskyProfileResolver", () => {
  it("returns handle and avatar from one appview call", async () => {
    mockFetch(() => ({ did: "did:plc:alice", handle: "alice.bsky.social", avatar: "a.png" }))
    const profile = await bskyProfileResolver()("did:plc:alice")
    expect(profile).toEqual({
      did: "did:plc:alice",
      handle: "alice.bsky.social",
      displayName: undefined,
      avatar: "a.png",
    })
  })

  it("resolves each DID once", async () => {
    const spy = mockFetch(() => ({ did: "did:plc:alice", handle: "alice.bsky.social" }))
    const resolve = bskyProfileResolver()
    await Promise.all([resolve("did:plc:alice"), resolve("did:plc:alice")])
    await resolve("did:plc:alice")
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it("does not cache a failure", async () => {
    let calls = 0
    vi.stubGlobal("fetch", async () => {
      calls++
      if (calls === 1) throw new Error("offline")
      return { ok: true, json: async () => ({ did: "did:plc:alice", handle: "alice.test" }) }
    })
    const resolve = bskyProfileResolver()
    await expect(resolve("did:plc:alice")).rejects.toThrow("offline")
    await expect(resolve("did:plc:alice")).resolves.toMatchObject({ handle: "alice.test" })
  })
})

describe("slingshotProfileResolver", () => {
  it("returns handle and PDS from the DID document", async () => {
    mockFetch(() => ({ did: "did:plc:alice", handle: "alice.test", pds: "https://pds.example" }))
    const profile = await slingshotProfileResolver()("alice.test")
    expect(profile).toEqual({
      did: "did:plc:alice",
      handle: "alice.test",
      pds: "https://pds.example",
    })
  })

  it("caches under both the DID and the handle", async () => {
    const spy = mockFetch(() => ({ did: "did:plc:alice", handle: "alice.test" }))
    const resolve = slingshotProfileResolver()
    await resolve("alice.test")
    await resolve("did:plc:alice")
    expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe("combineResolvers", () => {
  it("merges answers, first resolver winning per field", async () => {
    const resolve = combineResolvers(
      async (did) => ({ did, handle: "alice.test", pds: "https://pds.example" }),
      async (did) => ({ did, handle: "stale.test", avatar: "a.png" }),
    )
    expect(await resolve("did:plc:alice")).toEqual({
      did: "did:plc:alice",
      handle: "alice.test",
      displayName: undefined,
      avatar: "a.png",
      pds: "https://pds.example",
    })
  })

  it("survives a resolver that throws", async () => {
    const resolve = combineResolvers(
      async () => {
        throw new Error("down")
      },
      async (did) => ({ did, handle: "alice.test" }),
    )
    expect(await resolve("did:plc:alice")).toMatchObject({ handle: "alice.test" })
  })

  it("returns null when nobody knows", async () => {
    const resolve = combineResolvers(async () => null)
    expect(await resolve("did:plc:alice")).toBeNull()
  })
})

describe("bskySearchActors", () => {
  it("maps the typeahead response", async () => {
    mockFetch(() => ({ actors: [{ did: "did:plc:a", handle: "a.test", displayName: "A" }] }))
    const results = await bskySearchActors()("a")
    expect(results).toEqual([
      { did: "did:plc:a", handle: "a.test", displayName: "A", avatar: undefined },
    ])
  })

  it("answers empty for a blank query without calling the network", async () => {
    const spy = mockFetch(() => ({}))
    expect(await bskySearchActors()("   ")).toEqual([])
    expect(spy).not.toHaveBeenCalled()
  })

  it("degrades to an empty list rather than throwing", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("aborted")
    })
    expect(await bskySearchActors()("a")).toEqual([])
  })
})
