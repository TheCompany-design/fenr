"use client"

import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  HelpCircleIcon,
  Loading03Icon,
  Message01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ActionSwapRollText } from "@workspace/ui/components/action-swap"
import { AgentDisclosure } from "@workspace/ui/components/agent-disclosure"
import { Button } from "@workspace/ui/components/button"
import {
  RadioGroup,
  RadioGroupItem,
} from "@workspace/ui/components/radio-group"
import { EASE_OUT, SPRING_PRESS, SPRING_SWAP } from "@workspace/ui/lib/ease"
import { cn } from "@workspace/ui/lib/utils"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"

export type ApprovalCardStatus =
  | "pending"
  | "submitting"
  | "approved"
  | "rejected"
  | "changes-requested"
  | "answered"

export interface ApprovalCardOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface ApprovalCardQuestion {
  id: string
  title: ReactNode
  description?: ReactNode
  options?: ApprovalCardOption[]
  multiple?: boolean
  autoAdvance?: boolean
  allowCustom?: boolean
  customPlaceholder?: string
}

export interface ApprovalCardAnswer {
  selected: string[]
  custom?: string
}

export type ApprovalCardAnswers = Record<string, ApprovalCardAnswer>

export interface ApprovalCardProps {
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  questions?: ApprovalCardQuestion[]
  status?: ApprovalCardStatus
  answers?: ApprovalCardAnswers
  defaultAnswers?: ApprovalCardAnswers
  onAnswersChange?: (answers: ApprovalCardAnswers) => void
  step?: number
  defaultStep?: number
  onStepChange?: (step: number) => void
  onSubmit?: (answers: ApprovalCardAnswers) => void
  onApprove?: () => void
  onReject?: () => void
  onRequestChanges?: () => void
  onDismiss?: () => void
  approveLabel?: ReactNode
  submitLabel?: ReactNode
  result?: ReactNode
  className?: string
}

const EMPTY_ANSWER: ApprovalCardAnswer = { selected: [], custom: "" }
const CHECK_PATH = "M5 13l4 4L19 7"

function getStatusLabel(status: ApprovalCardStatus) {
  if (status === "submitting") return "Submitting"
  if (status === "approved") return "Approved"
  if (status === "rejected") return "Rejected"
  if (status === "changes-requested") return "Changes requested"
  if (status === "answered") return "Response submitted"
  return "Input required"
}

function getStatusClass(status: ApprovalCardStatus) {
  if (status === "approved" || status === "answered") {
    return "text-emerald-600 dark:text-emerald-400"
  }
  if (status === "rejected") return "text-rose-600 dark:text-rose-400"
  if (status === "changes-requested") {
    return "text-amber-600 dark:text-amber-400"
  }
  return "text-muted-foreground"
}

function getStatusBadgeClass(status: ApprovalCardStatus) {
  if (status === "pending" || status === "changes-requested") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  }
  if (status === "submitting") {
    return "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
  }
  if (status === "approved" || status === "answered") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
  }
  return "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
}

function isAnswered(answer: ApprovalCardAnswer) {
  return answer.selected.length > 0 || Boolean(answer.custom?.trim())
}

function QuestionOptionCheckbox({
  checked,
  onCheckedChange,
  disabled,
  label,
  description,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  description?: string
  className?: string
}) {
  const id = useId()
  const reduce = useReducedMotion()
  const descriptionId = description ? `${id}-description` : undefined
  const labelId = description ? `${id}-label` : undefined

  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex gap-3",
        description ? "items-start" : "items-center",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <motion.button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        whileTap={reduce || disabled ? undefined : { scale: 0.92 }}
        transition={SPRING_PRESS}
        data-state={checked ? "checked" : "unchecked"}
        className={cn(
          "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 outline-none transition-colors duration-200",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-60",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/50 bg-background hover:border-muted-foreground",
        )}
      >
        <AnimatePresence initial={false}>
          {checked ? (
            <motion.svg
              key="checked"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.5 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.5, filter: "blur(4px)" }
              }
              transition={
                reduce ? { duration: 0 } : { duration: 0.16, ease: EASE_OUT }
              }
              aria-hidden
            >
              <title>Selected</title>
              <motion.path
                d={CHECK_PATH}
                initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { duration: 0.3, ease: EASE_OUT, delay: 0.04 }
                }
              />
            </motion.svg>
          ) : null}
        </AnimatePresence>
      </motion.button>
      <span
        className={cn(
          "flex min-w-0 flex-col gap-0.5 select-none",
          disabled && "opacity-60",
        )}
      >
        <span
          id={labelId}
          className={cn("text-sm text-foreground", description && "leading-4")}
        >
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}

