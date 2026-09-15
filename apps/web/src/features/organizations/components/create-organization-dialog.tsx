import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"
import {
  CenterMorphModal,
  CenterMorphModalContent,
} from "@workspace/ui/components/center-morph-modal"
import * as React from "react"
import { toast } from "sonner"

import type { CreateOrganizationInput } from "@/lib/schemas/organizations"
import { invalidateOrganizationQueries } from "../queries"
import { createOrganizationFn } from "../server"
import { OrganizationForm } from "./organization-form"

export interface CreateOrganizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (org: { id: string; name: string; slug: string }) => void
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateOrganizationDialogProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleSubmit = async (values: CreateOrganizationInput) => {
    setIsSubmitting(true)
    try {
      const createdOrg = await createOrganizationFn({ data: values })
      toast.success("Organization created", {
        description: `Switched to ${createdOrg.name}.`,
      })
      onOpenChange(false)
      onSuccess?.(createdOrg)

      try {
        await invalidateOrganizationQueries(queryClient, createdOrg.id)
        await router.invalidate()
      } catch {
        // Best-effort cache invalidation
      }
    } catch {
      toast.error("Failed to create organization", {
        description: "The organization could not be created. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CenterMorphModal open={open} onOpenChange={onOpenChange}>
      <CenterMorphModalContent
        ariaLabel="Create Organization"
        className="flex flex-col gap-4 p-6 sm:max-w-md"
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Create Organization
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Create a new workspace to collaborate with teammates and manage
            documents.
          </p>
        </div>

        <div className="pt-2">
          <OrganizationForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Create Organization"
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </CenterMorphModalContent>
    </CenterMorphModal>
  )
}
