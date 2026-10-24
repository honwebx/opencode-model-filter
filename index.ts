import { Plugin } from "@opencode/plugin"

// include=保留免费, exclude=剔除免费
type FreeRule = "include" | "exclude"

type Filter = {
  include: string[]
  exclude: string[]
  free?: FreeRule
  // 美元/百万token，四项单价最高值超此即剔除
  maxPrice?: number
  minContext?: number
}

type CostTier = {
  input?: number
  output?: number
  cache?: { read?: number; write?: number }
}

type FilterableModel = {
  id: string
  modelID: string
  cost?: readonly CostTier[]
  limit?: { context?: number }
}

function asArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

const globCache = new Map<string, RegExp>()

// * 任意串, ? 单字符
function globToRegExp(pattern: string): RegExp {
  const cached = globCache.get(pattern)
  if (cached) return cached

  const source = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".")
  const regex = new RegExp(`^${source}$`)
  globCache.set(pattern, regex)
  return regex
}

function matchesAny(values: string[], patterns: string[]): boolean {
  return patterns.some((pattern) => {
    const regex = globToRegExp(pattern)
    return values.some((value) => regex.test(value))
  })
}

// 输入/输出/缓存读/缓存写
function tierPrices(tier: CostTier): number[] {
  return [tier.input ?? 0, tier.output ?? 0, tier.cache?.read ?? 0, tier.cache?.write ?? 0]
}

// 全档四项皆 0 才算免费；无价格数据不算
function isFree(model: FilterableModel): boolean {
  const tiers = model.cost ?? []
  return tiers.length > 0 && tiers.every((tier) => tierPrices(tier).every((price) => price === 0))
}

// 所有档位四项中的最大单价
function maxPriceOf(model: FilterableModel): number {
  return (model.cost ?? []).reduce((max, tier) => Math.max(max, ...tierPrices(tier)), 0)
}

function passesRules(model: FilterableModel, filter: Filter): boolean {
  if (filter.free === "include" && !isFree(model)) return false
  if (filter.free === "exclude" && isFree(model)) return false
  if (filter.maxPrice !== undefined && maxPriceOf(model) > filter.maxPrice) return false
  if (filter.minContext !== undefined && (model.limit?.context ?? 0) < filter.minContext) return false
  return true
}

// include 一律保留, exclude 一律剔除, 其余按 free/maxPrice/minContext
function shouldKeep(model: FilterableModel, filter: Filter): boolean {
  const candidates = [model.id, model.modelID]
  if (matchesAny(candidates, filter.include)) return true
  if (matchesAny(candidates, filter.exclude)) return false
  return passesRules(model, filter)
}

function pickArray(rec: Record<string, unknown> | undefined, key: string, fallback: string[]): string[] {
  const own = asArray(rec?.[key])
  return own.length > 0 ? own : fallback
}

function pickNumber(rec: Record<string, unknown> | undefined, key: string, fallback?: number): number | undefined {
  const own = rec?.[key]
  return typeof own === "number" ? own : fallback
}

function pickFree(rec: Record<string, unknown> | undefined, fallback?: FreeRule): FreeRule | undefined {
  const own = rec?.free
  return own === "include" || own === "exclude" ? own : fallback
}

function hasRules(filter: Filter): boolean {
  return (
    filter.include.length > 0 ||
    filter.exclude.length > 0 ||
    filter.free !== undefined ||
    filter.maxPrice !== undefined ||
    filter.minContext !== undefined
  )
}

// options 键为 provider id 或 "*"（默认）；具体 provider 的非空字段覆盖 "*"
function readFilters(options: unknown): Map<string, Filter> {
  const result = new Map<string, Filter>()
  if (!options || typeof options !== "object" || Array.isArray(options)) return result

  const records = new Map<string, Record<string, unknown>>()
  for (const [id, value] of Object.entries(options as Record<string, unknown>)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      records.set(id, value as Record<string, unknown>)
    }
  }

  const wildcard = records.get("*")
  const wildcardFilter: Filter = {
    include: asArray(wildcard?.include),
    exclude: asArray(wildcard?.exclude),
    free: pickFree(wildcard),
    maxPrice: pickNumber(wildcard, "maxPrice"),
    minContext: pickNumber(wildcard, "minContext"),
  }

  for (const [id, rec] of records) {
    const filter: Filter =
      id === "*"
        ? wildcardFilter
        : {
            include: pickArray(rec, "include", wildcardFilter.include),
            exclude: pickArray(rec, "exclude", wildcardFilter.exclude),
            free: pickFree(rec, wildcardFilter.free),
            maxPrice: pickNumber(rec, "maxPrice", wildcardFilter.maxPrice),
            minContext: pickNumber(rec, "minContext", wildcardFilter.minContext),
          }

    if (hasRules(filter)) result.set(id, filter)
  }

  return result
}

export default Plugin.define({
  id: "model-filter",
  async setup(ctx) {
    const filters = readFilters(ctx.options)

    // 只过滤内置模型；配置新增的模型在 commit 后合并、不经过 transform，用 "disabled":true 隐藏
    await ctx.model.transform((editor) => {
      const all = editor.list()
      const removedByProvider = new Map<string, Set<string>>()

      for (const model of all) {
        const filter = filters.get(model.providerID) ?? filters.get("*")
        if (!filter) continue
        if (shouldKeep(model, filter)) continue

        editor.remove(model.providerID, model.id)

        let set = removedByProvider.get(model.providerID)
        if (!set) {
          set = new Set()
          removedByProvider.set(model.providerID, set)
        }
        set.add(model.id)
      }

      // 默认模型被剔除时才改选
      const current = editor.default.get()
      if (current) {
        const removed = removedByProvider.get(current.providerID)
        if (removed?.has(current.modelID)) {
          const remaining = all.find(
            (model) => model.providerID === current.providerID && !removed.has(model.id),
          )
          if (remaining) editor.default.set(current.providerID, remaining.id)
        }
      }
    })
  },
})
