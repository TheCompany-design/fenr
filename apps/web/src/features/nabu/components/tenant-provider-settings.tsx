/**
 * The workspace's own model provider: which vendor, which model, and which
 * credential.
 *
 * The one screen in the product that stores a secret on the tenant's behalf, so
 * two rules run through every line of it:
 *
 * - **The credential is write-only.** It goes out in a `PUT` and never comes
 *   back. What renders in its place is the fingerprint — enough to confirm
 *   "the key ending a1b2c3 is the one you pasted", which is the only way to
 *   verify a save without displaying the key.
 * - **The runtime decides, this screen reports.** Whether the vendor is one the
 *   runtime speaks, whether the model id is one that vendor can be asked for,
 *   whether the key is accepted — all of that is answered by the process that
 *   actually holds the credential. This component never guesses and never
 *   explains a refusal the runtime did not word. There is no endpoint field any
 *   more: each vendor's address is the runtime's own constant, so the picker
 *   below is the whole of what a workspace chooses.
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import type { TenantProvider } from "@/lib/schemas/nabu"
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
 * Deliberately permissive about the model id's *shape* and strict about
 * emptiness. The runtime owns the rules that matter — which vendor a model id
 * belongs to, whether a key can work — and duplicating them here would be a
 * second implementation that disagrees with the first on some vendor's oddity.
 */
const providerFormSchema = z.object({
  provider: z.string().min(1, "Choose a provider"),
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

/**
 * The vendors a workspace can choose between.
 *
 * The menu, not the law: the runtime owns the closed set and answers an
 * unknown name with a `400` naming it. Rendering the four by name is how a
 * workspace picks one without ever seeing an address.
 */
const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI", hint: "gpt-4o-mini" },
  { value: "openrouter", label: "OpenRouter", hint: "vendor/model" },
  { value: "anthropic", label: "Anthropic", hint: "claude-sonnet-4-5" },
  { value: "google", label: "Google Gemini", hint: "gemini-2.5-flash" },
]

export interface TenantProviderSettingsProps {
  /** Whether the viewer may change any of this. */
  canAdminister: boolean
}

/**
 * Reads the workspace's provider, then renders the form.
 *
 * Split from the form on purpose. `useForm` reads `defaultValues` only when it
 * first mounts, so the component that creates the form must only mount once the
 * data exists — one component doing both either suspends (and a suspended subtree
 * never gets its submit handler attached, so the button did a native GET and
 * saved nothing) or has to re-seed imperatively, which empties the fields the
 * moment a save succeeds.
 */
export function TenantProviderSettings({
  canAdminister,
}: TenantProviderSettingsProps) {
  // `useQuery`, never `useSuspenseQuery`. Suspending here is what broke the whole
  // screen: the server ships this form's HTML, but the client subtree stays
  // suspended waiting for data it does not have, so React never attaches the
  // form's submit handler and the button performs a native GET instead.
  const { data: provider, isPending } = useQuery(tenantProviderQueryOptions())

  if (!provider) {
    return (
      <section id="provider" aria-labelledby="provider-heading">
        <Card aria-busy={isPending}>
          <CardHeader>
            <CardTitle
              id="provider-heading"
              className="flex items-center gap-2 text-base"
            >
              <HugeiconsIcon icon={CloudServerIcon} size={18} />
              Model provider
            </CardTitle>
            <CardDescription>
              The OpenAI-compatible endpoint this workspace&rsquo;s turns run
              on, and the credential it authenticates with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-40 animate-pulse rounded-lg bg-muted/50" />
          </CardContent>
        </Card>
      </section>
    )
  }

  return <ProviderForm provider={provider} canAdminister={canAdminister} />
}

/** The form itself, mounted only once the stored configuration is known. */
function ProviderForm({
  provider,
  canAdminister,
}: {
  provider: TenantProvider
  canAdminister: boolean
}) {
  const queryClient = useQueryClient()
  const openConfirm = useConfirmStore((state) => state.openConfirm)
  const [justSaved, setJustSaved] = useState(false)

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
    // Read once, when this form first mounts — which, because of the split above,
    // is after the read has landed. Never re-seeded when the query changes: a
    // save refetches, and re-seeding on that empties the fields at the exact
    // moment somebody is reading whether it worked.
    defaultValues: {
      provider: provider.provider,
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
          provider: value.provider,
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
      form.reset({ provider: "", model: "", apiKey: "" })
    } catch {
      // `remove`'s own `onError` has already told the user. Swallowing here keeps
      // a rejected confirm-dialog path from producing a second, identical toast.
    }
  }

  const handleVerify = async () => {
    const verified = await verifyTenantProviderFn()
    if (verified.ok) {
      toast.success("The provider accepted the key", {
        description: verified.message,
      })
      return
    }
    toast.warning("The provider refused the key", {
      description: verified.message,
    })
  }

  const readOnly = !canAdminister
  const fingerprint = provider.fingerprint
  const configured = provider.configured

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
              The vendor this workspace's turns run on, the model they ask for,
              and the credential that pays for them. Each workspace pays its own
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

            <form.Field name="provider">
              {(field) => (
                <fieldset
                  className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10"
                  aria-invalid={
                    field.state.meta.isTouched &&
                    field.state.meta.errors.length > 0
                  }
                >
                  <div>
                    <legend className="text-sm leading-none font-medium">
                      Provider
                    </legend>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      The vendor these turns run on. The runtime owns each
                      vendor's address — there is no URL to paste.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {PROVIDER_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className="flex cursor-pointer flex-col gap-0.5 rounded-lg border border-input bg-transparent px-3 py-2 text-sm transition-colors select-none hover:bg-accent/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 has-[:checked]:border-ring has-[:checked]:bg-accent aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
                      >
                        <input
                          type="radio"
                          name="provider"
                          value={option.value}
                          checked={field.state.value === option.value}
                          onBlur={field.handleBlur}
                          onChange={() => field.handleChange(option.value)}
                          disabled={readOnly || save.isPending}
                          className="sr-only"
                        />
                        <span className="font-medium">{option.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {option.hint}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </form.Field>

            <form.Field name="model">
              {(field) => (
                <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10">
                  <div>
                    <Label htmlFor="provider-model">Model</Label>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      The identifier the chosen provider knows it by —{" "}
                      <code className="font-mono">gpt-4o-mini</code> for OpenAI,{" "}
                      <code className="font-mono">claude-sonnet-4-5</code> for
                      Anthropic, a{" "}
                      <code className="font-mono">vendor/model</code> pair on
                      OpenRouter.
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
