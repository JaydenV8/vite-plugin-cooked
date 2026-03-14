<p align="center">
  <img src="https://raw.githubusercontent.com/JaydenV8/vite-plugin-cooked/main/assets/logo.svg" width="140" />
</p>

<h1 align="center">vite-plugin-cooked</h1>

<p align="center">
  Vite's <code>?raw</code> gives you uncooked source. This plugin gives you the cooked version — compiled, bundled, and tree-shaken.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/vite-plugin-cooked"><img src="https://img.shields.io/npm/v/vite-plugin-cooked?color=f27d0d&label=" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/vite-plugin-cooked"><img src="https://img.shields.io/npm/dm/vite-plugin-cooked?color=c95f8b&label=" alt="npm downloads" /></a>
  <a href="https://github.com/JaydenV8/vite-plugin-cooked/blob/main/LICENSE"><img src="https://img.shields.io/github/license/JaydenV8/vite-plugin-cooked?color=61afef&label=" alt="license" /></a>
</p>

---

## Why

```ts
// ?raw → uncooked: types, JSX, and imports stay as-is. Can't run in a browser.
import raw from './worker.ts?raw'

// ?to=js → cooked: compiled to JS, all deps bundled in, tree-shaken. Ready to execute.
import cooked from './worker.ts?to=js'
```

## Install

```bash
npm install -D vite-plugin-cooked
```

## Setup

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import cooked from 'vite-plugin-cooked'

export default defineConfig({
  plugins: [cooked()],
})
```

## Usage

```ts
import code from './worker.ts?to=js'                          // bundle + compile to JS
import min from './worker.ts?minify&to=js'                    // + minify
import iife from './worker.ts?format=iife&minify&to=js'       // IIFE for Workers / <script>
import lite from './widget.tsx?external=react,react-dom&to=js' // keep react as import
import all from './lib.ts?external=*&to=js'                   // keep all bare imports
import raw from './utils.ts?nobundle&to=js'                   // single-file transpile only
```

> **TypeScript tip:** Put `to=js` / `to=ts` **last** in the query. The type declarations use `*to=js` patterns — `?minify&to=js` matches, `?to=js&minify` does not.

## Query Parameters

| Param | Values | Description |
|-------|--------|-------------|
| `to` | `js`, `ts` | Target format. `js` strips types and compiles JSX. |
| `minify` | flag | Minify the output. |
| `target` | e.g. `es2020` | Syntax downleveling target. |
| `banner` | string | Text prepended to output (URL-encode special chars). |
| `format` | `es`, `iife` | Output format. Default `es`. `iife` for Workers / scripts. |
| `external` | pkg names or `*` | Deps to exclude from bundle, comma-separated. `*` = all bare imports. |
| `nobundle` | flag | Skip bundling — transpile only, imports preserved. |

## Options

```ts
cooked({
  defaultTarget: 'es2020',
  defaultMinify: false,
  defaultFormat: 'es',
  defaultExternal: ['react', 'react-dom'],
})
```

## TypeScript

```json
{
  "compilerOptions": {
    "allowArbitraryExtensions": true,
    "types": ["vite-plugin-cooked/client"]
  }
}
```

## Bundle vs Nobundle

| | Bundle (default) | Nobundle (`&nobundle`) |
|---|---|---|
| **Imports** | Resolved, inlined, tree-shaken | Preserved as-is |
| **Output** | Self-contained | Single-file transpile |
| **Speed** | Slower (full build) | Fast |

## FAQ

**How is this different from `?worker`?**
`?worker` returns a Worker constructor from a separate file. cooked returns a **code string** — you control where it runs: Worker, iframe, `<script>`, sandbox.

**Isn't `?raw` enough?**
`?raw` returns uncompiled source. TypeScript types, JSX, and bare imports can't execute in a browser. cooked compiles and bundles first.

**Can I cook `.vue` / `.svelte` files?**
Not yet. The internal build uses `configFile: false` and doesn't load framework plugins.

## Limitations

- **Dep changes don't trigger HMR** — only the entry file is watched. Re-save entry or restart dev server.
- **CSS imports are ignored** — cooked outputs a string, CSS has nowhere to inject. A warning is logged.
- **No source maps** — output is a string constant. Use `&nobundle` for easier debugging.
- **Dynamic imports break** — no separate chunks exist after bundling. Use static imports only.
- **`import.meta.url` changes** — points to blob/injection URL, not the original file.
- **`?to=ts` requires `&nobundle`** — bundle mode always compiles to JS.
- **`&external=*` + `&format=iife`** — not supported. IIFE needs explicit globals mapping.
- **Build perf** — each cooked import runs a full `vite.build()`. Results are cached and concurrency is capped at 3.

## Compatibility

| Vite | Behavior |
|------|----------|
| 4 – 7 | `transformWithEsbuild` for nobundle transforms |
| 8+ | `transformWithOxc` when available, esbuild fallback for minification |

## License

[MIT](./LICENSE)
