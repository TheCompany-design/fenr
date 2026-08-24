/**
 * Password input with a show/hide visibility toggle.
 */
import { ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Input } from "@workspace/ui/components/input"
import { useState } from "react"

interface PasswordInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  /** Which autocomplete hint to use: current-password | new-password */
  autoComplete?: "current-password" | "new-password"
}

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={`pr-9 ${className ?? ""}`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center rounded-r-md text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
      >
        <HugeiconsIcon icon={visible ? ViewOffIcon : ViewIcon} size={16} />
      </button>
    </div>
  )
}
