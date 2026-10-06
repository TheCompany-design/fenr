import type { OrganizationRole } from "@/lib/schemas/organizations"

import { getActiveOrganization } from "./organizations"

/**
 * The caller's authority in the workspace they are acting in.
 *
 * `.server.ts` on purpose. This module reaches the database driver, and that
 * driver runs `Buffer.allocUnsafe` at import time — which throws the moment a
 * browser evaluates it. The suffix is what keeps this module out of the client
 * bundle.
 *
 * That is not theoretical. Exporting these two functions from the feature barrel
 * made the operations module a *live* export of a barrel that client components
 * import, so the bundler could no longer tree-shake it away, `pg` landed in the
 * browser, and every route in the app became inert server HTML with no event
 * handlers attached. The chat send button sat disabled however much you typed;
 * the settings form performed a native GET on submit. Both presented as unrelated
 * UI bugs and neither had a local cause.
 */

/**
 * Narrows a stored membership role to the three the product recognises.
 *
 * Exported as its own function because the narrowing is where a bug hides: the
 * column is `text`, so reading it hands back a `string` and the temptation is to
 * cast it. A cast compiles, and then an unrecognised value becomes an
 * `OrganizationRole` by assertion — which is how a role of `"admin "` or a
 * `"superuser"` from a future migration becomes an administrator.
 *
 * Returns `null` rather than defaulting. A caller that cannot name the role must
 * not be handed the least privilege either: defaulting to `member` would silently
 * strip an owner's ability to administer their own workspace.
 */
export function narrowOrganizationRole(value: string): OrganizationRole | null {
  return value === "owner" || value === "admin" || value === "member"
    ? value
    : null
}

/**
 * The caller's authority in the workspace they are currently acting in.
 *
 * Built on [`getActiveOrganization`] rather than a second membership query, so
 * there is exactly one place that knows how an active organization is resolved —
 * including the fallback to a stored preference when the session does not name
 * one, which a bespoke query here would silently skip.
 *
 * `null` means "we could not name an authority", which is deliberately not the
 * same answer as "no authority".
 */
export async function getActiveOrganizationRole(
  userId: string,
  currentSessionActiveOrgId?: string | null,
): Promise<OrganizationRole | null> {
  const active = await getActiveOrganization(userId, currentSessionActiveOrgId)
  if (!active) return null
  return narrowOrganizationRole(active.role)
}
