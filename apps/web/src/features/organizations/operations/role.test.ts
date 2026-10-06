/**
 * Narrowing a stored membership role.
 *
 * This exists because of a bug. The provider settings page failed for every caller
 * with "Workspace role could not be determined", because the code read
 * `session.session.activeOrganizationRole` through a cast — a field the session
 * does not have. The cast compiled. Nothing else would have.
 *
 * So the narrowing is separated out and tested on its own: the column is `text`,
 * so reading it hands back a `string`, and the only thing standing between that
 * and an administrator is a function that checks rather than a cast that asserts.
 */

import { describe, expect, it } from "bun:test"

import { narrowOrganizationRole } from "./organizations"

describe("narrowing a membership role", () => {
  it("passes through the three roles the product recognises", () => {
    expect(narrowOrganizationRole("owner")).toBe("owner")
    expect(narrowOrganizationRole("admin")).toBe("admin")
    expect(narrowOrganizationRole("member")).toBe("member")
  })

  it("refuses a value it does not recognise", () => {
    // A future migration adding a role, a typo, a value that never should have
    // been written. All of them must be refused rather than guessed at.
    for (const value of [
      "",
      " ",
      "Owner",
      "OWNER",
      "admin ",
      "superuser",
      "admin\n",
      "0",
      "null",
      "undefined",
    ]) {
      expect(narrowOrganizationRole(value)).toBeNull()
    }
  })

  it("never defaults to the least privilege", () => {
    // The failure this guards is subtle: returning `member` for an unrecognised
    // value would look correct — it is a valid role — and would quietly strip an
    // owner of the ability to administer their own workspace, with a refusal
    // pointing at the wrong problem.
    expect(narrowOrganizationRole("Owner")).not.toBe("member")
    expect(narrowOrganizationRole("")).not.toBe("member")
  })
})
