/**
 * The workspace's saved model providers.
 *
 * The one screen in the product that stores secrets on the tenant's behalf, so
 * two rules run through every line of it:
 *
 * - **The credential is write-only.** It goes out in a `POST` and never comes
 *   back. What renders in its place is the fingerprint — enough to confirm
 *   "the key ending a1b2c3 is the one you pasted", which is the only way to
 *   verify a save without displaying the key.
 * - **The runtime decides, this screen reports.** Whether the vendor is one the
 *   runtime speaks, whether the model id is one that vendor can be asked for,
 *   whether the key is accepted — all of that is answered by the process that
 *   actually holds the credential. This component never guesses and never
 *   explains a refusal the runtime did not word.
 *
 * A workspace may hold several configurations — two OpenAI keys, or one per
 * vendor. One is the default: the one a new conversation starts on, and the one
 * the chat picker preselects. Conversations switch between saved entries from
 * the chat header; this screen is where the list itself is managed.
 */

import {
  Add01Icon,
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
import type { TenantProviderSummary } from "@/lib/schemas/nabu"
import { useConfirmStore } from "@/lib/stores/confirm.store"

import { tenantProviderKeys, tenantProvidersQueryOptions } from "../queries"
import {
  createTenantProviderFn,
  deleteTenantProviderFn,
  setDefaultTenantProviderFn,
  verifyTenantProviderFn,
} from "../tenant-provider.functions"

/**
 * What the add form validates before anything is sent.
 *
 * Deliberately permissive about the model id's *shape* and strict about
 * emptiness. The runtime owns the rules that matter — which vendor a model id
 * belongs to, whether a key can work — and duplicating them here would be a
 * second implementation that disagrees with the first on some vendor's oddity.
 */
const createProviderFormSchema = z.object({
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
  label: z.string().trim().max(64, "That name is too long"),
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
 * Reads the workspace's saved providers, then renders the list.
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
  const { data, isPending } = useQuery(tenantProvidersQueryOptions())

  if (!data) {
    return (
      <section id="provider" aria-labelledby="provider-heading">
        <Card aria-busy={isPending}>
          <CardHeader>
            <CardTitle
              id="provider-heading"
              className="flex items-center gap-2 text-base"
            >
              <HugeiconsIcon icon={CloudServerIcon} size={18} />
              Model providers
            </CardTitle>
            <CardDescription>
              The vendors this workspace's turns run on, the models they ask
              for, and the credentials that pay for them. Each workspace pays
              its own provider bills.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-40 animate-pulse rounded-lg bg-muted/50" />
          </CardContent>
        </Card>
      </section>
    )
  }

  return (
    <ProviderList
      providers={data.providers}
      canAdminister={canAdminister && data.can_administer}
    />
  )
}

/** One saved configuration, as the list renders it. */
function ProviderRow({
  provider,
  canAdminister,
  onAfterChange,
}: {
  provider: TenantProviderSummary
  canAdminister: boolean
  onAfterChange: () => Promise<void>
}) {
  const openConfirm = useConfirmStore((state) => state.openConfirm)
  const [busy, setBusy] = useState(false)

  const invalidate = () => onAfterChange()

  const remove = useMutation({
    mutationFn: () => deleteTenantProviderFn({ data: { id: provider.id } }),
    onSuccess: async () => {
      await invalidate()
      toast.success("Provider removed", {
        description: "Conversations that used it now run on the default.",
      })
    },
    onError: (error: unknown) => {
      toast.error("Could not remove the provider", {
        description: describe(error),
      })
    },
  })

  const makeDefault = useMutation({
    mutationFn: () => setDefaultTenantProviderFn({ data: { id: provider.id } }),
    onSuccess: async () => {
      await invalidate()
      toast.success("Default provider updated", {
        description: "New conversations will start on this one.",
      })
    },
    onError: (error: unknown) => {
      toast.error("Could not change the default provider", {
        description: describe(error),
      })
    },
  })

  const verify = useMutation({
    mutationFn: () => verifyTenantProviderFn({ data: { id: provider.id } }),
    onSuccess: (verified) => {
      if (verified.ok) {
        toast.success("The provider accepted the key", {
          description: verified.message,
        })
        return
      }
      toast.warning("The provider refused the key", {
        description: verified.message,
      })
    },
    onError: (error: unknown) => {
      toast.warning("The provider could not be reached", {
        description: describe(error),
      })
    },
  })

  const handleRemove = async () => {
    const confirmed = await openConfirm({
      title: "Remove this provider?",
      description:
        "Conversations that used it will run on the workspace's default instead. The stored key is deleted.",
      confirmText: "Remove provider",
      variant: "destructive",
    })
    if (!confirmed) return

    setBusy(true)
    try {
      await remove.mutateAsync()
    } catch {
      // `remove`'s own `onError` has already told the user. Swallowing here keeps
      // a rejected confirm-dialog path from producing a second, identical toast.
    } finally {
      setBusy(false)
    }
  }

  const working =
    busy || remove.isPending || makeDefault.isPending || verify.isPending

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span>{provider.label ?? `${provider.model}`}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {provider.model}
          </span>
          {provider.is_default && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              <HugeiconsIcon icon={CheckmarkCircle01Icon} size={12} />
              New chats start here
            </span>
          )}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Key01Icon} size={13} />
          Stored key ends{" "}
          <span className="font-mono">{provider.fingerprint}</span>
        </p>
      </div>

      {canAdminister && (
        <div className="flex flex-wrap items-center gap-2">
          {!provider.is_default && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void makeDefault.mutateAsync()}
              disabled={working}
            >
              {makeDefault.isPending ? (
                <HugeiconsIcon
                  icon={Loading03Icon}
                  size={14}
                  className="animate-spin"
                />
              ) : null}
              Use for new chats
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void verify.mutateAsync()}
            disabled={working}
          >
            {verify.isPending ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                size={14}
                className="animate-spin"
              />
            ) : (
              <HugeiconsIcon icon={RefreshIcon} size={14} />
            )}
            Test
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => void handleRemove()}
            disabled={working}
          >
            {remove.isPending ? (
              <HugeiconsIcon
                icon={Loading03Icon}
                size={14}
                className="animate-spin"
              />
            ) : (
              <HugeiconsIcon icon={Delete02Icon} size={14} />
            )}
            Remove
          </Button>
        </div>
      )}
    </li>
  )
}

