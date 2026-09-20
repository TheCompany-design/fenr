import {
  Activity01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { useState } from "react"
import { toast } from "sonner"

import {
  dispatchAgentTaskFn,
  matchInflowReconciliationFn,
  nabuSystemStatusQueryOptions,
} from "../index"

export function NabuStatusCard() {
  const {
    data: status,
    isLoading,
    isError,
    refetch,
  } = useQuery(nabuSystemStatusQueryOptions())
  const [isMatching, setIsMatching] = useState(false)
  const [isDispatching, setIsDispatching] = useState(false)

  const handleTestReconciliation = async () => {
    if (isMatching) return
    setIsMatching(true)
    try {
      const result = await matchInflowReconciliationFn({
        data: {
          transaction_id: `tx_${Date.now()}`,
          amount: 1500,
          currency: "KES",
          reference: "INV-2026-004",
          sender_name: "Acme Studio",
        },
      })
      toast.success(
        `Matched: ${result.invoice_number} (${result.match_status})`,
        {
          description: result.reasons.join(" • "),
        },
      )
    } catch (err) {
      toast.error("Reconciliation failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsMatching(false)
    }
  }

  const handleDispatchTask = async () => {
    if (isDispatching) return
    setIsDispatching(true)
    try {
      const result = await dispatchAgentTaskFn({
        data: {
          prompt: "Scan overdue invoices and prepare reconciliation report",
          task_type: "receivables_audit",
          dry_run: true,
        },
      })
      toast.success("Agent task completed", {
        description: `${result.summary} (analyzed ${result.items_analyzed} items in ${result.execution_time_ms}ms)`,
      })
    } catch (err) {
      toast.error("Agent task failed", {
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setIsDispatching(false)
    }
  }

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
            <Badge variant="destructive" className="font-normal">
              Offline
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 font-normal">
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                size={12}
                className="text-primary"
              />
              v{status?.version ?? "0.1.0"}
            </Badge>
          )}
        </div>
        <CardDescription>
          Live communication between Fenr and the Rust agent runtime.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <div className="rounded-md border border-border/50 bg-muted/40 p-2.5 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Database Connection:</span>
            <span className="font-medium text-foreground capitalize">
              {status?.database ?? (isError ? "disconnected" : "pending")}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-muted-foreground">
            <span>Target Port:</span>
            <span className="font-mono text-foreground">5050 (Axum)</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestReconciliation}
            disabled={isMatching}
            className="flex-1 text-xs"
          >
            {isMatching ? (
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
            onClick={handleDispatchTask}
            disabled={isDispatching}
            className="flex-1 text-xs"
          >
            {isDispatching ? (
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
