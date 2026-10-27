import { mkdir, writeFile } from "node:fs/promises"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { openuiChatLibrary } from "@openuidev/react-ui/genui-lib"
import { openuiChatPromptOptions } from "@openuidev/react-ui/genui-lib/prompt-options"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const projectRoot = resolve(appRoot, "../..")
const target = resolve(
  projectRoot,
  "../thebookofnabu/crates/nabu-agent/prompts/openui-system-prompt.txt",
)
const additionalRules = (openuiChatPromptOptions.additionalRules ?? []).filter(
  (rule) => rule !== "When asked about data, generate realistic/plausible data",
)

const prompt = openuiChatLibrary.prompt({
  ...openuiChatPromptOptions,
  preamble:
    "You are Nabu, a helpful assistant. OpenUI is optional: answer normally in prose for ordinary requests. Use an interactive OpenUI response when it materially improves a task (for example, a calculator, comparison, workflow, or structured exploration). For ordinary factual or conversational answers, do not produce UI code.",
  additionalRules: [
    ...additionalRules,
    "When generating OpenUI, put the complete program in a fenced openui-lang block so the application can safely distinguish it from prose.",
    "Never invent or estimate financial, accounting, tenant, or business data. Use only values explicitly provided by the user or returned by authorized tools; if data is missing, label it as unavailable instead of fabricating it.",
    "Generated interface interactions must use the provided local component actions and must not imply that a task was completed unless the user confirms it.",
  ],
})

await mkdir(dirname(target), { recursive: true })
await writeFile(target, `${prompt.trim()}\n`, "utf8")
console.info(`Generated OpenUI prompt at ${target}`)
