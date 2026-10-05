import type { ActiveTurnProjection } from "./state/stream-reducer"

export interface ChatMessage {
  readonly id: string
  readonly role: "user" | "agent"
  readonly content: string
  readonly thinking?: string | null
  readonly status?: "pending" | "streaming" | "completed" | "error"
  readonly createdAt?: string
  /**
   * This bubble is the optimistic placeholder and has not yet been given an
   * identity by the runtime.
   *
   * It is what distinguishes "a bubble waiting for its first item" from "a
   * bubble the runtime has already claimed, which merely happens to be empty
   * because that step produced no text". The second must never be handed to
   * another item, or the first step's completion can no longer be matched to
   * the message it belongs to.
   */
  readonly unclaimed?: boolean
}

export interface ChatThread {
  readonly id: string
  readonly tenantId: string
  readonly title?: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export type { ActiveTurnProjection }
