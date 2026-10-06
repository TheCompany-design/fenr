/**
 * The workspace's own model provider: endpoint, model, and credential.
 *
 * The one screen in the product that stores a secret on the tenant's behalf, so
 * two rules run through every line of it:
 *
 * - **The credential is write-only.** It goes out in a `PUT` and never comes
 *   back. What renders in its place is the fingerprint — enough to confirm
 *   "the key ending a1b2c3 is the one you pasted", which is the only way to
 *   verify a save without displaying the key.
 * - **The runtime decides, this screen reports.** Whether the endpoint is
 *   reachable, whether the key is accepted, whether the address is one the
 *   runtime will dial — all of that is answered by the process that actually
 *   holds the credential and the egress guard. This component never guesses and
 *   never explains a refusal the runtime did not word.
 */

import {
  CheckmarkCircle01Icon,
  CloudServerIcon,
  Delete02Icon,
  InformationCircleIcon,
  Key01Icon,
  Loading03Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { useState } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { useConfirmStore } from "@/lib/stores/confirm.store"

import { tenantProviderKeys, tenantProviderQueryOptions } from "../queries"
import {
  deleteTenantProviderFn,
  putTenantProviderFn,
  verifyTenantProviderFn,
} from "../tenant-provider.functions"

/**
 * What the form validates before anything is sent.
 *
 * Deliberately permissive about the endpoint's *shape* and strict about its
 * emptiness. The runtime owns the rules that matter — scheme, host, credentials
 * in the URL — and duplicating them here would be a second implementation that
 * disagrees with the first on some provider's oddity.
 */
const providerFormSchema = z.object({
  baseUrl: z
    .string()
    .trim()
    .min(1, "An endpoint is required")
    .max(2048, "That endpoint is implausibly long"),
  model: z
    .string()
    .trim()
    .min(1, "A model id is required")
    .max(256, "That model id is implausibly long"),
  apiKey: z
    .string()
    .trim()
    .min(1, "An API key is required")
    .max(4096, "That key is implausibly long"),
})

export interface TenantProviderSettingsProps {
  /** Whether the viewer may change any of this. */
  canAdminister: boolean
}

export function TenantProviderSettings({
  canAdminister,
}: TenantProviderSettingsProps) {
  const queryClient = useQueryClient()
  const openConfirm = useConfirmStore((state) => state.openConfirm)
  const [justSaved, setJustSaved] = useState(false)

  const { data: provider } = useSuspenseQuery(tenantProviderQueryOptions())

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: tenantProviderKeys.detail() })

  const save = useMutation({
    mutationFn: putTenantProviderFn,
    onSuccess: async (saved) => {
      setJustSaved(true)
      await invalidate()
      // The model is named in the confirmation because it is the one thing a
      // user genuinely needs to know changed. The fingerprint is not: it is six
      // hex digits and means nothing to the person who pasted the key.
      toast.success("Model provider saved", {
        description: `Turns in this workspace will now run on ${saved.model}.`,
      })
    },
    onError: (error: unknown) => {
      toast.error("Could not save the model provider", {
        description: describe(error),
      })
    },
  })

  const remove = useMutation({
    mutationFn: deleteTenantProviderFn,
    onSuccess: async () => {
      setJustSaved(false)
      await invalidate()
      toast.success("Model provider removed", {
        description: "This workspace has no provider until one is configured.",
      })
    },
    onError: (error: unknown) => {
      toast.error("Could not remove the model provider", {
        description: describe(error),
      })
    },
  })

  const form = useForm({
    defaultValues: {
      baseUrl: provider.base_url,
      model: provider.model,
      // Never pre-filled from the stored value: there is none. The field stays
      // empty and the placeholder tells the reader a key *is* stored.
      apiKey: "",
    },
    validators: {
      onBlur: providerFormSchema,
      onSubmit: providerFormSchema,
    },
    onSubmit: async ({ value }) => {
      await save.mutateAsync({
        data: {
          base_url: value.baseUrl.trim(),
          model: value.model.trim(),
          api_key: value.apiKey.trim(),
        },
      })
    },
  })

  const handleRemove = async () => {
    const confirmed = await openConfirm({
      title: "Remove the model provider?",
      description:
        "Turns in this workspace will stop until someone configures another one. Conversations are not affected.",
      confirmText: "Remove provider",
      variant: "destructive",
    })
    if (!confirmed) return

    try {
      await remove.mutateAsync()
      form.reset({ baseUrl: "", model: "", apiKey: "" })
    } catch {
      // `remove`'s own `onError` has already told the user. Swallowing here keeps
      // a rejected confirm-dialog path from producing a second, identical toast.
    }
  }

  const handleVerify = async () => {
    const verified = await verifyTenantProviderFn()
    if (verified.ok) {
      toast.success("Endpoint reachable", {
        description: verified.message,
      })
      return
    }
    toast.warning("The endpoint refused the key", {
      description: verified.message,
    })
  }

  const configured = provider.configured
  const fingerprint = provider.fingerprint
  const readOnly = !canAdminister

  return (
    <section id="provider" aria-labelledby="provider-heading">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle
              id="provider-heading"
              className="flex items-center gap-2 text-base"
            >
              <HugeiconsIcon icon={CloudServerIcon} size={18} />
              Model provider
            </CardTitle>
            <CardDescription>
              The OpenAI-compatible endpoint this workspace's turns run on, and
              the credential it authenticates with. Each workspace pays its own
              provider bill.
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col gap-8">
            {!configured && (
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  size={18}
                  className="mt-0.5 shrink-0 text-muted-foreground"
                />
                <p className="text-sm text-muted-foreground">
                  This workspace has no model provider yet, so turns cannot run.
                  Configure one below to get started.
                </p>
              </div>
            )}

            <form.Field name="baseUrl">
              {(field) => (
                <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10">
                  <div>
                    <Label htmlFor="provider-base-url">Endpoint</Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Any OpenAI-compatible base URL. A bare host or a{" "}
                      <code className="font-mono">/v1</code> base both work; a
                      pasted{" "}
                      <code className="font-mono">/chat/completions</code> is
                      trimmed for you.
                    </p>
                  </div>
                  <Input
                    id="provider-base-url"
                    type="url"
                    placeholder="https://api.openai.com/v1"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={readOnly || save.isPending}
                    aria-invalid={
                      field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0
                    }
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="model">
              {(field) => (
                <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10">
                  <div>
                    <Label htmlFor="provider-model">Model</Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      The identifier your provider knows it by. Gateways use
                      names like <code className="font-mono">vendor/model</code>
                      .
                    </p>
                  </div>
                  <Input
                    id="provider-model"
                    placeholder="gpt-4o-mini"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    disabled={readOnly || save.isPending}
                    aria-invalid={
                      field.state.meta.isTouched &&
                      field.state.meta.errors.length > 0
                    }
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="apiKey">
              {(field) => (
                <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10">
                  <div>
                    <Label htmlFor="provider-api-key">API key</Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Stored encrypted and never shown again. Saving replaces it
                      outright.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Input
                      id="provider-api-key"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={
                        configured
                          ? `A key is stored (ending ${fingerprint}) — type to replace it`
                          : "sk-…"
                      }
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) =>
                        field.handleChange(event.target.value)
                      }
                      disabled={readOnly || save.isPending}
                      aria-invalid={
                        field.state.meta.isTouched &&
                        field.state.meta.errors.length > 0
                      }
                    />
                    {configured && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <HugeiconsIcon icon={Key01Icon} size={13} />
                        Stored key ends{" "}
                        <span className="font-mono">{fingerprint}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </form.Field>

            {readOnly && (
              <p className="text-xs text-muted-foreground">
                You can see which provider this workspace uses, but only an
                owner or an admin can change it.
              </p>
            )}
          </CardContent>

          <CardFooter className="flex-wrap justify-end gap-2 border-t border-border pt-6">
            {configured && canAdminister && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => void handleRemove()}
                disabled={remove.isPending || save.isPending}
              >
                {remove.isPending ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    size={16}
                    className="animate-spin"
                  />
                ) : (
                  <HugeiconsIcon icon={Delete02Icon} size={16} />
                )}
                Remove
              </Button>
            )}

            {configured && canAdminister && (
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleVerify()}
                disabled={save.isPending || remove.isPending}
              >
                <HugeiconsIcon icon={RefreshIcon} size={16} />
                Test connection
              </Button>
            )}

            <Button
              type="submit"
              disabled={readOnly || save.isPending || remove.isPending}
            >
              {save.isPending ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={16}
                  className="animate-spin"
                />
              ) : justSaved ? (
                <HugeiconsIcon icon={CheckmarkCircle01Icon} size={16} />
              ) : null}
              {configured ? "Save changes" : "Save provider"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </section>
  )
}

/**
 * A sentence to show, preferring the runtime's own wording.
 *
 * The runtime words its refusals for a person reading them, and a wrapper that
 * replaced those with its own generic text would throw away the only useful part
 * — *which* field was wrong. Anything unrecognised falls back to something honest
 * rather than something confident.
 */
function describe(error: unknown): string {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message)
      : "Please check the values and try again."

  if (!message) return "Please check the values and try again."
  return message
}
