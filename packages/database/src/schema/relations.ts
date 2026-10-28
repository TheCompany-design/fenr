import { relations } from "drizzle-orm"
import { agentApprovals } from "./agent/agent-approvals"
import { agentItems } from "./agent/agent-items"
import { agentThreads } from "./agent/agent-threads"
import { agentTurns } from "./agent/agent-turns"
import {
  agentIntegrationToolExecutions,
  integrationCatalogToolkits,
  integrationCatalogTools,
  integrationCatalogTriggers,
  integrationConnectedAccounts,
  integrationOauthSessions,
  integrationRequests,
  integrationTriggerSubscriptions,
  tenantIntegrationConfigs,
  tenantToolApprovalPolicies,
} from "./agent/integrations"
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
    approvals: many(agentApprovals),
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

export const integrationCatalogToolkitsRelations = relations(
  integrationCatalogToolkits,
  ({ many }) => ({
    tools: many(integrationCatalogTools),
    triggers: many(integrationCatalogTriggers),
    configs: many(tenantIntegrationConfigs),
    connectedAccounts: many(integrationConnectedAccounts),
  }),
)

export const integrationCatalogToolsRelations = relations(
  integrationCatalogTools,
  ({ one, many }) => ({
    toolkit: one(integrationCatalogToolkits, {
      fields: [integrationCatalogTools.toolkitSlug],
      references: [integrationCatalogToolkits.slug],
    }),
    policies: many(tenantToolApprovalPolicies),
  }),
)

export const integrationCatalogTriggersRelations = relations(
  integrationCatalogTriggers,
  ({ one }) => ({
    toolkit: one(integrationCatalogToolkits, {
      fields: [integrationCatalogTriggers.toolkitSlug],
      references: [integrationCatalogToolkits.slug],
    }),
  }),
)

export const tenantIntegrationConfigsRelations = relations(
  tenantIntegrationConfigs,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [tenantIntegrationConfigs.tenantId],
      references: [organization.id],
    }),
    toolkit: one(integrationCatalogToolkits, {
      fields: [tenantIntegrationConfigs.toolkitSlug],
      references: [integrationCatalogToolkits.slug],
    }),
    connectedAccounts: many(integrationConnectedAccounts),
    oauthSessions: many(integrationOauthSessions),
  }),
)

export const integrationConnectedAccountsRelations = relations(
  integrationConnectedAccounts,
  ({ one, many }) => ({
    organization: one(organization, {
      fields: [integrationConnectedAccounts.tenantId],
      references: [organization.id],
    }),
    config: one(tenantIntegrationConfigs, {
      fields: [
        integrationConnectedAccounts.integrationConfigId,
        integrationConnectedAccounts.tenantId,
      ],
      references: [
        tenantIntegrationConfigs.id,
        tenantIntegrationConfigs.tenantId,
      ],
    }),
    toolkit: one(integrationCatalogToolkits, {
      fields: [integrationConnectedAccounts.toolkitSlug],
      references: [integrationCatalogToolkits.slug],
    }),
    executions: many(agentIntegrationToolExecutions),
    triggerSubscriptions: many(integrationTriggerSubscriptions),
  }),
)

export const integrationOauthSessionsRelations = relations(
  integrationOauthSessions,
  ({ one }) => ({
    organization: one(organization, {
      fields: [integrationOauthSessions.tenantId],
      references: [organization.id],
    }),
    config: one(tenantIntegrationConfigs, {
      fields: [
        integrationOauthSessions.integrationConfigId,
        integrationOauthSessions.tenantId,
      ],
      references: [
        tenantIntegrationConfigs.id,
        tenantIntegrationConfigs.tenantId,
      ],
    }),
    connectedAccount: one(integrationConnectedAccounts, {
      fields: [
        integrationOauthSessions.connectedAccountId,
        integrationOauthSessions.tenantId,
      ],
      references: [
        integrationConnectedAccounts.id,
        integrationConnectedAccounts.tenantId,
      ],
    }),
  }),
)

export const tenantToolApprovalPoliciesRelations = relations(
  tenantToolApprovalPolicies,
  ({ one }) => ({
    organization: one(organization, {
      fields: [tenantToolApprovalPolicies.tenantId],
      references: [organization.id],
    }),
    toolkit: one(integrationCatalogToolkits, {
      fields: [tenantToolApprovalPolicies.toolkitSlug],
      references: [integrationCatalogToolkits.slug],
    }),
    tool: one(integrationCatalogTools, {
      fields: [tenantToolApprovalPolicies.toolSlug],
      references: [integrationCatalogTools.slug],
    }),
  }),
)

export const agentIntegrationToolExecutionsRelations = relations(
  agentIntegrationToolExecutions,
  ({ one }) => ({
    organization: one(organization, {
      fields: [agentIntegrationToolExecutions.tenantId],
      references: [organization.id],
    }),
    thread: one(agentThreads, {
      fields: [agentIntegrationToolExecutions.threadId, agentIntegrationToolExecutions.tenantId],
      references: [agentThreads.id, agentThreads.tenantId],
    }),
    turn: one(agentTurns, {
      fields: [agentIntegrationToolExecutions.turnId, agentIntegrationToolExecutions.tenantId],
      references: [agentTurns.id, agentTurns.tenantId],
    }),
    toolCallItem: one(agentItems, {
      fields: [agentIntegrationToolExecutions.toolCallItemId, agentIntegrationToolExecutions.tenantId],
      references: [agentItems.id, agentItems.tenantId],
    }),
    connectedAccount: one(integrationConnectedAccounts, {
      fields: [agentIntegrationToolExecutions.connectedAccountId, agentIntegrationToolExecutions.tenantId],
      references: [integrationConnectedAccounts.id, integrationConnectedAccounts.tenantId],
    }),
  }),
)

export const integrationTriggerSubscriptionsRelations = relations(
  integrationTriggerSubscriptions,
  ({ one }) => ({
    connectedAccount: one(integrationConnectedAccounts, {
      fields: [integrationTriggerSubscriptions.connectedAccountId, integrationTriggerSubscriptions.tenantId],
      references: [integrationConnectedAccounts.id, integrationConnectedAccounts.tenantId],
    }),
    toolkit: one(integrationCatalogToolkits, {
      fields: [integrationTriggerSubscriptions.toolkitSlug],
      references: [integrationCatalogToolkits.slug],
    }),
    trigger: one(integrationCatalogTriggers, {
      fields: [integrationTriggerSubscriptions.triggerSlug],
      references: [integrationCatalogTriggers.slug],
    }),
  }),
)

export const integrationRequestsRelations = relations(
  integrationRequests,
  ({ one }) => ({
    organization: one(organization, {
      fields: [integrationRequests.tenantId],
      references: [organization.id],
    }),
    requestedBy: one(user, {
      fields: [integrationRequests.requestedByUserId],
      references: [user.id],
    }),
  }),
)
