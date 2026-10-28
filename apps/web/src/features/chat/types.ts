import type {
  ActiveTurnProjection,
  ModelCallProjection,
} from "./state/stream-reducer"

export interface ChatMessage {
  readonly id: string
  readonly role: "user" | "agent"
  readonly content: string
  readonly thinking?: string | null
  readonly status?: "pending" | "streaming" | "completed" | "error"
  readonly createdAt?: string
  readonly turnId?: string
  readonly modelCalls?: readonly ModelCallProjection[]

  readonly unclaimed?: boolean
}

export interface ChatThread {
  readonly id: string
  readonly tenantId: string
  readonly title?: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export interface ChatThreadSummary {
  readonly id: string
  readonly title?: string | null
  readonly model?: string | null
  readonly effort?: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type { ActiveTurnProjection }