function QuestionOptions({
  question,
  answer,
  disabled,
  onChange,
  onSingleSelect,
}: {
  question: ApprovalCardQuestion
  answer: ApprovalCardAnswer
  disabled: boolean
  onChange: (answer: ApprovalCardAnswer) => void
  onSingleSelect?: () => void
}) {
  const custom = answer.custom ?? ""

  return (
    <div className="mt-3">
      {question.options?.length ? (
        question.multiple ? (
          <div className="grid gap-0.5">
            {question.options.map((option) => (
              <QuestionOptionCheckbox
                key={option.value}
                checked={answer.selected.includes(option.value)}
                disabled={disabled || option.disabled}
                label={option.label}
                description={option.description}
                onCheckedChange={(checked) =>
                  onChange({
                    ...answer,
                    selected: checked
                      ? [...answer.selected, option.value]
                      : answer.selected.filter(
                          (value) => value !== option.value,
                        ),
                  })
                }
                className="min-h-9 rounded-lg px-1.5 py-1"
              />
            ))}
          </div>
        ) : (
          <RadioGroup
            value={answer.selected[0] ?? ""}
            onValueChange={(value) => {
              onChange({ selected: [value], custom: "" })
              onSingleSelect?.()
            }}
            className="gap-0.5"
          >
            {question.options.map((option) => (
              <RadioGroupItem
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
                disabled={disabled || option.disabled}
                className="min-h-9 rounded-lg px-1.5 py-1"
              />
            ))}
          </RadioGroup>
        )
      ) : null}
      {question.allowCustom ? (
        <div className={cn("p-0.5", question.options?.length && "mt-1.5")}>
          <div className="relative h-10 overflow-hidden rounded-xl border border-transparent bg-background/70 transition-colors duration-200 focus-within:border-foreground/40 focus-within:bg-background focus-within:ring-2 focus-within:ring-ring/40">
            <input
              type="text"
              value={custom}
              disabled={disabled}
              placeholder={
                question.customPlaceholder ?? "Add another response…"
              }
              onChange={(event) =>
                onChange({
                  selected: question.multiple ? answer.selected : [],
                  custom: event.target.value,
                })
              }
              className="h-full w-full bg-transparent px-3 text-sm leading-6 text-foreground caret-foreground outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ProgressDots({ current, ids }: { current: number; ids: string[] }) {
  return (
    <span className="flex gap-1.5">
      <span className="sr-only">
        Question {current + 1} of {ids.length}
      </span>
      {ids.map((id, index) => (
        <motion.span
          key={id}
          aria-hidden="true"
          initial={{
            scale: index === current ? 1 : 0.75,
            opacity: index <= current ? 1 : 0.35,
          }}
          animate={{
            scale: index === current ? 1 : 0.75,
            opacity: index <= current ? 1 : 0.35,
          }}
          transition={SPRING_SWAP}
          className="size-1.5 rounded-full bg-foreground"
        />
      ))}
    </span>
  )
}

export function ApprovalCard({
  title = "Approval required",
  description,
  children,
  questions = [],
  status = "pending",
  answers,
  defaultAnswers = {},
  onAnswersChange,
  step,
  defaultStep = 0,
  onStepChange,
  onSubmit,
  onApprove,
  onReject,
  onRequestChanges,
  onDismiss,
  approveLabel = "Approve",
  submitLabel = "Submit response",
  result,
  className,
}: ApprovalCardProps) {
  const reduce = useReducedMotion() ?? false
  const [internalAnswers, setInternalAnswers] =
    useState<ApprovalCardAnswers>(defaultAnswers)
  const [internalStep, setInternalStep] = useState(defaultStep)
  const autoAdvanceTimer = useRef<number | undefined>(undefined)
  const currentAnswers = answers ?? internalAnswers
  const currentStep = Math.min(
    Math.max(0, step ?? internalStep),
    Math.max(0, questions.length - 1),
  )
  const question = questions[currentStep]
  const questionMode = questions.length > 0
  const multipleQuestions = questions.length > 1
  const pending = status === "pending"
  const busy = status === "submitting"
  const interactive = pending || busy
  const currentAnswer = question
    ? (currentAnswers[question.id] ?? EMPTY_ANSWER)
    : EMPTY_ANSWER
  const displayTitle = question?.title ?? title
  const titleKey = question?.id ?? String(status)
  const statusLabel = getStatusLabel(status)

  const clearAutoAdvance = useCallback(() => {
    if (autoAdvanceTimer.current === undefined) return
    window.clearTimeout(autoAdvanceTimer.current)
    autoAdvanceTimer.current = undefined
  }, [])

  useEffect(() => clearAutoAdvance, [clearAutoAdvance])

  const setAnswers = useCallback(
    (next: ApprovalCardAnswers) => {
      if (answers === undefined) setInternalAnswers(next)
      onAnswersChange?.(next)
    },
    [answers, onAnswersChange],
  )

  const setStep = (next: number) => {
    clearAutoAdvance()
    if (step === undefined) setInternalStep(next)
    onStepChange?.(next)
  }

  const updateCurrentAnswer = (next: ApprovalCardAnswer) => {
    if (!question) return
    setAnswers({ ...currentAnswers, [question.id]: next })
  }

  const continueQuestion = () => {
    if (currentStep < questions.length - 1) {
      setStep(currentStep + 1)
      return
    }
    onSubmit?.(currentAnswers)
  }

  const queueAutoAdvance = () => {
    if (
      !question ||
      question.multiple ||
      question.autoAdvance === false ||
      currentStep >= questions.length - 1 ||
      busy
    ) {
      return
    }
    clearAutoAdvance()
    autoAdvanceTimer.current = window.setTimeout(() => {
      setStep(currentStep + 1)
    }, 240)
  }

  return (
    <div
      data-slot="approval-card"
      data-state={status}
      aria-busy={busy}
      className={cn(
        "w-full overflow-hidden rounded-2xl bg-muted p-4 text-sm",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-5 shrink-0 place-items-center text-muted-foreground",
            getStatusClass(status),
          )}
        >
          {busy ? (
            <HugeiconsIcon
              icon={Loading03Icon}
              size={16}
              className={cn(!reduce && "animate-spin")}
            />
          ) : interactive ? (
            questionMode ? (
              <HugeiconsIcon icon={HelpCircleIcon} size={16} />
            ) : (
              <HugeiconsIcon icon={Message01Icon} size={16} />
            )
          ) : status === "rejected" ? (
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          ) : (
            <HugeiconsIcon icon={Tick02Icon} size={16} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-3">
            <h3 className="min-w-0 flex-1 text-base font-medium leading-5 text-foreground">
              <ActionSwapRollText value={titleKey}>
                {displayTitle}
              </ActionSwapRollText>
            </h3>
            {questionMode && interactive ? (
              multipleQuestions ? (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground/65">
                  {currentStep + 1}/{questions.length}
                </span>
              ) : null
            ) : (
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                  getStatusBadgeClass(status),
                )}
              >
                {statusLabel}
              </span>
            )}
            {onDismiss ? (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={onDismiss}
                className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <HugeiconsIcon icon={Cancel01Icon} size={16} />
              </button>
            ) : null}
          </div>
          <AgentDisclosure open={interactive}>
            {questionMode && question ? (
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={question.id}
                  initial={reduce ? { opacity: 1 } : { opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: -6 }}
                  transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
                >
                  {question.description ? (
                    <p className="mt-1 leading-5 text-muted-foreground">
                      {question.description}
                    </p>
                  ) : null}
                  <QuestionOptions
                    question={question}
                    answer={currentAnswer}
                    disabled={busy}
                    onChange={updateCurrentAnswer}
                    onSingleSelect={queueAutoAdvance}
                  />
                </motion.div>
              </AnimatePresence>
            ) : (
              <div>
                {description ? (
                  <p className="mt-1 leading-5 text-muted-foreground">
                    {description}
                  </p>
                ) : null}
                {children ? <div className="mt-3">{children}</div> : null}
              </div>
            )}
            {questionMode ? (
              <div className="mt-4 flex items-center gap-3">
                {multipleQuestions ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Previous question"
                      disabled={busy || currentStep === 0}
                      onClick={() => setStep(currentStep - 1)}
                      className="rounded-full"
                    >
                      <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
                    </Button>
                    <ProgressDots
                      current={currentStep}
                      ids={questions.map((item) => item.id)}
                    />
                  </>
                ) : null}
                <Button
                  size={currentStep === questions.length - 1 ? "sm" : "icon"}
                  aria-label={
                    currentStep === questions.length - 1
                      ? "Submit response"
                      : "Next question"
                  }
                  disabled={busy || !isAnswered(currentAnswer)}
                  onClick={continueQuestion}
                  className="ml-auto rounded-full"
                >
                  {busy ? (
                    <HugeiconsIcon
                      icon={Loading03Icon}
                      size={16}
                      className={cn(!reduce && "animate-spin")}
                    />
                  ) : currentStep === questions.length - 1 ? (
                    <>
                      {submitLabel}
                      <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
                    </>
                  ) : (
                    <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
                  )}
                </Button>
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={onApprove}
                  className="rounded-full"
                >
                  {approveLabel}
                </Button>
                {onRequestChanges ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={onRequestChanges}
                    className="rounded-full"
                  >
                    Request changes
                  </Button>
                ) : null}
                {onReject ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={onReject}
                    className="rounded-full text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                  >
                    Reject
                  </Button>
                ) : null}
              </div>
            )}
          </AgentDisclosure>
          {!interactive ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {result ?? statusLabel}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
