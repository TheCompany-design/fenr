import { describe, expect, it } from "bun:test"
import type { ChatMessage } from "../types"
import { groupIntoTurns, turnText, turnThinking } from "./chat-turns"

function agent(id: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    role: "agent",
    content: "",
    thinking: "",
    status: "completed",
    ...overrides,
  }
}

describe("grouping a timeline into turns", () => {
  it("presents one reply as one turn, however many steps it took", () => {
    // The reported problem: one question, one answer, and a bubble per model
    // step, so it read as several turns.
    const turns = groupIntoTurns([
      { id: "u1", role: "user", content: "hello", status: "completed" },
      agent("a1", { thinking: "thinking about it" }),
      agent("a2", { thinking: "about the tool" }),
      agent("a3", { content: "here is the answer", thinking: "ready" }),
    ])

    expect(turns).toHaveLength(2)
    expect(turns[1]?.messages).toHaveLength(3)
    expect(turnText(turns[1]!.messages)).toBe("here is the answer")
  })

  it("keeps two turns apart, because a person separates them", () => {
    const turns = groupIntoTurns([
      { id: "u1", role: "user", content: "first", status: "completed" },
      agent("a1", { content: "one" }),
      { id: "u2", role: "user", content: "second", status: "completed" },
      agent("a2", { content: "two" }),
    ])

    expect(turns).toHaveLength(4)
    expect(turns[2]?.isUser).toBe(true)
    expect(turns[3]?.messages).toHaveLength(1)
  })

  it("keeps a step that produced no text", () => {
    // A step that only called a tool has no words but real reasoning; dropping it
    // would lose part of how the answer was reached.
    const turns = groupIntoTurns([
      agent("a1", { thinking: "I should call a tool" }),
      agent("a2", { content: "the answer", thinking: "now I know" }),
    ])

    expect(turns).toHaveLength(1)
    expect(turns[0]?.messages).toHaveLength(2)
  })

  it("shows one reasoning trace, with the steps kept apart", () => {
    // Run together, the steps read as one thought that went nowhere — which is
    // how it looked when each step carried its own trace.
    const turns = groupIntoTurns([
      agent("a1", { thinking: "first thought" }),
      agent("a2", { thinking: "second thought" }),
    ])

    expect(turnThinking(turns[0]!.messages)).toBe(
      "first thought\n\nsecond thought",
    )
  })

  it("is live while any step of the turn is still streaming", () => {
    const turns = groupIntoTurns([
      agent("a1", { status: "completed" }),
      agent("a2", { status: "streaming" }),
    ])
    expect(turns[0]?.isStreaming).toBe(true)
  })

  it("settles once the last step is done", () => {
    const turns = groupIntoTurns([
      agent("a1", { status: "streaming" }),
      agent("a2", { status: "completed" }),
    ])
    // A finished step does not retract the turn being live: it is still being
    // written while a later step streams.
    expect(turns[0]?.isStreaming).toBe(false)
  })

  it("groups an empty timeline into nothing", () => {
    expect(groupIntoTurns([])).toEqual([])
  })
})
