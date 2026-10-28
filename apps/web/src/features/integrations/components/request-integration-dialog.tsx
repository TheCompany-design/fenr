import { useQueryState } from "nuqs"
import { toast } from "sonner"

import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import { Textarea } from "@workspace/ui/components/textarea"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useMutation } from "@tanstack/react-query"
import { useState } from "react"

import { requestIntegrationFn } from "../api/integrations.functions"

const PRIORITIES = ["low", "normal", "high"] as const

export function RequestIntegrationDialog() {
  const [open, setOpen] = useQueryState("request")
  const [appName, setAppName] = useState("")
  const [appUrl, setAppUrl] = useState("")
  const [useCase, setUseCase] = useState("")
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>("normal")

  const request = useMutation({
    mutationFn: () =>
      requestIntegrationFn({
        data: {
          requestedAppName: appName.trim(),
          requestedAppUrl: appUrl.trim() === "" ? undefined : appUrl.trim(),
          useCaseDescription: useCase.trim(),
          priority,
        },
      }),
    onSuccess: () => {
      toast.success("Request submitted", {
        description: `${appName.trim()} is now on the workspace's integration wishlist.`,
      })
      setOpen(null)
      setAppName("")
      setAppUrl("")
      setUseCase("")
      setPriority("normal")
    },
    onError: (error) => {
      toast.error("Couldn't submit the request", {
        description:
          error instanceof Error ? error.message : "Something went wrong.",
      })
    },
  })

  const valid =
    appName.trim().length > 0 &&
    useCase.trim().length > 0 &&
    (appUrl.trim() === "" || appUrl.startsWith("https://"))

  return (
    <Popover
      open={open === "1"}
      onOpenChange={(next) => setOpen(next ? "1" : null)}
    >
      <PopoverTrigger
        render={
          <Button size="sm">
            <HugeiconsIcon icon={Add01Icon} size={16} />
            Request
          </Button>
        }
      />
      <PopoverContent align="end" className="w-96">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) {
              request.mutate()
            }
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="integration-request-name">App name</Label>
            <Input
              id="integration-request-name"
              placeholder="e.g. Airtable"
              value={appName}
              onChange={(event) => setAppName(event.target.value)}
              maxLength={120}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="integration-request-url">App URL (optional)</Label>
            <Input
              id="integration-request-url"
              placeholder="https://example.com"
              value={appUrl}
              onChange={(event) => setAppUrl(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="integration-request-use-case">
              What would the workspace use it for?
            </Label>
            <Textarea
              id="integration-request-use-case"
              placeholder="Describe the workflows this app would unlock…"
              value={useCase}
              onChange={(event) => setUseCase(event.target.value)}
              rows={4}
              maxLength={2000}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" type="button" />}
            >
              Priority: {priority}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {PRIORITIES.map((level) => (
                <DropdownMenuItem
                  key={level}
                  onClick={() => setPriority(level)}
                >
                  {level}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="submit" disabled={!valid || request.isPending}>
            {request.isPending ? "Submitting…" : "Submit request"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
