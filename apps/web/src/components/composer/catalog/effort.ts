import type {
  EffortLevelId,
  ReasoningLevel,
  ReasoningScale,
} from "./capabilities"

export function levelIndex(
  levels: readonly ReasoningLevel[],
  id: EffortLevelId | null,
): number {
  if (id === null) return -1
  return levels.findIndex((level) => level.id === id)
}

export function levelAt(
  levels: readonly ReasoningLevel[],
  id: EffortLevelId | null,
): ReasoningLevel | null {
  const index = levelIndex(levels, id)
  return index < 0 ? null : levels[index]
}

export function levelPosition(
  levels: readonly ReasoningLevel[],
  id: EffortLevelId | null,
): number {
  const index = levelIndex(levels, id)
  if (index < 0) return 0
  if (levels.length <= 1) return 0.5
  return index / (levels.length - 1)
}

export function narrowedDefault(levels: readonly ReasoningLevel[]): string {
  return levels[0]?.id ?? ""
}

export function settleLevel(
  levels: readonly ReasoningLevel[],
  requested: EffortLevelId | null,
  preferred: EffortLevelId,
): EffortLevelId | null {
  if (levels.length === 0) return null
  if (levelIndex(levels, requested) >= 0) return requested
  return levelIndex(levels, preferred) >= 0 ? preferred : levels[0].id
}

export function narrowScale(
  scale: ReasoningScale,
  permitted: readonly EffortLevelId[] | undefined,
): ReasoningScale {
  if (!permitted) return scale
  return {
    levels: scale.levels.filter((level) => permitted.includes(level.id)),
    default: scale.default,
  }
}
