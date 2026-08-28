"use client"

import {
  Alert02Icon,
  HelpCircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@workspace/ui/components/button"
import {
  CenterMorphModal,
  CenterMorphModalContent,
} from "@workspace/ui/components/center-morph-modal"
import { cn } from "@workspace/ui/lib/utils"
import { useCallback } from "react"
import { useConfirmStore } from "./confirm.store"

/**
 * Global confirmation modal component.
 *
 * Mounts once at the root level (in `__root.tsx`) and is driven dynamically
 * by the `useConfirm` hook and `useConfirmStore`.
 */
export function ConfirmDialogRoot() {
  const isOpen = useConfirmStore((state) => state.isOpen)
  const isLoading = useConfirmStore((state) => state.isLoading)
  const title = useConfirmStore((state) => state.title)
  const description = useConfirmStore((state) => state.description)
  const confirmText = useConfirmStore((state) => state.confirmText)
  const cancelText = useConfirmStore((state) => state.cancelText)
  const variant = useConfirmStore((state) => state.variant)
  const handleConfirm = useConfirmStore((state) => state.handleConfirm)
  const handleCancel = useConfirmStore((state) => state.handleCancel)

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isLoading) {
        handleCancel()
      }
    },
    [handleCancel, isLoading],
  )

  const isDestructive = variant === "destructive"

  return (
    <CenterMorphModal open={isOpen} onOpenChange={onOpenChange}>
      <CenterMorphModalContent
        ariaLabel={typeof title === "string" ? title : "Confirmation Dialog"}
        dismissible={!isLoading}
        showCloseButton={false}
        className="flex flex-col gap-5 p-6"
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl border",
              isDestructive
                ? "border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/15"
                : "border-primary/20 bg-primary/10 text-primary",
            )}
          >
            <HugeiconsIcon
              icon={isDestructive ? Alert02Icon : HelpCircleIcon}
              size={20}
              strokeWidth={2}
            />
          </div>

          <div className="flex flex-1 flex-col gap-1.5 pt-0.5">
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <div className="text-sm text-muted-foreground leading-relaxed">
                {description}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={handleCancel}
            className="rounded-xl px-4"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={isDestructive ? "destructive" : "default"}
            disabled={isLoading}
            onClick={async () => {
              try {
                await handleConfirm()
              } catch {
                // Error feedback is surfaced via Sonner/useConfirm
              }
            }}
            className="rounded-xl px-4"
          >
            {isLoading ? (
              <HugeiconsIcon
                className="animate-spin"
                icon={Loading03Icon}
                size={16}
              />
            ) : null}
            <span>{confirmText}</span>
          </Button>
        </div>
      </CenterMorphModalContent>
    </CenterMorphModal>
  )
}
