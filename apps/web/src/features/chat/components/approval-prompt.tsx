import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  ApprovalCard,
  type ApprovalCardAnswers,
  type ApprovalCardOption,
  type ApprovalCardQuestion,
  type ApprovalCardStatus,
} from "@workspace/ui/components/approval-card"
import { Button } from "@workspace/ui/components/button"
import {
  ToolApproval,
  ToolApprovalCode,
  type ToolApprovalParameter,
  type ToolApprovalStatus,
} from "@workspace/ui/components/tool-approval"
import { useState } from "react"
import { toast } from "sonner"
import {
  type ApprovalToolMetadata,
  getApprovalToolFn,
  putToolPolicyFn,
} from "@/features/integrations/api/integrations.functions"
import { decideApprovalFn } from "@/features/nabu"
import type { ApprovalDecision } from "@/lib/schemas/agent-stream"
import { chatKeys } from "../queries/chat-queries"

export interface ApprovalPromptProps {
  readonly turnId: string
  readonly itemId: string
  readonly attempt: number
  readonly threadId?: string
  readonly mode?: "auto" | "tool-approval" | "approval-card"
  readonly initialToolMetadata?: ApprovalToolMetadata | null
  readonly questions?: ApprovalCardQuestion[]
  readonly onResume?: (
    turnId: string,
    threadId?: string,
  ) => void | Promise<void>
  readonly onRequestChanges?: (feedback: string) => void | Promise<void>
  readonly onSubmitQuestions?: (
    answers: ApprovalCardAnswers,
  ) => void | Promise<void>
}

function isQuestionOption(value: unknown): value is ApprovalCardOption {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { value?: unknown }).value === "string" &&
    typeof (value as { label?: unknown }).label === "string"
  )
}

function extractQuestionsFromArguments(
  args: Record<string, unknown>,
): ApprovalCardQuestion[] | null {
  const rawQuestions = args.questions
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    return null
  }
  const parsed: ApprovalCardQuestion[] = []
  for (const entry of rawQuestions) {
    if (typeof entry !== "object" || entry === null) {
      continue
    }
    const candidate = entry as {
      id?: unknown
      title?: unknown
      question?: unknown
      description?: unknown
      options?: unknown
      multiple?: unknown
      type?: unknown
      autoAdvance?: unknown
      allowCustom?: unknown
      customPlaceholder?: unknown
    }
    const id = typeof candidate.id === "string" ? candidate.id : null
    const title =
      typeof candidate.title === "string"
        ? candidate.title
        : typeof candidate.question === "string"
          ? candidate.question
          : null
    if (!id || !title) {
      continue
    }
    const options = Array.isArray(candidate.options)
      ? candidate.options.filter(isQuestionOption)
      : []
    if (options.length === 0 && !candidate.allowCustom) {
      continue
    }
    parsed.push({
      id,
      title,
      description:
        typeof candidate.description === "string"
          ? candidate.description
          : undefined,
      options,
      multiple: Boolean(candidate.multiple || candidate.type === "multi"),
      autoAdvance:
        typeof candidate.autoAdvance === "boolean"
          ? candidate.autoAdvance
          : undefined,
      allowCustom: Boolean(candidate.allowCustom),
      customPlaceholder:
        typeof candidate.customPlaceholder === "string"
          ? candidate.customPlaceholder
          : undefined,
    })
  }
  return parsed.length > 0 ? parsed : null
}

export function buildToolApprovalParameters(
  args: Record<string, unknown>,
): ToolApprovalParameter[] {
  const entries = Object.entries(args)
  if (entries.length === 0) {
    return []
  }

  return entries.map(([key, value]) => {
    if (value === null || value === undefined) {
      return { id: key, label: key, value: String(value) }
    }
    if (typeof value === "boolean" || typeof value === "number") {
      return { id: key, label: key, value: String(value) }
    }
    if (typeof value === "string") {
      const trimmed = value.trim()
      const looksLikeMultilineOrJson =
        trimmed.includes("\n") ||
        trimmed.length > 100 ||
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))

      if (looksLikeMultilineOrJson) {
        return {
          id: key,
          label: key,
          value: (
            <ToolApprovalCode
              code={value}
              language={
                trimmed.startsWith("{") || trimmed.startsWith("[")
                  ? "json"
                  : "text"
              }
            />
          ),
        }
      }
      return { id: key, label: key, value }
    }

    return {
      id: key,
      label: key,
      value: (
        <ToolApprovalCode
          code={JSON.stringify(value, null, 2)}
          language="json"
        />
      ),
    }
  })
}

