import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parseCookedQuery } from '../src/parse-query.js'
import { compileCode } from '../src/transform.js'
import { bundleCode, buildGlobalsMap } from '../src/bundle.js'
import { getCacheKey, getFromCache, invalidateCache, setCache } from '../src/cache.js'
import cookedPlugin from '../src/index.js'
import type { CookedQuery } from '../src/types.js'

const fixtures = path.resolve(__dirname, 'fixtures')
const fixture = (name: string) => path.join(fixtures, name)

// ─── parseCookedQuery ────────────────────────────────────────────────

describe('parseCookedQuery', () => {
  it('parses valid ?to=js query', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js')
    expect(result).toEqual({
      filepath: '/foo/bar.ts',
      query: {
        to: 'js',
        minify: false,
        target: undefined,
        banner: undefined,
        format: undefined,
        nobundle: false,
        external: null,
      },
    })
  })

  it('parses ?to=ts query', () => {
    const result = parseCookedQuery('/foo/bar.tsx?to=ts')
    expect(result).toEqual({
      filepath: '/foo/bar.tsx',
      query: {
        to: 'ts',
        minify: false,
        target: undefined,
        banner: undefined,
        format: undefined,
        nobundle: false,
        external: null,
      },
    })
  })

  it('parses minify flag', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js&minify')
    expect(result?.query.minify).toBe(true)
  })

  it('parses target param', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js&target=es2020')
    expect(result?.query.target).toBe('es2020')
  })

  it('parses banner param', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js&banner=%2F%2F%20hello')
    expect(result?.query.banner).toBe('// hello')
  })

  it('parses format=iife', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js&format=iife')
    expect(result?.query.format).toBe('iife')
  })

  it('defaults format to undefined when not specified', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js')
    expect(result?.query.format).toBeUndefined()
  })

  it('parses nobundle flag', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js&nobundle')
    expect(result?.query.nobundle).toBe(true)
  })

  it('parses external with single package', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js&external=lodash-es')
    expect(result?.query.external).toEqual(['lodash-es'])
  })

  it('parses external with multiple packages', () => {
    const result = parseCookedQuery(
      '/foo/bar.ts?to=js&external=react,react-dom',
    )
    expect(result?.query.external).toEqual(['react', 'react-dom'])
  })

  it('parses external=*', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js&external=*')
    expect(result?.query.external).toBe('*')
  })

  it('defaults external to null', () => {
    const result = parseCookedQuery('/foo/bar.ts?to=js')
    expect(result?.query.external).toBeNull()
  })

  it('returns null for missing to param', () => {
    expect(parseCookedQuery('/foo/bar.ts?raw')).toBeNull()
  })

  it('returns null for invalid to value', () => {
    expect(parseCookedQuery('/foo/bar.ts?to=css')).toBeNull()
  })

  it('returns null for no query string', () => {
    expect(parseCookedQuery('/foo/bar.ts')).toBeNull()
  })
})

// ─── compileCode (nobundle / v1 behavior) ────────────────────────────

describe('compileCode', () => {
  const basicQuery: CookedQuery = {
    to: 'js',
    minify: false,
    format: 'es',
    nobundle: true,
    external: null,
  }

  it('compiles TS to JS (strips type annotations)', async () => {
    const code = 'export const foo: string = "bar"'
    const result = await compileCode(code, 'test.ts', basicQuery)
    expect(result).toContain('export const foo')
    expect(result).not.toContain(': string')
  })

  it('compiles TSX to JS (compiles JSX)', async () => {
    const code = 'export const App = () => <div>hello</div>'
    const result = await compileCode(code, 'test.tsx', basicQuery)
    expect(result).not.toContain('<div>')
    expect(result).toContain('hello')
  })

  it('strips interfaces and type aliases', async () => {
    const code = `
      interface User { name: string }
      type Status = 'active' | 'inactive'
      export function greet(user: User): string { return user.name }
    `
    const result = await compileCode(code, 'test.ts', basicQuery)
    expect(result).not.toContain('interface')
    expect(result).not.toContain('type Status')
    expect(result).toContain('function greet')
  })

  it('minifies output when minify is true', async () => {
    const code = `
      export function hello() {
        const message = "world"
        return message
      }
    `
    const normal = await compileCode(code, 'test.ts', basicQuery)
    const minified = await compileCode(code, 'test.ts', {
      ...basicQuery,
      minify: true,
    })
    expect(minified.length).toBeLessThan(normal.length)
  })

  it('accepts target option', async () => {
    const code = 'export const foo: string = "bar"'
    const result = await compileCode(code, 'test.ts', {
      ...basicQuery,
      target: 'es2020',
    })
    expect(result).toContain('export const foo')
  })

  it('prepends banner', async () => {
    const code = 'export const foo: string = "bar"'
    const result = await compileCode(code, 'test.ts', {
      ...basicQuery,
      banner: '// MIT License',
    })
    expect(result.trimStart().startsWith('// MIT License')).toBe(true)
  })

  it('throws on syntax error', async () => {
    const code = 'export const foo = {{{'
    await expect(compileCode(code, 'test.ts', basicQuery)).rejects.toThrow()
  })
})

