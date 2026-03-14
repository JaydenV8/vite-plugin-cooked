import type { CookedQuery } from './types.js'

const VALID_TO_VALUES = new Set(['js', 'ts'])
const VALID_FORMATS = new Set(['es', 'iife'])

export function parseCookedQuery(
  id: string,
): { filepath: string; query: CookedQuery } | null {
  const questionIndex = id.indexOf('?')
  if (questionIndex === -1) return null

  const filepath = id.slice(0, questionIndex)
  const params = new URLSearchParams(id.slice(questionIndex + 1))

  const to = params.get('to')
  if (!to || !VALID_TO_VALUES.has(to)) return null

  const format = params.get('format')

  let external: CookedQuery['external'] = null
  const externalParam = params.get('external')
  if (externalParam === '*') {
    external = '*'
  } else if (externalParam) {
    external = externalParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }

  return {
    filepath,
    query: {
      to: to as CookedQuery['to'],
      minify: params.has('minify'),
      target: params.get('target') ?? undefined,
      banner: params.get('banner') ?? undefined,
      format:
        format && VALID_FORMATS.has(format)
          ? (format as NonNullable<CookedQuery['format']>)
          : undefined,
      nobundle: params.has('nobundle'),
      external,
    },
  }
}
