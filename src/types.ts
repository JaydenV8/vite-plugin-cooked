export interface CookedOptions {
  defaultTarget?: string
  defaultMinify?: boolean
  defaultFormat?: 'es' | 'iife'
  defaultExternal?: string[] | '*'
}

export interface CookedQuery {
  to: 'js' | 'ts'
  minify: boolean
  target?: string
  banner?: string
  format?: 'es' | 'iife'
  nobundle: boolean
  external: string[] | '*' | null
}

export interface BundleOptions {
  filepath: string
  format: 'es' | 'iife'
  minify: boolean
  target?: string
  banner?: string
  resolve?: object
  define?: Record<string, unknown>
  external?: string[] | '*' | null
}
