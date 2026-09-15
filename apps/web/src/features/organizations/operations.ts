/**
 * Server functions and domain operations for organization management and authorization.
 *
 * SERVER-ONLY: Enforces membership and permission invariants at every boundary.
 * Facade module re-exporting decomposed domain operations from ./operations/
 */

export * from "./operations/index"
export type {
  ActiveOrganization,
  AppOrganizationAccess,
  InvitationDetailsResult,
} from "./types"
