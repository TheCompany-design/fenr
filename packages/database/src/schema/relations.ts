import { relations } from "drizzle-orm"
import { agentItems } from "./agent/agent-items"
import { agentThreads } from "./agent/agent-threads"
import { agentTurns } from "./agent/agent-turns"
import { account } from "./auth/account"
import { session } from "./auth/session"
import { user } from "./auth/user"
import { invitation } from "./organizations/invitation"
import { member } from "./organizations/member"
import { organization } from "./organizations/organization"
import { userActiveOrganization } from "./organizations/user-active-organization"

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  members: many(member),
  sentInvitations: many(invitation),
  activeOrganizationPreference: one(userActiveOrganization, {
    fields: [user.id],
    references: [userActiveOrganization.userId],
  }),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  activeOrganization: one(organization, {
    fields: [session.activeOrganizationId],
    references: [organization.id],
  }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))

export const organizationRelations = relations(organization, ({ many }) => ({
  members: many(member),
  invitations: many(invitation),
  sessions: many(session),
  activePreferences: many(userActiveOrganization),
  agentThreads: many(agentThreads),
}))

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}))

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  inviter: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}))

export const userActiveOrganizationRelations = relations(
  userActiveOrganization,
  ({ one }) => ({
    user: one(user, {
      fields: [userActiveOrganization.userId],
      references: [user.id],
    }),
    organization: one(organization, {
      fields: [userActiveOrganization.organizationId],
      references: [organization.id],
    }),
  }),
)

export const agentThreadsRelations = relations(
  agentThreads,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [agentThreads.tenantId],
      references: [organization.id],
    }),
    turns: many(agentTurns),
    items: many(agentItems),
  }),
)

export const agentTurnsRelations = relations(agentTurns, ({ one, many }) => ({
  thread: one(agentThreads, {
    fields: [agentTurns.threadId],
    references: [agentThreads.id],
  }),
  items: many(agentItems),
}))

export const agentItemsRelations = relations(agentItems, ({ one }) => ({
  thread: one(agentThreads, {
    fields: [agentItems.threadId],
    references: [agentThreads.id],
  }),
  turn: one(agentTurns, {
    fields: [agentItems.turnId],
    references: [agentTurns.id],
  }),
}))