// ─── bundleCode ──────────────────────────────────────────────────────

describe('bundleCode', () => {
  it('outputs self-contained JS with no import residue', async () => {
    const code = await bundleCode({
      filepath: fixture('with-import.ts'),
      format: 'es',
      minify: false,
    })
    expect(code).not.toMatch(/\bimport\b.*from/)
    expect(code).toContain('cloneDeep')
  })

  it('inlines dependencies', async () => {
    const code = await bundleCode({
      filepath: fixture('with-import.ts'),
      format: 'es',
      minify: false,
    })
    expect(code.length).toBeGreaterThan(100)
    expect(code).not.toMatch(/\bimport\b.*from\s+['"]lodash-es['"]/)
  })

  it('tree-shakes unused exports', async () => {
    const code = await bundleCode({
      filepath: fixture('tree-shake.ts'),
      format: 'es',
      minify: false,
    })
    expect(code).not.toContain('cloneDeep')
    expect(code).not.toContain('merge')
  })

  it('format=iife wraps output', async () => {
    const code = await bundleCode({
      filepath: fixture('basic.ts'),
      format: 'iife',
      minify: false,
    })
    expect(code).toMatch(/\bfunction\b/)
  })

  it('format=es preserves export', async () => {
    const code = await bundleCode({
      filepath: fixture('basic.ts'),
      format: 'es',
      minify: false,
    })
    expect(code).toContain('export')
  })

  it('minifies output', async () => {
    const normal = await bundleCode({
      filepath: fixture('basic.ts'),
      format: 'es',
      minify: false,
    })
    const minified = await bundleCode({
      filepath: fixture('basic.ts'),
      format: 'es',
      minify: true,
    })
    expect(minified.length).toBeLessThan(normal.length)
  })

  it('rejects non-JS asset imports', async () => {
    await expect(
      bundleCode({
        filepath: fixture('with-asset.ts'),
        format: 'es',
        minify: false,
      }),
    ).rejects.toThrow(/Cannot bundle non-JS asset/)
  })

  it('supports resolve.alias', async () => {
    const code = await bundleCode({
      filepath: fixture('with-alias.ts'),
      format: 'es',
      minify: false,
      resolve: {
        alias: {
          '@utils': path.join(fixtures, 'utils'),
        },
      },
    })
    expect(code).toContain('Hello')
    expect(code).not.toMatch(/\bimport\b.*from\s+['"]@utils/)
  })

  it('ignores CSS imports without error', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const code = await bundleCode({
      filepath: fixture('with-css.ts'),
      format: 'es',
      minify: false,
    })
    expect(code).toContain('greeting')
    expect(code).not.toContain('color: red')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[vite-plugin-cooked] CSS import ignored'),
    )
    warnSpy.mockRestore()
  })

  it('runs multiple bundles concurrently within limit', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        bundleCode({
          filepath: fixture('basic.ts'),
          format: 'es',
          minify: false,
        }),
      ),
    )
    for (const code of results) {
      expect(code).toContain('foo')
    }
  })
})

// ─── external ────────────────────────────────────────────────────────

