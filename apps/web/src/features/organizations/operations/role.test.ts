import { describe, expect, it } from "bun:test"

import { narrowOrganizationRole } from "./organization-role.server"

describe("narrowing a membership role", () => {
  it("passes through the three roles the product recognises", () => {
    expect(narrowOrganizationRole("owner")).toBe("owner")
    expect(narrowOrganizationRole("admin")).toBe("admin")
    expect(narrowOrganizationRole("member")).toBe("member")
  })

  it("refuses a value it does not recognise", () => {
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
    expect(narrowOrganizationRole("Owner")).not.toBe("member")
    expect(narrowOrganizationRole("")).not.toBe("member")
  })
})