/** The list itself, plus the form that adds to it. */
function ProviderList({
  providers,
  canAdminister,
}: {
  providers: TenantProviderSummary[]
  canAdminister: boolean
}) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)

  const invalidate = async () => {
    await queryClient.invalidateQueries({
      queryKey: tenantProviderKeys.list(),
    })
  }

  return (
    <section id="provider" aria-labelledby="provider-heading">
      <Card>
        <CardHeader>
          <CardTitle
            id="provider-heading"
            className="flex items-center gap-2 text-base"
          >
            <HugeiconsIcon icon={CloudServerIcon} size={18} />
            Model providers
          </CardTitle>
          <CardDescription>
            The vendors this workspace's turns run on, the models they ask for,
            and the credentials that pay for them. Each conversation picks its
            provider from the chat; new ones start on the marked entry. Each
            workspace pays its own provider bills.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          {providers.length === 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
              <HugeiconsIcon
                icon={InformationCircleIcon}
                size={18}
                className="mt-0.5 shrink-0 text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                This workspace has no model provider yet, so turns cannot run.
                {canAdminister
                  ? " Add one below to get started."
                  : " An owner or an admin can add one."}
              </p>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {providers.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                canAdminister={canAdminister}
                onAfterChange={invalidate}
              />
            ))}
          </ul>

          {canAdminister &&
            (adding ? (
              <AddProviderForm
                onDone={async (saved) => {
                  setAdding(false)
                  await invalidate()
                  if (saved) {
                    toast.success("Model provider saved", {
                      description: "New conversations start on the default.",
                    })
                  }
                }}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="self-start"
                onClick={() => setAdding(true)}
              >
                <HugeiconsIcon icon={Add01Icon} size={14} />
                Add a provider
              </Button>
            ))}

          {!canAdminister && providers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              You can see which providers this workspace has saved, but only an
              owner or an admin can change them.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

/** The form that adds one configuration. */
function AddProviderForm({
  onDone,
}: {
  /** Whether anything was saved — `false` means the form was dismissed. */
  onDone: (saved: boolean) => Promise<void>
}) {
  const form = useForm({
    defaultValues: {
      provider: "",
      model: "",
      apiKey: "",
      label: "",
    },
    validators: {
      onBlur: createProviderFormSchema,
      onSubmit: createProviderFormSchema,
    },
    onSubmit: async ({ value }) => {
      // Through the mutation, not around it: the mutation owns the invalidation
      // and the dismissal, and a direct call here would save the entry while
      // the screen went on showing a list without it.
      await save.mutateAsync({
        provider: value.provider,
        model: value.model.trim(),
        api_key: value.apiKey.trim(),
        label: value.label.trim() ? value.label.trim() : undefined,
      })
    },
  })

  const save = useMutation({
    mutationFn: async (input: {
      provider: string
      model: string
      api_key: string
      label?: string
    }) => {
      const saved = await createTenantProviderFn({ data: input })
      return saved
    },
    onSuccess: async () => {
      await onDone(true)
    },
    onError: (error: unknown) => {
      toast.error("Could not save the model provider", {
        description: describe(error),
      })
    },
  })

  return (
    <form
      className="flex flex-col gap-6 rounded-lg border border-border bg-muted/30 p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <form.Field name="provider">
        {(field) => (
          <fieldset
            className="grid gap-2"
            aria-invalid={
              field.state.meta.isTouched && field.state.meta.errors.length > 0
            }
          >
            <legend className="text-sm leading-none font-medium">
              Provider
            </legend>
            <p className="text-xs leading-relaxed text-muted-foreground">
              The vendor these turns will run on. The runtime owns each vendor's
              address — there is no URL to paste.
            </p>
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
                    disabled={save.isPending}
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

      <form.Field name="label">
        {(field) => (
          <div className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-start sm:gap-10">
            <div>
              <Label htmlFor="provider-label">Name (optional)</Label>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                How this entry reads in the picker — "Work key", "Backup". Left
                empty, the model id stands in.
              </p>
            </div>
            <Input
              id="provider-label"
              placeholder="Work key"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              disabled={save.isPending}
              aria-invalid={
                field.state.meta.isTouched && field.state.meta.errors.length > 0
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
                The identifier the chosen provider knows it by —{" "}
                <code className="font-mono">gpt-4o-mini</code> for OpenAI,{" "}
                <code className="font-mono">claude-sonnet-4-5</code> for
                Anthropic, a <code className="font-mono">vendor/model</code>{" "}
                pair on OpenRouter.
              </p>
            </div>
            <Input
              id="provider-model"
              placeholder="gpt-4o-mini"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              disabled={save.isPending}
              aria-invalid={
                field.state.meta.isTouched && field.state.meta.errors.length > 0
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
                Stored encrypted and never shown again. Each entry holds its own
                key.
              </p>
            </div>
            <Input
              id="provider-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="sk-…"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              disabled={save.isPending}
              aria-invalid={
                field.state.meta.isTouched && field.state.meta.errors.length > 0
              }
            />
          </div>
        )}
      </form.Field>

      <CardFooter className="flex-wrap justify-end gap-2 border-t border-border px-0 pt-4 pb-0">
        <Button
          type="button"
          variant="ghost"
          onClick={() => void onDone(false)}
          disabled={save.isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={save.isPending}
          onClick={(event) => {
            event.preventDefault()
            void form.handleSubmit()
          }}
        >
          {save.isPending ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={16}
              className="animate-spin"
            />
          ) : null}
          Save provider
        </Button>
      </CardFooter>
    </form>
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