describe('external', () => {
  it('keeps specified dependency as import statement', async () => {
    const code = await bundleCode({
      filepath: fixture('with-external.ts'),
      format: 'es',
      minify: false,
      external: ['lodash-es'],
    })
    expect(code).toMatch(/\bimport\b.*['"]lodash-es['"]/)
    // lodash internals should NOT be inlined
    expect(code.length).toBeLessThan(500)
  })

  it('matches sub-paths (lodash-es/cloneDeep)', async () => {
    const code = await bundleCode({
      filepath: fixture('with-external.ts'),
      format: 'es',
      minify: false,
      external: ['lodash-es'],
    })
    // Should not contain inlined lodash code
    expect(code).not.toContain('baseClone')
  })

  it('external=* keeps all bare imports', async () => {
    const code = await bundleCode({
      filepath: fixture('with-multi-external.ts'),
      format: 'es',
      minify: false,
      external: '*',
    })
    // lodash-es stays as import
    expect(code).toMatch(/['"]lodash-es['"]/)
    // local ./utils/helper gets inlined
    expect(code).toContain('Hello')
    expect(code).not.toMatch(/['"]\.\/utils\/helper['"]/)
  })

  it('inlines non-external deps normally', async () => {
    const code = await bundleCode({
      filepath: fixture('with-multi-external.ts'),
      format: 'es',
      minify: false,
      external: ['lodash-es'],
    })
    // lodash-es external
    expect(code).toMatch(/['"]lodash-es['"]/)
    // local helper inlined
    expect(code).toContain('Hello')
  })

  it('external + format=iife uses globals mapping', async () => {
    const code = await bundleCode({
      filepath: fixture('with-external.ts'),
      format: 'iife',
      minify: false,
      external: ['lodash-es'],
    })
    // IIFE should reference the global variable (lodash-es → lodashEs)
    expect(code).toContain('lodashEs')
  })

  it('buildGlobalsMap preserves scope in global name', () => {
    const globals = buildGlobalsMap(['@emotion/react', '@scope/my-pkg', 'lodash-es'])
    expect(globals['@emotion/react']).toBe('emotionReact')
    expect(globals['@scope/my-pkg']).toBe('scopeMyPkg')
    expect(globals['lodash-es']).toBe('lodashEs')
  })

  it('external=* + format=iife throws', async () => {
    await expect(
      bundleCode({
        filepath: fixture('with-external.ts'),
        format: 'iife',
        minify: false,
        external: '*',
      }),
    ).rejects.toThrow(/cannot be used with &format=iife/)
  })

  it('nobundle mode ignores external', async () => {
    const code =
      'import { cloneDeep } from "lodash-es"\nexport const x = cloneDeep({})'
    const result = await compileCode(code, 'test.ts', {
      to: 'js',
      minify: false,
      format: 'es',
      nobundle: true,
      external: ['lodash-es'],
    })
    // nobundle always preserves imports regardless of external
    expect(result).toContain('import')
    expect(result).toContain('lodash-es')
  })

  it('plugin defaultExternal applies when query has no external', async () => {
    const plugin = cookedPlugin({ defaultExternal: ['lodash-es'] })
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    const id = fixture('with-external.ts') + '?to=js'
    const result = await load.call({ addWatchFile }, id)

    expect(result.code).toContain('lodash-es')
    // Should be a short output (not inlined)
    const exported = JSON.parse(
      result.code.replace('export default ', ''),
    ) as string
    expect(exported.length).toBeLessThan(500)
  })

  it('query external overrides defaultExternal', async () => {
    const plugin = cookedPlugin({ defaultExternal: ['nonexistent-pkg'] })
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    // Query specifies lodash-es as external, overriding default
    const id = fixture('with-external.ts') + '?to=js&external=lodash-es'
    const result = await load.call({ addWatchFile }, id)

    const exported = JSON.parse(
      result.code.replace('export default ', ''),
    ) as string
    expect(exported).toMatch(/['"]lodash-es['"]/)
  })
})

// ─── cache ───────────────────────────────────────────────────────────

describe('cache', () => {
  it('returns cached result on second call', async () => {
    const filepath = fixture('basic.ts')
    const query = {
      to: 'js' as const,
      minify: false,
      format: 'es' as const,
      nobundle: false,
      external: null,
    }

    const key = await getCacheKey(filepath, query)
    expect(getFromCache(key)).toBeUndefined()

    setCache(key, 'cached-code')
    expect(getFromCache(key)).toBe('cached-code')

    invalidateCache(filepath)
    expect(getFromCache(key)).toBeUndefined()
  })

  it('generates different keys for different queries', async () => {
    const filepath = fixture('basic.ts')
    const key1 = await getCacheKey(filepath, {
      to: 'js',
      minify: false,
      nobundle: false,
      external: null,
    })
    const key2 = await getCacheKey(filepath, {
      to: 'js',
      minify: true,
      nobundle: false,
      external: null,
    })
    expect(key1).not.toBe(key2)
  })

  it('generates different keys for different external values', async () => {
    const filepath = fixture('basic.ts')
    const key1 = await getCacheKey(filepath, {
      to: 'js',
      minify: false,
      nobundle: false,
      external: null,
    })
    const key2 = await getCacheKey(filepath, {
      to: 'js',
      minify: false,
      nobundle: false,
      external: ['lodash-es'],
    })
    expect(key1).not.toBe(key2)
  })
})

// ─── nobundle mode (v1 compatibility) ────────────────────────────────

describe('nobundle mode', () => {
  it('preserves import statements', async () => {
    const code = 'import { foo } from "bar"\nexport const x: number = foo()'
    const result = await compileCode(code, 'test.ts', {
      to: 'js',
      minify: false,
      format: 'es',
      nobundle: true,
      external: null,
    })
    expect(result).toContain('import')
    expect(result).toContain('from "bar"')
  })

  it('strips TS types', async () => {
    const code = 'import { foo } from "bar"\nexport const x: number = foo()'
    const result = await compileCode(code, 'test.ts', {
      to: 'js',
      minify: false,
      format: 'es',
      nobundle: true,
      external: null,
    })
    expect(result).not.toContain(': number')
  })
})

// ─── plugin hooks ────────────────────────────────────────────────────

describe('plugin hooks', () => {
  it('resolveId resolves relative paths with query', async () => {
    const plugin = cookedPlugin()
    const resolveId = plugin.resolveId as Function

    const resolvedFixture = fixture('basic.ts')
    const result = await resolveId.call(
      {
        resolve: vi.fn().mockResolvedValue({ id: resolvedFixture }),
      },
      './basic.ts?to=js',
      '/project/src/main.ts',
    )

    expect(result).toContain(resolvedFixture)
    expect(result).toContain('?to=js')
  })

  it('resolveId returns null for non-cooked imports', async () => {
    const plugin = cookedPlugin()
    const resolveId = plugin.resolveId as Function

    const result = await resolveId.call(
      { resolve: vi.fn() },
      './basic.ts',
      '/project/src/main.ts',
    )
    expect(result).toBeNull()
  })

  it('resolveId returns null for invalid to value', async () => {
    const plugin = cookedPlugin()
    const resolveId = plugin.resolveId as Function

    const result = await resolveId.call(
      { resolve: vi.fn() },
      './basic.ts?to=css',
      '/project/src/main.ts',
    )
    expect(result).toBeNull()
  })

  it('load with nobundle returns compiled code as default export', async () => {
    const plugin = cookedPlugin()
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    const id = fixture('basic.ts') + '?to=js&nobundle'
    const result = await load.call({ addWatchFile }, id)

    expect(result).not.toBeNull()
    expect(result.code).toMatch(/^export default "/)
    expect(result.code).not.toContain(': string')
    expect(result.moduleType).toBe('js')
    expect(addWatchFile).toHaveBeenCalledWith(fixture('basic.ts'))
  })

  it('load with bundle returns self-contained code', async () => {
    const plugin = cookedPlugin()
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    const id = fixture('basic.ts') + '?to=js'
    const result = await load.call({ addWatchFile }, id)

    expect(result).not.toBeNull()
    expect(result.code).toMatch(/^export default "/)
    expect(result.moduleType).toBe('js')
  })

  it('load returns null for non-cooked ids', async () => {
    const plugin = cookedPlugin()
    const load = plugin.load as Function

    const result = await load.call({}, '/foo/bar.ts')
    expect(result).toBeNull()
  })

  it('resolveId returns null when source has no query string', async () => {
    const plugin = cookedPlugin()
    const resolveId = plugin.resolveId as Function

    const result = await resolveId.call(
      { resolve: vi.fn() },
      '/path/to=something/file.ts',
      '/project/src/main.ts',
    )
    expect(result).toBeNull()
  })

  it('resolveId returns null when this.resolve returns null', async () => {
    const plugin = cookedPlugin()
    const resolveId = plugin.resolveId as Function

    const result = await resolveId.call(
      { resolve: vi.fn().mockResolvedValue(null) },
      './nonexistent.ts?to=js',
      '/project/src/main.ts',
    )
    expect(result).toBeNull()
  })

  it('load with ?to=ts&nobundle succeeds', async () => {
    const plugin = cookedPlugin()
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    const id = fixture('basic.ts') + '?to=ts&nobundle'
    const result = await load.call({ addWatchFile }, id)

    expect(result).not.toBeNull()
    expect(result.code).toMatch(/^export default "/)
    expect(result.moduleType).toBe('js')
  })

  it('defaultFormat option takes effect when query has no format', async () => {
    const plugin = cookedPlugin({ defaultFormat: 'iife' })
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    // Use with-types.ts to avoid cache collision with earlier basic.ts tests
    const id = fixture('with-types.ts') + '?to=js'
    const result = await load.call({ addWatchFile }, id)

    const exported = JSON.parse(
      result.code.replace('export default ', ''),
    ) as string
    // IIFE wraps in a function
    expect(exported).toMatch(/\bfunction\b/)
  })

  it('load throws when ?to=ts used without nobundle', async () => {
    const plugin = cookedPlugin()
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    const id = fixture('basic.ts') + '?to=ts'
    await expect(load.call({ addWatchFile }, id)).rejects.toThrow(
      /\?to=ts cannot be used with bundle mode/,
    )
  })

  it('load does not include HMR code without dev server', async () => {
    const plugin = cookedPlugin()
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    const id = fixture('basic.ts') + '?to=js&nobundle'
    const result = await load.call({ addWatchFile }, id)

    expect(result.code).not.toContain('import.meta.hot')
  })

  it('load includes HMR accept code after configureServer', async () => {
    const plugin = cookedPlugin()
    const configureServer = plugin.configureServer as Function
    const load = plugin.load as Function
    const addWatchFile = vi.fn()

    // Simulate dev server
    const mockServer = {
      watcher: { on: vi.fn() },
      moduleGraph: { idToModuleMap: new Map() },
    }
    configureServer(mockServer)

    const id = fixture('with-types.ts') + '?to=js&nobundle'
    const result = await load.call({ addWatchFile }, id)

    expect(result.code).toContain('export default ')
    expect(result.code).toContain('import.meta.hot')
    expect(result.code).toContain('import.meta.hot.accept()')
  })

  it('configureServer invalidates cooked modules on file change', () => {
    const plugin = cookedPlugin()
    const configureServer = plugin.configureServer as Function

    const invalidateModule = vi.fn()
    const cookedModId = fixture('basic.ts') + '?to=js'
    const otherModId = '/some/other.ts?to=js'

    const mockMod = { id: cookedModId }
    const otherMod = { id: otherModId }
    const idToModuleMap = new Map([
      [cookedModId, mockMod],
      [otherModId, otherMod],
    ])

    let changeHandler: Function
    const mockServer = {
      watcher: {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'change') changeHandler = handler
        }),
      },
      moduleGraph: { idToModuleMap, invalidateModule },
    }

    configureServer(mockServer)

    // Trigger file change for the cooked source file
    changeHandler!(fixture('basic.ts'))

    // Should invalidate the matching cooked module
    expect(invalidateModule).toHaveBeenCalledWith(mockMod)
    // Should NOT invalidate unrelated modules
    expect(invalidateModule).not.toHaveBeenCalledWith(otherMod)
  })
})
