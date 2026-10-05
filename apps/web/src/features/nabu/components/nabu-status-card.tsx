/**
 * What the agent runtime can currently do.
 *
 * Shown on the dashboard so the deployment's real limits are visible before a
 * conversation starts. It used to drive two endpoints the runtime never served —
 * a reconciliation match and an agent task dispatch — so both buttons failed;
 * the runtime replaced them with turns, capabilities and approvals.
 */

import {
  Activity01Icon,
  CheckmarkCircle02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  nabuCapabilitiesQueryOptions,
  nabuSystemStatusQueryOptions,
} from "../queries"

export function NabuStatusCard() {
  const {
    data: status,
    isLoading,
    isError,
  } = useQuery(nabuSystemStatusQueryOptions())

  // Capabilities are fetched separately so an unavailable capability report does
  // not also hide whether the engine is reachable at all.
  const { data: capabilities } = useQuery(nabuCapabilitiesQueryOptions())

  return (
    <Card>
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
          Conversational agent runtime with durable turns
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
            Nabu runs conversation turns durably: a turn survives a disconnect,
            and a turn that needs a person waits for one instead of guessing.
          </p>
        )}

        {capabilities ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border p-2">
              <span className="text-muted-foreground block">Tools</span>
              <span className="font-mono font-medium">
                {capabilities.tools.length > 0
                  ? capabilities.tools.join(", ")
                  : "none"}
              </span>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground block">Attempts</span>
              <span className="font-mono font-medium">
                {capabilities.max_attempts}
              </span>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground block">
                Model steps / attempt
              </span>
              <span className="font-mono font-medium">
                {capabilities.max_model_steps}
              </span>
            </div>
            <div className="rounded border p-2">
              <span className="text-muted-foreground block">On disconnect</span>
              <span className="font-mono font-medium">
                {capabilities.detach_on_disconnect ? "detaches" : "ends turn"}
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
