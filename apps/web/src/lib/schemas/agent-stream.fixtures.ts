/**
 * Wire fixtures captured from the Rust implementation.
 *
 * Every entry below was produced by serialising `AgentStreamEvent` with serde in
 * `thebookofnabu` — not written by hand from the documentation. That matters
 * because this file is the contract's regression test: if the server renames a
 * type, adds a variant, or changes a field's presence, these fixtures stop
 * parsing and the failure names the exact drift.
 *
 * To regenerate, construct every variant in `crates/nabu-agent-core` and print
 * `serde_json::to_string(&event)`; do not hand-edit a value to make a test pass.
 */

/** Identifiers from a real serialisation; UUIDv7, as the server mints them. */
export const FIXTURE_THREAD_ID = "01a10a57-2b99-7288-93d8-ac57689e6597"
export const FIXTURE_TURN_ID = "01a10a57-2b99-7288-93d8-ac586344b10b"
export const FIXTURE_ITEM_ID = "01a10a57-2b99-7288-93d8-ac592f02648a"
export const FIXTURE_USER_ID = "01a10a5d-e3ce-702d-95a9-c2b33fc38d65"

export const TURN_STARTED_FIXTURE = {
  type: "turn_started",
  data: { thread_id: FIXTURE_THREAD_ID, turn_id: FIXTURE_TURN_ID },
}

export const TURN_SUSPENDED_FIXTURE = {
  type: "turn_suspended",
  data: {
    thread_id: FIXTURE_THREAD_ID,
    turn_id: FIXTURE_TURN_ID,
    item_id: FIXTURE_ITEM_ID,
    attempt: 1,
  },
}

export const TURN_RESUMED_FIXTURE = {
  type: "turn_resumed",
  data: {
    thread_id: FIXTURE_THREAD_ID,
    turn_id: FIXTURE_TURN_ID,
    attempt: 2,
    decision: "approved",
  },
}

export const ITEM_STARTED_TOOL_CALL_FIXTURE = {
  type: "item_started",
  data: {
    thread_id: FIXTURE_THREAD_ID,
    turn_id: FIXTURE_TURN_ID,
    item_id: FIXTURE_ITEM_ID,
    kind: "tool_call",
  },
}

export const ITEM_STARTED_APPROVAL_REQUEST_FIXTURE = {
  type: "item_started",
  data: {
    thread_id: FIXTURE_THREAD_ID,
    turn_id: FIXTURE_TURN_ID,
    item_id: FIXTURE_ITEM_ID,
    kind: "approval_request",
  },
}

export const ITEM_DELTA_TOOL_ARGUMENTS_FIXTURE = {
  type: "item_delta",
  data: {
    item_id: FIXTURE_ITEM_ID,
    delta: { kind: "tool_arguments_delta", text: '{"a":' },
  },
}

export const ITEM_COMPLETED_TOOL_CALL_FIXTURE = {
  type: "item_completed",
  data: {
    item_id: FIXTURE_ITEM_ID,
    payload: {
      kind: "tool_call",
      call_id: "call_1",
      name: "echo",
      arguments: { text: "hi" },
    },
  },
}

export const ITEM_COMPLETED_TOOL_RESULT_FIXTURE = {
  type: "item_completed",
  data: {
    item_id: FIXTURE_ITEM_ID,
    payload: {
      kind: "tool_result",
      call_id: "call_1",
      name: "echo",
      output: "ok",
      truncated: false,
      outcome: "succeeded",
    },
  },
}

/** The ambiguous case: nobody observed whether the call took effect. */
export const ITEM_COMPLETED_TOOL_RESULT_UNKNOWN_FIXTURE = {
  type: "item_completed",
  data: {
    item_id: FIXTURE_ITEM_ID,
    payload: {
      kind: "tool_result",
      call_id: "call_1",
      name: "echo",
      output: "?",
      truncated: false,
      outcome: "unknown",
    },
  },
}

export const ITEM_COMPLETED_APPROVAL_REQUEST_FIXTURE = {
  type: "item_completed",
  data: {
    item_id: FIXTURE_ITEM_ID,
    payload: {
      kind: "approval_request",
      call_id: "call_1",
      tool: "echo",
      arguments: { text: "hi" },
    },
  },
}

export const ITEM_COMPLETED_APPROVAL_DECISION_FIXTURE = {
  type: "item_completed",
  data: {
    item_id: FIXTURE_ITEM_ID,
    payload: {
      kind: "approval_decision",
      call_id: "call_1",
      decision: "denied",
      decided_by: FIXTURE_USER_ID,
    },
  },
}

/** `thinking` is omitted when the model produced none. */
export const ITEM_COMPLETED_AGENT_MESSAGE_FIXTURE = {
  type: "item_completed",
  data: {
    item_id: FIXTURE_ITEM_ID,
    payload: { kind: "agent_message", text: "hi" },
  },
}

export const TURN_COMPLETED_CANCELLED_FIXTURE = {
  type: "turn_completed",
  data: {
    thread_id: FIXTURE_THREAD_ID,
    turn_id: FIXTURE_TURN_ID,
    status: "cancelled",
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
  },
}

export const STREAM_ERROR_FIXTURE = {
  type: "stream_error",
  data: { code: "INTERNAL_ERROR", message: "boom" },
}

/** Every fixture, for exhaustive round-trip coverage. */
export const ALL_AGENT_STREAM_FIXTURES = [
  TURN_STARTED_FIXTURE,
  TURN_SUSPENDED_FIXTURE,
  TURN_RESUMED_FIXTURE,
  ITEM_STARTED_TOOL_CALL_FIXTURE,
  ITEM_STARTED_APPROVAL_REQUEST_FIXTURE,
  ITEM_DELTA_TOOL_ARGUMENTS_FIXTURE,
  ITEM_COMPLETED_TOOL_CALL_FIXTURE,
  ITEM_COMPLETED_TOOL_RESULT_FIXTURE,
  ITEM_COMPLETED_TOOL_RESULT_UNKNOWN_FIXTURE,
  ITEM_COMPLETED_APPROVAL_REQUEST_FIXTURE,
  ITEM_COMPLETED_APPROVAL_DECISION_FIXTURE,
  ITEM_COMPLETED_AGENT_MESSAGE_FIXTURE,
  TURN_COMPLETED_CANCELLED_FIXTURE,
  STREAM_ERROR_FIXTURE,
] as const
