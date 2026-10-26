/**
 * The logo service is named once, and these tests are what make that a fact
 * rather than a convention.
 *
 * The failure they guard is the one this module exists to prevent: a second
 * copy of the service address creeping into a component, so that moving the
 * service or retargeting one mark becomes a hunt instead of one edit, and so
 * that a vendor's mark can be decided in two places that disagree. Nothing
 * about a duplicate URL is an error — it typechecks, it lints, it even renders
 * — so only a test can hold the line.
 */

import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { logoUrl } from "./logos"

/** The service's host, which exactly one file in the tree may name. */
const SERVICE_HOST = "logos.lndev.me"

/** This module's own path, relative to the repository root. */
const OWN_PATH = "apps/web/src/lib/brand/logos.ts"

/** This test, whose prose necessarily quotes the address it forbids. */
const OWN_TEST_PATH = "apps/web/src/lib/brand/logos.test.ts"

/**
 * The repository root, resolved from this file rather than assumed — three
 * levels up out of `apps/web/src/lib/brand`, then two more to the repo. Uses
 * `fileURLToPath` because `URL.pathname` stays percent-encoded, which would
 * turn a checkout under a path with a space into a wall of ENOENTs.
 */
const REPO_ROOT = fileURLToPath(new URL("../../../../..", import.meta.url))

/**
 * Every file kind a mark could be inlined into by code. Prose is excluded on
 * purpose: `AGENTS.md` names the service because it is the *rule* mandating
 * it, and a doc showing a URL is documentation, not a second decision.
 */
const SOURCE_GLOB = "**/*.{ts,tsx,js,jsx,mjs,cjs,css,html,json}"

/**
 * Directories holding generated or vendored code rather than this repo's own
 * sources. `node_modules` and `.turbo` are excluded because the walk sets
 * `dot: true` in order to reach dot-directories like `.agents`, and enabling
 * that otherwise pulls in tens of thousands of installed files.
 */
const IGNORED =
  /(^|\/)(node_modules|dist|\.output|\.turbo|\.vite|\.tanstack|\.git)\//

/** Glob options shared by the scan and its non-vacuity check. */
const SCAN = { cwd: REPO_ROOT, dot: true } as const

/**
 * Source files in the repository, excluding this module and its own test.
 *
 * Escapes are stripped before matching so a regular expression —
 * `logos\.lndev\.me` — cannot smuggle a second copy past the guard dressed as
 * a pattern, and the match is case-insensitive because a URL host is.
 */
function sourceFilesNamingTheService(): string[] {
  const offenders: string[] = []
  for (const file of new Bun.Glob(SOURCE_GLOB).scanSync(SCAN)) {
    if (file === OWN_PATH || file === OWN_TEST_PATH) continue
    if (IGNORED.test(file)) continue
    const source = readFileSync(join(REPO_ROOT, file), "utf8").replace(
      /\\/g,
      "",
    )
    if (source.toLowerCase().includes(SERVICE_HOST)) offenders.push(file)
  }
  return offenders
}

describe("the shared logo service", () => {
  it("builds a mark URL from the service and the mark's own id", () => {
    expect(logoUrl("openai")).toBe(`https://${SERVICE_HOST}/logos/openai.svg`)
    // The service files a mark under its brand's real name, which need not be
    // the id this app files the vendor under — Google's pinwheel lives at
    // `google-antigravity.svg`. The builder takes the id the service knows,
    // which is why a caller must never assume it can pass a vendor id through.
    expect(logoUrl("google-antigravity")).toBe(
      `https://${SERVICE_HOST}/logos/google-antigravity.svg`,
    )
  })

  it("is the only place in the source tree that names the service", () => {
    expect(sourceFilesNamingTheService()).toEqual([])
  })

  it("actually scanned the tree", () => {
    // Without this the guard above passes vacuously: a glob that matched
    // nothing, or a root that resolved somewhere empty, would report zero
    // offenders and look exactly like a clean bill of health.
    const scanned = [...new Bun.Glob(SOURCE_GLOB).scanSync(SCAN)].filter(
      (file) => !IGNORED.test(file),
    )
    expect(scanned.length).toBeGreaterThan(100)
  })
})
