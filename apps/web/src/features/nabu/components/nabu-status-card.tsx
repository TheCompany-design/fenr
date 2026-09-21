import {
  Activity01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { toast } from "sonner"
import {
  dispatchAgentTaskFn,
  matchInflowReconciliationFn,
} from "../nabu.functions"
import { nabuSystemStatusQueryOptions } from "../queries"

export function NabuStatusCard() {
  const queryClient = useQueryClient()
  const {
    data: status,
    isLoading,
    isError,
    refetch,
  } = useQuery(nabuSystemStatusQueryOptions())

  const matchMutation = useMutation({
    mutationFn: async () => {
      return matchInflowReconciliationFn({
        data: {
          transaction_id: `tx_${Date.now()}`,
          amount: 1500,
          currency: "KES",
          reference: "INV-2026-004",
          sender_name: "Acme Studio",
        },
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: nabuSystemStatusQueryOptions().queryKey,
      })
      toast.success(
        `Matched: ${result.invoice_number} (${result.match_status})`,
        {
          description: result.reasons.join(" • "),
        },
      )
    },
    onError: () => {
      toast.error("Reconciliation failed", {
        description:
          "Nabu could not complete the reconciliation. Please try again. If the problem continues, contact support.",
      })
    },
  })

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      return dispatchAgentTaskFn({
        data: {
          prompt: "Scan overdue invoices and prepare reconciliation report",
          task_type: "receivables_audit",
          dry_run: true,
        },
      })
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({
        queryKey: nabuSystemStatusQueryOptions().queryKey,
      })
      toast.success("Agent task completed", {
        description: `${result.summary} (analyzed ${result.items_analyzed} items in ${result.execution_time_ms}ms)`,
      })
    },
    onError: () => {
      toast.error("Agent task failed", {
        description:
          "Nabu could not complete the agent task. Please try again. If the problem continues, contact support.",
      })
    },
  })

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={Activity01Icon}
              size={18}
              className="text-primary"
            />
            <CardTitle className="text-base">thebookofnabu Engine</CardTitle>
          </div>
          {isLoading ? (
            <Badge variant="outline" className="gap-1 font-normal">
              <HugeiconsIcon
                icon={Loading03Icon}
                size={12}
                className="animate-spin"
              />
              Checking
            </Badge>
          ) : isError ? (
            <Badge variant="destructive">Unavailable</Badge>
          ) : (
            <Badge
              variant="secondary"
              className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            >
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={12} />
              {status?.status ?? "Unknown"}
            </Badge>
          )}
        </div>
        <CardDescription>
          Sub-ledger reconciliation and operational agent runtime
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {status ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border p-2">
              <span className="text-muted-foreground block">Version</span>
              <span className="font-mono font-medium">{status.version}</span>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground block">Database</span>
              <span className="font-mono font-medium capitalize">
                {status.database}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Nabu provides automated sub-ledger reconciliation and operational
            agent runs. Click below to test reconciliation or dispatch an agent
            task.
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => matchMutation.mutate()}
            disabled={matchMutation.isPending}
            className="flex-1 text-xs"
          >
            {matchMutation.isPending ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  className="mr-1 animate-spin"
                />
                Matching...
              </>
            ) : (
              "Test Reconciliation"
            )}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => dispatchMutation.mutate()}
            disabled={dispatchMutation.isPending}
            className="flex-1 text-xs"
          >
            {dispatchMutation.isPending ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  className="mr-1 animate-spin"
                />
                Running...
              </>
            ) : (
              "Dispatch Task"
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="text-xs"
          >
            Ping
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
