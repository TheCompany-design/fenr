import {
  AlertCircleIcon,
  Cancel01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useForm, useStore } from "@tanstack/react-form"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"
import { cn } from "@workspace/ui/lib/utils"
import * as React from "react"

import { FieldError } from "@/features/auth/components/field-error"
import {
  type CreateOrganizationInput,
  createOrganizationSchema,
  isReservedSlug,
  isValidSlugFormat,
  normalizeSlug,
} from "../schemas"
import { checkSlugAvailabilityFn } from "../server"

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
  const isSlugManuallyEditedRef = React.useRef(Boolean(defaultValues?.slug))

  const form = useForm({
    defaultValues: {
      name: defaultValues?.name ?? "",
      slug: defaultValues?.slug ?? "",
    } as CreateOrganizationInput,
    validators: {
      onBlur: createOrganizationSchema,
      onSubmit: createOrganizationSchema,
    },
    onSubmit: async ({ value }) => {
      const normalized = normalizeSlug(value.slug)
      await onSubmit({
        name: value.name.trim(),
        slug: normalized,
        logo: value.logo ?? null,
      })
    },
  })

  const currentSlug = useStore(form.store, (state) => state.values.slug)
  const slugMeta = useStore(form.store, (state) => state.fieldMeta.slug)
  const isSlugLengthValid = currentSlug.length >= 3
  const normalizedSlug = normalizeSlug(currentSlug)
  const isSlugFormatValid = isValidSlugFormat(normalizedSlug)
  const isSlugReserved = isReservedSlug(normalizedSlug)
  const isCheckingSlug = slugMeta?.isValidating ?? false
  const showSlugValidation = slugMeta?.isTouched === true
  const slugError = slugMeta?.errors[0]
  const slugErrorMessage =
    typeof slugError === "string"
      ? slugError
      : slugError && typeof slugError === "object" && "message" in slugError
        ? String(slugError.message)
        : "Invalid workspace URL"

  // Derive slug availability status
  let slugStatusBadge: React.ReactNode = null
  const isAvailable =
    slugMeta?.isDirty === true &&
    slugMeta.isValid === true &&
    !isCheckingSlug &&
    isSlugFormatValid &&
    !isSlugReserved

  if (currentSlug.length > 0) {
    if (isCheckingSlug) {
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
    } else if (showSlugValidation && isSlugReserved) {
      slugStatusBadge = (
        <span
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
          Reserved slug
        </span>
      )
    } else if (showSlugValidation && currentSlug.length < 3) {
      slugStatusBadge = (
        <span className="text-xs text-muted-foreground">
          Minimum 3 characters
        </span>
      )
    } else if (showSlugValidation && !isSlugFormatValid) {
      slugStatusBadge = (
        <span
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <HugeiconsIcon icon={AlertCircleIcon} size={14} />
          Lowercase letters, numbers, and hyphens only
        </span>
      )
    } else if (showSlugValidation && slugError) {
      slugStatusBadge = (
        <span
          role="alert"
          className="flex items-center gap-1.5 text-xs text-destructive"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={14} />
          {slugErrorMessage}
        </span>
      )
    } else if (isAvailable) {
      slugStatusBadge = (
        <span
          role="status"
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs text-foreground font-medium"
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
                if (!isSlugManuallyEditedRef.current) {
                  const generatedSlug = normalizeSlug(newName)
                  form.setFieldValue("slug", generatedSlug)
                }
              }}
            />
            <FieldError field={field} />
          </div>
        )}
      </form.Field>

      {/* Organization Slug Field */}
      <form.Field
        name="slug"
        asyncDebounceMs={300}
        validators={{
          onChangeAsync: async ({ value }) => {
            const normalized = normalizeSlug(value)
            if (!isValidSlugFormat(normalized) || isReservedSlug(normalized)) {
              return undefined
            }

            const availability = await checkSlugAvailabilityFn({
              data: { slug: normalized },
            })
            return availability.available ? undefined : availability.reason
          },
        }}
      >
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
                  isSlugManuallyEditedRef.current = true
                  field.handleChange(newSlug)
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
              slugMeta?.isValid === false ||
              isCheckingSlug ||
              Boolean(slugError))

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
