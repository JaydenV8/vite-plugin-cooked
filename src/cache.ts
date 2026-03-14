import fs from 'node:fs'

const cache = new Map<string, string>()

export function getCacheKey(
  filepath: string,
  query: CookedQuery_Like,
): string {
  const stat = fs.statSync(filepath)
  const fingerprint = `${stat.mtimeMs}:${stat.size}`
  const queryStr = stableStringify(query)
  return `${filepath}:${queryStr}:${fingerprint}`
}

export function getFromCache(key: string): string | undefined {
  return cache.get(key)
}

export function setCache(key: string, code: string): void {
  cache.set(key, code)
}

export function invalidateCache(filepath: string): void {
  const prefix = filepath + ':'
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key)
    }
  }
}

type CookedQuery_Like = Record<string, unknown>

function stableStringify(obj: CookedQuery_Like): string {
  return JSON.stringify(
    Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = obj[key]
        return acc
      }, {}),
  )
}
