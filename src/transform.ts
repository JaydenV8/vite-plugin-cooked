import * as vite from 'vite'
import type { CookedOptions, CookedQuery } from './types.js'

const useOxc = 'transformWithOxc' in vite

type Loader = 'ts' | 'tsx' | 'jsx' | 'js'

function inferLoader(filename: string): Loader {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'tsx':
      return 'tsx'
    case 'jsx':
      return 'jsx'
    case 'ts':
      return 'ts'
    default:
      return 'js'
  }
}

async function transformWithEsbuild(
  code: string,
  filename: string,
  query: CookedQuery,
  options?: CookedOptions,
): Promise<string> {
  const loader = inferLoader(filename)
  const target = query.target ?? options?.defaultTarget
  const minify = query.minify || (options?.defaultMinify ?? false)

  const result = await vite.transformWithEsbuild(code, filename, {
    loader,
    format: 'esm',
    minify,
    ...(target ? { target } : {}),
    ...(query.banner ? { banner: query.banner } : {}),
  })

  return result.code
}

async function transformWithOxc(
  code: string,
  filename: string,
  query: CookedQuery,
  options?: CookedOptions,
): Promise<string> {
  const target = query.target ?? options?.defaultTarget
  const minify = query.minify || (options?.defaultMinify ?? false)

  const oxcTransform = (vite as Record<string, unknown>)
    .transformWithOxc as typeof vite.transformWithEsbuild

  const result = await oxcTransform(code, filename, {
    ...(target ? { target } : {}),
  })

  let output = result.code

  if (minify) {
    const minified = await vite.transformWithEsbuild(output, 'output.js', {
      loader: 'js',
      minify: true,
    })
    output = minified.code
  }

  if (query.banner) {
    output = query.banner + '\n' + output
  }

  return output
}

export async function compileCode(
  code: string,
  filename: string,
  query: CookedQuery,
  options?: CookedOptions,
): Promise<string> {
  if (useOxc) {
    return transformWithOxc(code, filename, query, options)
  }
  return transformWithEsbuild(code, filename, query, options)
}
