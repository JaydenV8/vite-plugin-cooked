import type { Plugin } from 'vite'
import * as vite from 'vite'
import type { BundleOptions } from './types.js'

const ASSET_RE =
  /\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf|eot|wasm|mp3|mp4|webm)(\?|$)/

const CSS_RE = /\.(css|scss|sass|less|styl|stylus|pcss|postcss)(\?|$)/

const warnedCss = new Set<string>()

const assetBlockerPlugin: Plugin = {
  name: 'cooked-asset-blocker',
  enforce: 'pre',
  resolveId(source) {
    if (ASSET_RE.test(source)) {
      throw new Error(
        `[vite-plugin-cooked] Cannot bundle non-JS asset: ${source}\n` +
          `cooked only supports JS/TS/JSON modules. Remove this import or use &nobundle mode.`,
      )
    }
  },
  load(id) {
    if (ASSET_RE.test(id)) {
      throw new Error(
        `[vite-plugin-cooked] Cannot bundle non-JS asset: ${id}\n` +
          `cooked only supports JS/TS/JSON modules. Remove this import or use &nobundle mode.`,
      )
    }
    if (CSS_RE.test(id)) {
      if (!warnedCss.has(id)) {
        warnedCss.add(id)
        console.warn(
          `[vite-plugin-cooked] CSS import ignored: ${id}\n` +
            `CSS cannot be injected when code runs as a string. ` +
            `Move styles to the host application or inline them manually.`,
        )
      }
      return { code: '', moduleType: 'js' }
    }
  },
}

let running = 0
const queue: Array<{
  resolve: (value: string) => void
  reject: (reason: unknown) => void
  fn: () => Promise<string>
}> = []
const MAX_CONCURRENT = 3

function flush(): void {
  while (queue.length > 0 && running < MAX_CONCURRENT) {
    const item = queue.shift()!
    running++
    item.fn().then(
      (result) => {
        running--
        item.resolve(result)
        flush()
      },
      (err) => {
        running--
        item.reject(err)
        flush()
      },
    )
  }
}

function enqueue(fn: () => Promise<string>): Promise<string> {
  if (running < MAX_CONCURRENT) {
    running++
    return fn().finally(() => {
      running--
      flush()
    })
  }
  return new Promise((resolve, reject) => {
    queue.push({ resolve, reject, fn })
  })
}

function buildGlobalsMap(
  external: string[],
): Record<string, string> {
  const globals: Record<string, string> = {}
  for (const pkg of external) {
    // Strip scope prefix (@scope/pkg → pkg), then camelCase
    const bare = pkg.startsWith('@') ? pkg.split('/')[1] ?? pkg : pkg
    globals[pkg] = bare.replace(/[-.](\w)/g, (_, c: string) => c.toUpperCase())
  }
  return globals
}

function buildRollupExternal(
  external: string[] | '*',
): string[] | ((id: string) => boolean) {
  if (external === '*') {
    return (id: string) =>
      !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0')
  }
  return (id: string) =>
    external.some((ext) => id === ext || id.startsWith(ext + '/'))
}

export async function bundleCode(options: BundleOptions): Promise<string> {
  const { external } = options

  if (external === '*' && options.format === 'iife') {
    throw new Error(
      `[vite-plugin-cooked] &external=* cannot be used with &format=iife.\n` +
        `IIFE format requires mapping external imports to global variable names, ` +
        `which is impossible with wildcard external. Use &format=es instead.`,
    )
  }

  const rollupExternal = external ? buildRollupExternal(external) : undefined

  const globals =
    options.format === 'iife' && Array.isArray(external)
      ? buildGlobalsMap(external)
      : undefined

  return enqueue(async () => {
    const result = await vite.build({
      configFile: false,
      plugins: [assetBlockerPlugin],
      resolve: options.resolve,
      define: options.define,
      build: {
        lib: {
          entry: options.filepath,
          formats: [options.format],
          fileName: 'output',
          ...(options.format === 'iife' ? { name: '_cooked' } : {}),
        },
        write: false,
        minify: options.minify ? 'esbuild' : false,
        target: options.target,
        rollupOptions: {
          external: rollupExternal,
          output: {
            banner: options.banner,
            globals,
          },
        },
      },
      logLevel: 'silent',
    })

    const output = Array.isArray(result) ? result[0] : result
    if ('output' in output) {
      return output.output[0].code
    }
    throw new Error('[vite-plugin-cooked] Unexpected build result')
  })
}