export function ApprovalPrompt({
  turnId,
  itemId,
  attempt,
  threadId,
  mode = "auto",
  initialToolMetadata,
  questions: explicitQuestions,
  onResume,
  onRequestChanges,
  onSubmitQuestions,
}: ApprovalPromptProps) {
  const queryClient = useQueryClient()
  const [resolvedStatus, setResolvedStatus] = useState<
    | "approved"
    | "always-allowed"
    | "denied"
    | "changes-requested"
    | "answered"
    | null
  >(null)
  const [viewOverride, setViewOverride] = useState<
    "tool-approval" | "approval-card" | null
  >(null)
  const [showRevisionEditor, setShowRevisionEditor] = useState(false)
  const [revisionFeedback, setRevisionFeedback] = useState("")

  const approvalTool = useQuery({
    queryKey: ["approval-tool", itemId],
    queryFn: () => getApprovalToolFn({ data: { itemId } }),
    initialData: initialToolMetadata ?? undefined,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const metadata = approvalTool.data ?? initialToolMetadata ?? null
  const rawArgs = metadata?.arguments ?? {}
  const extractedQuestions =
    explicitQuestions ?? extractQuestionsFromArguments(rawArgs)

  const effectiveMode: "tool-approval" | "approval-card" =
    viewOverride ??
    (mode !== "auto"
      ? mode
      : extractedQuestions || rawArgs.mode === "approval-card"
        ? "approval-card"
        : "tool-approval")

  const invalidateAndResume = async () => {
    if (threadId) {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.pendingApproval(threadId),
      })
      void queryClient.invalidateQueries({
        queryKey: chatKeys.thread(threadId),
      })
    } else {
      void queryClient.invalidateQueries({
        queryKey: chatKeys.thread(turnId),
      })
    }
    if (onResume) {
      await onResume(turnId, threadId)
    }
  }

  const alwaysAllow = useMutation({
    mutationFn: async (toolSlug: string) => {
      await putToolPolicyFn({
        data: { toolSlug, approvalMode: "auto_approve" },
      })
      await decideApprovalFn({
        data: { turnId, itemId, decision: "approved" as const },
      })
    },
    onSuccess: async () => {
      setResolvedStatus("always-allowed")
      toast.success("Decision recorded", {
        description:
          "This action is now auto-approved for the whole workspace. Admins can change it under Integrations.",
      })
      await invalidateAndResume()
    },
    onError: (error: unknown) => {
      toast.error("The workspace rule was not saved", {
        description:
          error instanceof Error
            ? error.message
            : "The runtime did not accept the decision.",
      })
    },
  })

  const decide = useMutation({
    mutationFn: (decision: ApprovalDecision) =>
      decideApprovalFn({
        data: { turnId, itemId, decision },
      }),
    onSuccess: async (_data, decision) => {
      setResolvedStatus((prev) =>
        prev === "changes-requested" || prev === "answered"
          ? prev
          : decision === "approved"
            ? "approved"
            : "denied",
      )
      toast.success("Decision recorded. The turn is resuming.", {
        description: `Attempt ${attempt} continues.`,
      })
      await invalidateAndResume()
    },
    onError: (error: unknown) => {
      toast.error("The decision was not recorded", {
        description:
          error instanceof Error
            ? error.message
            : "The runtime did not accept the decision.",
      })
    },
  })

  const isBusy = decide.isPending || alwaysAllow.isPending

  const toolTitle = metadata?.displayName ?? metadata?.tool ?? "Tool execution"
  const toolDescription =
    metadata?.description ??
    "The agent is waiting for your approval. Nothing runs until you choose, and the turn stays where it is until you do."
  const parameters = buildToolApprovalParameters(rawArgs)

  const toolApprovalStatus: ToolApprovalStatus = isBusy
    ? "approving"
    : resolvedStatus === "always-allowed" || resolvedStatus === "approved"
      ? "approved"
      : resolvedStatus === "denied" || resolvedStatus === "changes-requested"
        ? "denied"
        : "pending"

  const approvalCardStatus: ApprovalCardStatus = isBusy
    ? "submitting"
    : resolvedStatus === "answered"
      ? "answered"
      : resolvedStatus === "approved" || resolvedStatus === "always-allowed"
        ? "approved"
        : resolvedStatus === "changes-requested"
          ? "changes-requested"
          : resolvedStatus === "denied"
            ? "rejected"
            : "pending"

  const submitRevisionFeedback = async () => {
    const trimmed = revisionFeedback.trim()
    if (!trimmed || isBusy) return
    setResolvedStatus("changes-requested")
    await decide.mutateAsync("denied")
    if (onRequestChanges) {
      await onRequestChanges(trimmed)
    }
  }

  return (
    <section
      data-slot="approval-prompt"
      aria-live="polite"
      aria-label="Approval required"
      className="mx-auto w-full max-w-2xl"
    >
      {effectiveMode === "approval-card" ? (
        <ApprovalCard
          title={
            extractedQuestions
              ? toolTitle
              : `Waiting for approval: ${toolTitle}`
          }
          description={toolDescription}
          status={approvalCardStatus}
          questions={extractedQuestions ?? undefined}
          approveLabel="Approve"
          onApprove={() => {
            if (!isBusy) {
              decide.mutate("approved")
            }
          }}
          onReject={() => {
            if (!isBusy) {
              decide.mutate("denied")
            }
          }}
          onRequestChanges={() => {
            if (!isBusy) {
              setShowRevisionEditor((prev) => !prev)
            }
          }}
          onSubmit={
            extractedQuestions
              ? async (answers) => {
                  if (isBusy) return
                  setResolvedStatus("answered")
                  await decide.mutateAsync("approved")
                  if (onSubmitQuestions) {
                    await onSubmitQuestions(answers)
                  }
                }
              : undefined
          }
        >
          {parameters.length > 0 && !extractedQuestions ? (
            <div className="mt-1">
              <ToolApprovalCode
                code={JSON.stringify(rawArgs, null, 2)}
                language="json"
              />
            </div>
          ) : null}
          {showRevisionEditor && !extractedQuestions ? (
            <div className="mt-3 space-y-2 rounded-xl border border-border/60 bg-background/80 p-3">
              <textarea
                rows={2}
                value={revisionFeedback}
                onChange={(event) => setRevisionFeedback(event.target.value)}
                placeholder="Describe what should be changed before running this action…"
                className="w-full resize-none bg-transparent text-xs leading-5 text-foreground outline-none placeholder:text-muted-foreground/70"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => setShowRevisionEditor(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isBusy || !revisionFeedback.trim()}
                  onClick={() => void submitRevisionFeedback()}
                >
                  Send revision
                </Button>
              </div>
            </div>
          ) : null}
        </ApprovalCard>
      ) : (
        <div className="space-y-1.5">
          <ToolApproval
            tool={metadata?.tool ?? "tool_execution"}
            description={`${toolTitle} — ${toolDescription}`}
            parameters={parameters}
            status={toolApprovalStatus}
            defaultOpen={parameters.length > 0 && parameters.length <= 5}
            approveLabel="Approve"
            alwaysAllowLabel="Always allow this action"
            denyLabel="Deny"
            onApprove={() => {
              if (!isBusy) {
                decide.mutate("approved")
              }
            }}
            onDeny={() => {
              if (!isBusy) {
                decide.mutate("denied")
              }
            }}
            onAlwaysAllow={
              metadata?.toolSlug
                ? () => {
                    if (!isBusy && metadata.toolSlug) {
                      alwaysAllow.mutate(metadata.toolSlug)
                    }
                  }
                : undefined
            }
          />
          {toolApprovalStatus === "pending" && !isBusy ? (
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] text-muted-foreground">
                The agent is waiting for your approval (attempt {attempt})
              </span>
              <button
                type="button"
                onClick={() => {
                  setViewOverride("approval-card")
                  setShowRevisionEditor(true)
                }}
                className="text-[11px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Revise with feedback
              </button>
            </div>
          ) : null}
          {isBusy ? (
            <div className="px-1 text-[11px] text-muted-foreground">
              Recording your decision...
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
