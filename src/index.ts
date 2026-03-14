import fs from 'node:fs'
import type { Plugin, ResolvedConfig } from 'vite'
import { parseCookedQuery } from './parse-query.js'
import { compileCode } from './transform.js'
import { bundleCode } from './bundle.js'
import { getCacheKey, getFromCache, invalidateCache, setCache } from './cache.js'
import type { CookedOptions } from './types.js'

export type { CookedOptions, CookedQuery, BundleOptions } from './types.js'
export { parseCookedQuery } from './parse-query.js'
export { compileCode } from './transform.js'
export { bundleCode } from './bundle.js'

export default function cookedPlugin(options?: CookedOptions): Plugin {
  let resolvedConfig: ResolvedConfig

  return {
    name: 'vite-plugin-cooked',
    enforce: 'pre',

    configResolved(config) {
      resolvedConfig = config
    },

    configureServer(server) {
      server.watcher.on('change', (changedPath) => {
        invalidateCache(changedPath)
      })
    },

    async resolveId(source, importer) {
      const questionIndex = source.indexOf('?')
      if (questionIndex === -1) return null

      const rawPath = source.slice(0, questionIndex)
      const queryString = source.slice(questionIndex + 1)

      const params = new URLSearchParams(queryString)
      const to = params.get('to')
      if (!to || (to !== 'js' && to !== 'ts')) return null

      const resolved = await this.resolve(rawPath, importer, {
        skipSelf: true,
      })
      if (!resolved) return null

      return resolved.id + '?' + queryString
    },

    async load(id) {
      const parsed = parseCookedQuery(id)
      if (!parsed) return null

      const { filepath, query } = parsed

      if (query.to === 'ts' && !query.nobundle) {
        throw new Error(
          `[vite-plugin-cooked] ?to=ts cannot be used with bundle mode.\n` +
            `Bundle mode compiles everything to JS. Use ?to=ts&nobundle for syntax-only transformation.`,
        )
      }

      this.addWatchFile(filepath)

      const cacheKey = getCacheKey(
        filepath,
        query as unknown as Record<string, unknown>,
      )
      const cached = getFromCache(cacheKey)
      if (cached) {
        return {
          code: 'export default ' + JSON.stringify(cached),
          moduleType: 'js',
        }
      }

      let result: string

      if (query.nobundle) {
        const code = await fs.promises.readFile(filepath, 'utf-8')
        result = await compileCode(code, filepath, query, options)
      } else {
        const external =
          query.external ?? options?.defaultExternal ?? null

        result = await bundleCode({
          filepath,
          format: query.format ?? options?.defaultFormat ?? 'es',
          minify: query.minify || (options?.defaultMinify ?? false),
          target: query.target ?? options?.defaultTarget,
          banner: query.banner,
          resolve: resolvedConfig?.resolve,
          define: resolvedConfig?.define,
          external,
        })
      }

      setCache(cacheKey, result)

      return {
        code: 'export default ' + JSON.stringify(result),
        moduleType: 'js',
      }
    },
  }
}
