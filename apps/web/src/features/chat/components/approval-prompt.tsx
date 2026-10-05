/**
 * A turn that is waiting on a person.
 *
 * The runtime suspends a turn when the model asks for a tool call that policy
 * or a person has to approve. `suspended` is not an error and not a finish: the
 * turn is parked, and it resumes when a decision is recorded. Until this card
 * exists, a suspended turn looked like a request that never came back.
 *
 * The decision itself is recorded server-side. A turn that is waiting on a human
 * must be resolvable after a reload — the runtime holds the request — so this
 * component never treats the decision as local state it can invent.
 */

import {
  AiSecurityIcon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { toast } from "sonner"
import { decideApprovalFn } from "@/features/nabu"
import type { ApprovalDecision } from "@/lib/schemas/agent-stream"
import { chatKeys } from "../queries/chat-queries"

export interface ApprovalPromptProps {
  readonly turnId: string
  /** The approval-request item the runtime is waiting on. */
  readonly itemId: string
  /** Which attempt suspended. Attempts are counted from one. */
  readonly attempt: number
}

export function ApprovalPrompt({
  turnId,
  itemId,
  attempt,
}: ApprovalPromptProps) {
  const queryClient = useQueryClient()

  const decide = useMutation({
    mutationFn: (decision: ApprovalDecision) =>
      decideApprovalFn({
        data: { turnId, itemId, decision },
      }),
    onSuccess: () => {
      // The turn resumes server-side; the transcript is the source of truth, so
      // it is re-read rather than patched locally.
      void queryClient.invalidateQueries({ queryKey: chatKeys.thread(turnId) })
      toast.success("Decision recorded. The turn is resuming.", {
        description: `Attempt ${attempt} continues.`,
      })
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

  return (
    <section
      data-slot="approval-prompt"
      aria-live="polite"
      aria-label="Approval required"
      className="mx-auto w-full max-w-2xl rounded-xl border border-amber-500/40 bg-amber-500/5 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <HugeiconsIcon icon={AiSecurityIcon} size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            The agent is waiting for your approval
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            The model asked to run a tool that needs a decision before it can
            continue. Nothing runs until you choose, and the turn stays exactly
            where it is until you do.
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 pl-11">
        <Button
          type="button"
          size="sm"
          disabled={decide.isPending}
          onClick={() => decide.mutate("approved")}
        >
          {decide.isPending ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={14}
              className="animate-spin"
            />
          ) : (
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} />
          )}
          Approve
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={decide.isPending}
          onClick={() => decide.mutate("denied")}
        >
          Deny
        </Button>
        {decide.isPending ? (
          <span className="text-[11px] text-muted-foreground">
            Recording your decision...
          </span>
        ) : null}
      </div>
    </section>
  )
}
