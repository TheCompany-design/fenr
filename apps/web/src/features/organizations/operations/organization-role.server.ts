import type { OrganizationRole } from "@/lib/schemas/organizations"

import { getActiveOrganization } from "./organizations"

export function narrowOrganizationRole(value: string): OrganizationRole | null {
  return value === "owner" || value === "admin" || value === "member"
    ? value
    : null
}

export async function getActiveOrganizationRole(
  userId: string,
  currentSessionActiveOrgId?: string | null,
): Promise<OrganizationRole | null> {
  const active = await getActiveOrganization(userId, currentSessionActiveOrgId)
  if (!active) return null
  return narrowOrganizationRole(active.role)
}
