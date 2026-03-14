import fs from 'node:fs'
import type { CookedQuery } from './types.js'

const cache = new Map<string, string>()

export async function getCacheKey(
  filepath: string,
  query: CookedQuery,
): Promise<string> {
  const stat = await fs.promises.stat(filepath)
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

function stableStringify(obj: CookedQuery): string {
  const record = obj as unknown as Record<string, unknown>
  return JSON.stringify(
    Object.keys(record)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = record[key]
        return acc
      }, {}),
  )
}
