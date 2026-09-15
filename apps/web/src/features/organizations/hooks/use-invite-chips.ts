import * as React from "react"
import type { OrganizationRole } from "@/lib/schemas/organizations"
import { isValidEmail, type QueuedInvite } from "../components/invite-chip"

const SPLIT_RE = /[\s,;]+/

export interface UseInviteChipsOptions {
  invites: QueuedInvite[]
  setInvites: (updater: (prev: QueuedInvite[]) => QueuedInvite[]) => void
  draft: string
  setDraft: (value: string) => void
  defaultRole: OrganizationRole
  workspaceDomain?: string
}

export function useInviteChips({
  invites,
  setInvites,
  draft,
  setDraft,
  defaultRole,
  workspaceDomain,
}: UseInviteChipsOptions) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  const isAutoJoin = React.useCallback(
    (email: string) => {
      if (!workspaceDomain) return false
      const trimmed = email.toLowerCase().trim()
      if (!isValidEmail(trimmed)) return false
      const domain = workspaceDomain.toLowerCase().replace(/^@/, "").trim()
      if (!domain) return false
      const emailDomain = trimmed.split("@")[1]
      if (!emailDomain) return false
      return emailDomain === domain || emailDomain.endsWith(`.${domain}`)
    },
    [workspaceDomain],
  )

  const stats = React.useMemo(() => {
    const valid = invites.filter((c) => isValidEmail(c.email))
    const autojoin = valid.filter((c) => isAutoJoin(c.email))
    const sendable = valid.filter(
      (c) => !isAutoJoin(c.email) && c.status !== "success",
    )
    const invalid = invites.length - valid.length
    return {
      total: invites.length,
      sendable: sendable.length,
      autojoin: autojoin.length,
      invalid,
    }
  }, [invites, isAutoJoin])

  const addEmails = React.useCallback(
    (raw: string) => {
      const parts = raw
        .split(SPLIT_RE)
        .map((s) => s.trim().replace(/^[,;]+|[,;]+$/g, ""))
        .filter(Boolean)
      if (parts.length === 0) return

      setInvites((prev) => {
        const seen = new Set(prev.map((c) => c.email.toLowerCase()))
        const next = [...prev]
        for (const email of parts) {
          const key = email.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)
          next.push({
            id: crypto.randomUUID(),
            email: key,
            role: defaultRole,
            status: "pending",
          })
        }
        return next
      })
    },
    [defaultRole, setInvites],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return

    if (
      e.key === "Enter" ||
      e.key === "," ||
      e.key === ";" ||
      e.key === "Tab"
    ) {
      const raw = (draft || e.currentTarget?.value || "").trim()
      if (raw.length === 0) return
      e.preventDefault()
      addEmails(raw)
      setDraft("")
      if (e.currentTarget) {
        e.currentTarget.value = ""
      }
    } else if (
      e.key === "Backspace" &&
      draft.length === 0 &&
      (!e.currentTarget?.value || e.currentTarget.value.length === 0) &&
      invites.length > 0
    ) {
      e.preventDefault()
      setInvites((prev) => prev.slice(0, -1))
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData?.getData("text") ?? ""
    if (!text) return

    if (SPLIT_RE.test(text) || isValidEmail(text.trim())) {
      e.preventDefault()
      const fullText = draft.trim() ? `${draft} ${text}` : text
      addEmails(fullText)
      setDraft("")
      if (e.currentTarget) {
        e.currentTarget.value = ""
      }
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const raw = (draft || e.currentTarget?.value || "").trim()
    if (raw.length === 0) return
    addEmails(raw)
    setDraft("")
    if (e.currentTarget) {
      e.currentTarget.value = ""
    }
  }

  const handleContainerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (!target.closest("button, [role='button'], [data-role='trigger']")) {
      e.preventDefault()
      inputRef.current?.focus()
    }
  }

  const removeInvite = (id: string) => {
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  const changeRole = (id: string, role: OrganizationRole) => {
    setInvites((prev) => prev.map((i) => (i.id === id ? { ...i, role } : i)))
  }

  return {
    inputRef,
    containerRef,
    stats,
    isAutoJoin,
    addEmails,
    handleKeyDown,
    handlePaste,
    handleBlur,
    handleContainerMouseDown,
    removeInvite,
    changeRole,
  }
}
