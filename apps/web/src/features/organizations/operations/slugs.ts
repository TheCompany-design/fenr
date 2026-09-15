import { db, eq, schema } from "@workspace/database"
import {
  type CheckSlugInput,
  isReservedSlug,
  isValidSlugFormat,
  normalizeSlug,
} from "@/lib/schemas/organizations"

/**
 * Check whether an organization slug is valid and available.
 */
export async function checkSlugAvailability(input: CheckSlugInput) {
  const normalized = normalizeSlug(input.slug)

  if (!isValidSlugFormat(normalized)) {
    return {
      available: false,
      slug: normalized,
      reason:
        "Slug must be between 3 and 48 alphanumeric characters or hyphens",
    }
  }

  if (isReservedSlug(normalized)) {
    return {
      available: false,
      slug: normalized,
      reason: "This slug is reserved and cannot be used",
    }
  }

  const [existing] = await db
    .select({ id: schema.organization.id })
    .from(schema.organization)
    .where(eq(schema.organization.slug, normalized))
    .limit(1)

  return {
    available: !existing,
    slug: normalized,
    reason: existing ? "This slug is already taken" : undefined,
  }
}
