import type { ActiveTurnProjection } from "./state/stream-reducer"

export interface ChatMessage {
  readonly id: string
  readonly role: "user" | "agent"
  readonly content: string
  readonly thinking?: string | null
  readonly createdAt?: string
}

export interface ChatThread {
  readonly id: string
  readonly tenantId: string
  readonly title?: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type { ActiveTurnProjection }
