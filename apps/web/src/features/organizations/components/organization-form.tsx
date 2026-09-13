import {
  AlertCircleIcon,
  Cancel01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm } from "@tanstack/react-form"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"
import { toast } from "sonner"

import { FieldError } from "@/features/auth/components/field-error"
import { slugAvailabilityQueryOptions } from "../queries"
import {
  type CreateOrganizationInput,
  createOrganizationSchema,
  isReservedSlug,
  isValidSlugFormat,
  normalizeSlug,
} from "../schemas"

export interface OrganizationFormProps {
  defaultValues?: {
    name?: string
    slug?: string
  }
  onSubmit: (values: CreateOrganizationInput) => Promise<void> | void
  isSubmitting?: boolean
  submitLabel?: string
  onCancel?: () => void
  className?: string
}

export function OrganizationForm({
  defaultValues,
  onSubmit,
  isSubmitting: externalIsSubmitting,
  submitLabel = "Create Organization",
  onCancel,
  className,
}: OrganizationFormProps) {
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = React.useState(
    Boolean(defaultValues?.slug),
  )
  const [currentSlug, setCurrentSlug] = React.useState(
    defaultValues?.slug ?? "",
  )
  const [debouncedSlug, setDebouncedSlug] = React.useState(
    normalizeSlug(defaultValues?.slug ?? ""),
  )

  // Debounce slug input for server availability query
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSlug(normalizeSlug(currentSlug))
    }, 300)
    return () => clearTimeout(timer)
  }, [currentSlug])

  const isSlugLengthValid = debouncedSlug.length >= 3
  const isSlugFormatValid = isValidSlugFormat(debouncedSlug)
  const isSlugReserved = isReservedSlug(debouncedSlug)

  const { data: availabilityData, isFetching: isCheckingSlug } = useQuery({
    ...slugAvailabilityQueryOptions(debouncedSlug),
    enabled: isSlugLengthValid && isSlugFormatValid && !isSlugReserved,
  })

  const form = useForm({
    defaultValues: {
      name: defaultValues?.name ?? "",
      slug: defaultValues?.slug ?? "",
    } as CreateOrganizationInput,
    validators: {
      onChange: createOrganizationSchema,
    },
    onSubmit: async ({ value }) => {
      const normalized = normalizeSlug(value.slug)
      if (normalized !== debouncedSlug || isCheckingSlug) {
        toast.error("Please wait", {
          description: "Checking slug availability...",
        })
        return
      }

      if (isReservedSlug(normalized)) {
        toast.error("Reserved slug", {
          description: "This URL slug is reserved and cannot be used.",
        })
        return
      }

      if (availabilityData && !availabilityData.available) {
        toast.error("Slug unavailable", {
          description: availabilityData.reason ?? "This slug is already taken.",
        })
        return
      }

      await onSubmit({
        name: value.name.trim(),
        slug: normalized,
        logo: value.logo ?? null,
      })
    },
  })

  const isDebouncing = normalizeSlug(currentSlug) !== debouncedSlug

  // Derive slug availability status
  let slugStatusBadge: React.ReactNode = null
  const isAvailable =
    !isDebouncing &&
    availabilityData?.available === true &&
    !isCheckingSlug &&
    isSlugFormatValid &&
    !isSlugReserved

  if (currentSlug.length > 0) {
    if (isCheckingSlug || isDebouncing) {
      slugStatusBadge = (
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <HugeiconsIcon
            icon={Loading03Icon}
            size={14}
            className="animate-spin"
          />
          Checking availability…
        </span>
      )
    } else if (isSlugReserved) {
      slugStatusBadge = (
        <span
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
          Reserved slug
        </span>
      )
    } else if (currentSlug.length < 3) {
      slugStatusBadge = (
        <span className="text-xs text-muted-foreground">
          Minimum 3 characters
        </span>
      )
    } else if (!isSlugFormatValid) {
      slugStatusBadge = (
        <span
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <HugeiconsIcon icon={AlertCircleIcon} size={14} />
          Lowercase letters, numbers, and hyphens only
        </span>
      )
    } else if (availabilityData?.available === false) {
      slugStatusBadge = (
        <span
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
          {availabilityData.reason ?? "Slug is already taken"}
        </span>
      )
    } else if (isAvailable) {
      slugStatusBadge = (
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium"
        >
          <HugeiconsIcon icon={Tick02Icon} size={14} />
          Slug is available
        </span>
      )
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-5", className)}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      {/* Organization Name Field */}
      <form.Field name="name">
        {(field) => (
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-form-name">Organization Name</Label>
            <Input
              id="org-form-name"
              name={field.name}
              placeholder="Acme Corp"
              required
              autoFocus
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(e) => {
                const newName = e.target.value
                field.handleChange(newName)

                // Auto-generate slug if user hasn't manually edited it
                if (!isSlugManuallyEdited) {
                  const generatedSlug = normalizeSlug(newName)
                  form.setFieldValue("slug", generatedSlug)
                  setCurrentSlug(generatedSlug)
                }
              }}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      {/* Organization Slug Field */}
      <form.Field name="slug">
        {(field) => (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="org-form-slug">Workspace URL</Label>
              {slugStatusBadge}
            </div>
            <div className="relative flex items-center">
              <span className="pointer-events-none absolute left-3 select-none text-xs text-muted-foreground font-mono">
                fenr.app/
              </span>
              <Input
                id="org-form-slug"
                name={field.name}
                className="pl-20 font-mono text-sm"
                placeholder="acme"
                required
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => {
                  const newSlug = e.target.value.toLowerCase()
                  setIsSlugManuallyEdited(true)
                  field.handleChange(newSlug)
                  setCurrentSlug(newSlug)
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Unique identifier used in workspace URLs.
            </p>
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      {/* Action Buttons */}
      <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
        {([canSubmit, isSubmitting]) => {
          const loading = externalIsSubmitting || isSubmitting
          const slugBlocked =
            Boolean(currentSlug) &&
            (!isSlugLengthValid ||
              !isSlugFormatValid ||
              isSlugReserved ||
              availabilityData?.available === false ||
              isCheckingSlug ||
              isDebouncing)

          return (
            <div className="flex items-center justify-end gap-3 pt-2">
              {onCancel && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                disabled={!canSubmit || loading || slugBlocked}
                className="min-w-28"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={16}
                      className="animate-spin"
                    />
                    Saving…
                  </span>
                ) : (
                  submitLabel
                )}
              </Button>
            </div>
          )
        }}
      </form.Subscribe>
    </form>
  )
}
