// One command from a clean checkout to a published version:
//
//   pnpm release            # patch
//   pnpm release minor
//   pnpm release 1.0.0-rc.1
//
// It bumps, tags, pushes to every mirror, makes sure the publish workflow
// actually runs, and waits for it. The publish itself happens in CI, on npm
// trusted publishing — no token on your machine, and the release carries a
// provenance attestation. This script never touches the registry.
import { execFileSync } from "node:child_process"

const BUMPS = new Set(["patch", "minor", "major", "premajor", "preminor", "prepatch", "prerelease"])
const WORKFLOW = "publish.yml"

const run = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: "utf8", stdio: "pipe", ...options }).trim()

const runLoud = (command, args) => execFileSync(command, args, { stdio: "inherit" })

// Synchronous sleep with no dependency and no platform assumption.
const sleep = (seconds) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000)

const die = (message) => {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

const bump = process.argv[2] ?? "patch"
if (!BUMPS.has(bump) && !/^\d+\.\d+\.\d+/.test(bump)) {
  die(`Unknown bump "${bump}". Use patch / minor / major, or an explicit version.`)
}

// --- preconditions -------------------------------------------------------
// Each of these is something that silently produces a broken release if it is
// wrong, and is invisible until much later.

const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"])
if (branch !== "main") die(`On "${branch}". Releases are cut from main.`)

if (run("git", ["status", "--porcelain"])) {
  die("Working tree is dirty. Commit or stash first — the tag should describe what shipped.")
}

run("git", ["fetch", "origin", "main", "--tags"])
if (run("git", ["rev-list", "--count", "HEAD..origin/main"]) !== "0") {
  die("Behind origin/main. Pull first, or you will publish someone else's idea of main.")
}

try {
  run("gh", ["auth", "status"])
} catch {
  die("gh is not authenticated. The release is dispatched and watched through it.")
}

// --- bump, tag, push -----------------------------------------------------
// `npm version` runs our own lifecycle hooks: `preversion` verifies, and
// `postversion` pushes the commit and tag to every push URL on origin.

console.log(`\n▸ ${bump} release from ${run("node", ["-p", "require('./package.json').version"])}\n`)
runLoud("npm", ["version", bump, "-m", "chore(release): v%s"])

const version = run("node", ["-p", "require('./package.json').version"])
const tag = `v${version}`
console.log(`\n▸ tagged and pushed ${tag}\n`)

// --- make sure the publish workflow is actually running ------------------
// Tag pushes on this repository do not currently spawn runs — GitHub records
// the PushEvent and starts nothing. So look for a run, and dispatch one only if
// the tag push did not produce it. Checking rather than always dispatching
// keeps this correct if push triggers start working again: no double publish.
//
// A push-triggered run reports the tag as its headBranch; a dispatched one
// reports main. So the two cases are found differently: by tag before
// dispatching, by "an id we had not seen" after.

const listRuns = () =>
  JSON.parse(
    run("gh", [
      "run",
      "list",
      "--workflow",
      WORKFLOW,
      "--limit",
      "20",
      "--json",
      "headBranch,databaseId,event",
    ]),
  )

const known = new Set(listRuns().map((entry) => entry.databaseId))

process.stdout.write("▸ waiting for the tag to start the publish workflow")
let found = null
for (let attempt = 0; attempt < 6 && !found; attempt++) {
  sleep(5)
  process.stdout.write(".")
  found = listRuns().find((entry) => entry.headBranch === tag) ?? null
}
console.log()

if (!found) {
  console.log(`▸ it did not — dispatching ${WORKFLOW} against ${tag}\n`)
  runLoud("gh", ["workflow", "run", WORKFLOW, "-f", `tag=${tag}`])
  for (let attempt = 0; attempt < 12 && !found; attempt++) {
    sleep(5)
    found = listRuns().find((entry) => !known.has(entry.databaseId)) ?? null
  }
  if (!found) die(`Dispatched ${WORKFLOW} but no run appeared. Check: gh run list`)
}

// --- watch ---------------------------------------------------------------

const id = String(found.databaseId)
console.log(`▸ watching run ${id}\n`)
try {
  runLoud("gh", ["run", "watch", id, "--exit-status"])
} catch {
  die(`Publish failed. Logs: gh run view ${id} --log-failed`)
}

console.log(`\n✓ vue-atproto-login@${version} published`)
console.log(`  https://www.npmjs.com/package/vue-atproto-login/v/${version}`)
