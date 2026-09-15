import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"

const React = await import("react")
const { act } = React
const { createRoot } = await import("react-dom/client")
type Root = import("react-dom/client").Root
const { InviteMembersForm } = await import("./invite-members-form")

function dispatchKey(el: HTMLElement, key: string) {
  el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }))
}

function setNativeValue(el: HTMLElement, val: string) {
  const isTextArea = el instanceof HTMLTextAreaElement
  const proto = isTextArea
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const set = Object.getOwnPropertyDescriptor(proto, "value")?.set
  const tracker = (
    el as unknown as { _valueTracker?: { setValue: (v: string) => void } }
  )._valueTracker
  if (tracker) {
    tracker.setValue("__prev_diff_value__")
  }
  set?.call(el, val)
  el.dispatchEvent(new Event("input", { bubbles: true }))
  el.dispatchEvent(new Event("change", { bubbles: true }))
}

function ensureDOM() {
  if (!globalThis.document.body) {
    const body = globalThis.document.createElement("body")
    globalThis.document.appendChild(body)
  }
}

describe("InviteMembersForm (Block 2)", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ensureDOM()
    document.body.innerHTML = ""
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    document.body.innerHTML = ""
  })

  it("adds recipient chips via typing and pressing Enter or comma", async () => {
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
        }),
      )
    })

    const input = container.querySelector(
      'input[data-testid="invite-email-input"]',
    ) as HTMLInputElement
    expect(input).toBeDefined()

    // Type email and press Enter
    await act(async () => {
      setNativeValue(input, "alice@example.com")
    })

    await act(async () => {
      dispatchKey(input, "Enter")
    })

    expect(container.textContent).toContain("alice@example.com")
    expect(container.textContent).toContain("AL") // 2-char initials
    expect(input.value).toBe("")
    expect(container.textContent).toContain("1 to invite")

    // Type second email and press comma
    await act(async () => {
      setNativeValue(input, "bob@example.com")
    })

    await act(async () => {
      dispatchKey(input, ",")
    })

    expect(container.textContent).toContain("bob@example.com")
    expect(container.textContent).toContain("BO")
    expect(container.textContent).toContain("2 to invite")
  })

  it("handles bulk pasting multiple comma-, space-, semicolon-, or newline-separated emails", async () => {
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
        }),
      )
    })

    const input = container.querySelector(
      'input[data-testid="invite-email-input"]',
    ) as HTMLInputElement

    const pastedContent =
      "first@example.com, second@example.com;\nthird@example.com fourth@example.com"

    await act(async () => {
      const pasteEvent = new Event("paste", {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(pasteEvent, "clipboardData", {
        value: {
          getData: () => pastedContent,
        },
      })
      input.dispatchEvent(pasteEvent)
    })

    expect(container.textContent).toContain("first@example.com")
    expect(container.textContent).toContain("second@example.com")
    expect(container.textContent).toContain("third@example.com")
    expect(container.textContent).toContain("fourth@example.com")
    expect(container.textContent).toContain("4 to invite")
  })

  it("removes chips via remove button and backspace", async () => {
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          initialEmails: ["member1@example.com", "member2@example.com"],
        }),
      )
    })

    expect(container.textContent).toContain("member1@example.com")
    expect(container.textContent).toContain("member2@example.com")
    expect(container.textContent).toContain("2 to invite")

    // Remove first chip via remove button
    const removeBtn = container.querySelector(
      'button[data-testid="remove-chip-member1@example.com"]',
    ) as HTMLButtonElement
    expect(removeBtn).toBeDefined()

    await act(async () => {
      removeBtn.click()
    })

    expect(container.textContent).not.toContain("member1@example.com")
    expect(container.textContent).toContain("member2@example.com")
    expect(container.textContent).toContain("1 to invite")

    // Remove remaining chip via backspace on empty input
    const input = container.querySelector(
      'input[data-testid="invite-email-input"]',
    ) as HTMLInputElement

    await act(async () => {
      dispatchKey(input, "Backspace")
    })

    expect(container.textContent).not.toContain("member2@example.com")
    expect(container.textContent).toContain("0 to invite")
  })

  it("changes a chip's role via the inline role selector", async () => {
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          initialEmails: ["alex@example.com"],
          allowedRoles: ["member", "admin"],
          defaultOpenRoleForEmail: "alex@example.com",
        }),
      )
    })

    expect(container.textContent).toContain("alex@example.com")

    let adminOption: HTMLElement | null = null
    for (let i = 0; i < 10; i++) {
      adminOption = document.body.querySelector(
        '[data-testid="role-option-alex@example.com-admin"]',
      )
      if (adminOption) break
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30))
      })
    }
    expect(adminOption).not.toBeNull()

    await act(async () => {
      adminOption?.click()
    })

    // Now submit to verify the role updated to admin in the payload
    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement

    await act(async () => {
      submitBtn.click()
    })

    expect(onInvite).toHaveBeenCalledWith([
      { email: "alex@example.com", role: "admin" },
    ])
  })

  it("identifies auto-join domain matches and displays auto-join badge", async () => {
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          workspaceDomain: "fenr.app",
          initialEmails: ["teammate@fenr.app", "external@gmail.com"],
        }),
      )
    })

    expect(container.textContent).toContain("teammate@fenr.app")
    expect(container.textContent).toContain("Auto")
    expect(container.textContent).toContain("1 to invite") // external is sendable
    expect(container.textContent).toContain("1 auto-join") // teammate is auto-join
    expect(container.textContent).toContain("Domain auto-join is on")
    expect(container.textContent).toContain("@fenr.app")
  })

  it("marks invalid email entries with an Invalid badge and tracks them in stats", async () => {
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
        }),
      )
    })

    const input = container.querySelector(
      'input[data-testid="invite-email-input"]',
    ) as HTMLInputElement

    await act(async () => {
      setNativeValue(input, "not-an-email")
    })

    await act(async () => {
      dispatchKey(input, "Enter")
    })

    expect(container.textContent).toContain("not-an-email")
    expect(container.textContent).toContain("Invalid")
    expect(container.textContent).toContain("1 invalid")
  })

  it("toggles expandable personal note section and includes note in onInvite payload", async () => {
    const onInvite = mock(async () => [
      { email: "member@example.com", success: true },
    ])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          initialEmails: ["member@example.com"],
        }),
      )
    })

    expect(container.textContent).toContain("+ Add a personal note")

    const toggleBtn = container.querySelector(
      'button[data-testid="personal-note-toggle"]',
    ) as HTMLButtonElement

    await act(async () => {
      toggleBtn.click()
    })

    expect(container.textContent).toContain("Personal note")
    expect(container.textContent).toContain("Hide")

    const textarea = container.querySelector(
      "textarea#invite-personal-note",
    ) as HTMLTextAreaElement
    expect(textarea).toBeDefined()

    await act(async () => {
      setNativeValue(textarea, "Welcome to the team!")
    })

    expect(textarea.value).toBe("Welcome to the team!")

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement

    await act(async () => {
      submitBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(1)
    expect(onInvite).toHaveBeenCalledWith([
      {
        email: "member@example.com",
        role: "member",
        note: "Welcome to the team!",
      },
    ])
  })

  it("submits valid invitations to onInvite and triggers onComplete on success", async () => {
    const onComplete = mock(() => {})
    const onInvite = mock(
      async (
        invites: Array<{ email: string; role: string; note?: string }>,
      ) => {
        return invites.map((i) => ({ email: i.email, success: true }))
      },
    )

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          onComplete,
          initialEmails: ["member@example.com"],
        }),
      )
    })

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement
    expect(submitBtn.textContent).toContain("Send 1 invite")

    await act(async () => {
      submitBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(1)
    expect(onInvite).toHaveBeenCalledWith([
      { email: "member@example.com", role: "member" },
    ])
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("does not complete when a valid invite is mixed with an invalid chip", async () => {
    const onComplete = mock(() => {})
    const onInvite = mock(async () => [
      { email: "valid@example.com", success: true },
    ])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          onComplete,
          initialEmails: ["valid@example.com", "not-an-email"],
        }),
      )
    })

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement

    await act(async () => {
      submitBtn.click()
    })

    expect(onInvite).not.toHaveBeenCalled()
    expect(onComplete).not.toHaveBeenCalled()
    expect(container.textContent).toContain("1 invalid")
  })

  it("handles copy invite link functionality", async () => {
    const onInvite = mock(async () => [])
    let copiedText = ""
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          copiedText = text
        },
      },
      configurable: true,
      writable: true,
    })

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          organizationId: "org-uuid-12345",
          inviteLink: "https://fenr.app/invite/custom-slug",
        }),
      )
    })

    const copyBtn = container.querySelector(
      'button[data-testid="copy-link-btn"]',
    ) as HTMLButtonElement
    expect(copyBtn).toBeDefined()
    expect(copyBtn.textContent).toContain("Copy link")

    await act(async () => {
      copyBtn.click()
    })

    expect(copiedText).toBe("https://fenr.app/invite/custom-slug")
    expect(copyBtn.textContent).toContain("Copied")
  })

  it("handles partial failure and successful retry triggering onComplete", async () => {
    const onComplete = mock(() => {})
    let callCount = 0
    const onInvite = mock(async () => {
      callCount++
      if (callCount === 1) {
        return [
          { email: "user1@example.com", success: true },
          {
            email: "user2@example.com",
            success: false,
            error: "Rate limit exceeded",
          },
        ]
      }
      return [{ email: "user2@example.com", success: true }]
    })

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          onComplete,
          initialEmails: ["user1@example.com", "user2@example.com"],
        }),
      )
    })

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement

    await act(async () => {
      submitBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(0) // Should not complete yet

    // user2 should have a retry button
    const retryBtn = container.querySelector(
      'button[aria-label="Retry invitation to user2@example.com"]',
    ) as HTMLButtonElement
    expect(retryBtn).toBeDefined()

    await act(async () => {
      retryBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(2)
    expect(onComplete).toHaveBeenCalledTimes(1) // Now all completed!
  })

  it("handles server rejection gracefully by setting chip error state", async () => {
    const onInvite = mock(async () => {
      throw new Error("Internal Server Error")
    })

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          initialEmails: ["member@example.com"],
        }),
      )
    })

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement

    await act(async () => {
      submitBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(1)
    const retryBtn = container.querySelector(
      'button[aria-label="Retry invitation to member@example.com"]',
    ) as HTMLButtonElement
    expect(retryBtn).toBeDefined()
  })

  it("correctly treats @domain without username as invalid and matches subdomains for auto-join", async () => {
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          workspaceDomain: "fenr.app",
          initialEmails: ["@fenr.app", "alice@sub.fenr.app"],
        }),
      )
    })

    // @fenr.app is invalid because it has no local-part
    expect(container.textContent).toContain("1 invalid")
    // alice@sub.fenr.app is a subdomain match and valid
    expect(container.textContent).toContain("1 auto-join")
  })

  it("calls onSkip when skip button is clicked", async () => {
    const onSkip = mock(() => {})
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          onSkip,
          skipLabel: "Skip setup",
        }),
      )
    })

    const skipBtn = container.querySelector(
      'button[data-testid="skip-invites-btn"]',
    ) as HTMLButtonElement
    expect(skipBtn).toBeDefined()
    expect(skipBtn.textContent).toContain("Skip setup")

    await act(async () => {
      skipBtn.click()
    })

    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it("prevents concurrent multiple submissions on rapid clicks", async () => {
    let resolveInvite: (
      value: Array<{ email: string; success: boolean }>,
    ) => void = () => {}
    const onInvite = mock(
      () =>
        new Promise<Array<{ email: string; success: boolean }>>((resolve) => {
          resolveInvite = resolve
        }),
    )

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          initialEmails: ["alex@example.com"],
        }),
      )
    })

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement

    await act(async () => {
      submitBtn.click()
      submitBtn.click()
      submitBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveInvite([{ email: "alex@example.com", success: true }])
    })
  })

  it("enables Continue button and triggers onComplete when all entered emails match auto-join domain", async () => {
    const onComplete = mock(() => {})
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          onComplete,
          workspaceDomain: "@fenr.app",
          initialEmails: ["member@fenr.app"],
        }),
      )
    })

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement
    expect(submitBtn).toBeDefined()
    expect(submitBtn.disabled).toBe(false)
    expect(submitBtn.textContent).toContain("Continue")

    await act(async () => {
      submitBtn.click()
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onInvite).toHaveBeenCalledTimes(0) // No network calls needed for auto-join
  })

  it("allows proceeding via Continue button when removing failed invite leaves only succeeded invites", async () => {
    const onComplete = mock(() => {})
    const onInvite = mock(async () => [
      { email: "user1@example.com", success: true },
      { email: "user2@example.com", success: false, error: "Quota exceeded" },
    ])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          onComplete,
          initialEmails: ["user1@example.com", "user2@example.com"],
        }),
      )
    })

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement

    await act(async () => {
      submitBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(0)

    // Remove user2 (failed invite)
    const removeBtn = container.querySelector(
      'button[data-testid="remove-chip-user2@example.com"]',
    ) as HTMLButtonElement
    expect(removeBtn).toBeDefined()

    await act(async () => {
      removeBtn.click()
    })

    // Button should now be enabled and say "Continue"
    expect(submitBtn.disabled).toBe(false)
    expect(submitBtn.textContent).toContain("Continue")

    await act(async () => {
      submitBtn.click()
    })

    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("deduplicates and cleans initialEmails provided via props", async () => {
    const onInvite = mock(async () => [])

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          initialEmails: [
            "alex@example.com",
            "ALEX@EXAMPLE.COM",
            "  ",
            "bob@example.com",
          ],
        }),
      )
    })

    expect(container.textContent).toContain("alex@example.com")
    expect(container.textContent).toContain("bob@example.com")
    expect(container.textContent).toContain("2 to invite")
  })

  it("prevents concurrent multiple retries on rapid clicks", async () => {
    let resolveRetry: (
      value: Array<{ email: string; success: boolean }>,
    ) => void = () => {}
    let callCount = 0
    const onInvite = mock(async () => {
      callCount++
      if (callCount === 1) {
        return [
          {
            email: "failed@example.com",
            success: false,
            error: "Network error",
          },
        ]
      }
      return new Promise<Array<{ email: string; success: boolean }>>(
        (resolve) => {
          resolveRetry = resolve
        },
      )
    })

    await act(async () => {
      root.render(
        React.createElement(InviteMembersForm, {
          onInvite,
          initialEmails: ["failed@example.com"],
        }),
      )
    })

    const submitBtn = container.querySelector(
      'button[data-testid="submit-invites-btn"]',
    ) as HTMLButtonElement

    await act(async () => {
      submitBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(1)

    const retryBtn = container.querySelector(
      'button[aria-label="Retry invitation to failed@example.com"]',
    ) as HTMLButtonElement
    expect(retryBtn).toBeDefined()

    await act(async () => {
      retryBtn.click()
      retryBtn.click()
      retryBtn.click()
    })

    expect(onInvite).toHaveBeenCalledTimes(2) // Only 1 additional call despite rapid clicks

    await act(async () => {
      resolveRetry([{ email: "failed@example.com", success: true }])
    })
  })
})
