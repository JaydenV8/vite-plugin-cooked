// Bundle mode (default in v2): lodash-es is bundled into the string,
// no CDN needed — the output is fully self-contained.
import sandboxCode from './sandbox.ts?format=iife&minify&to=js'

const iframe = document.createElement('iframe')
iframe.style.cssText = 'width:100%;height:300px;border:1px solid #ccc;border-radius:4px'
document.querySelector('#sandbox')!.appendChild(iframe)

const doc = iframe.contentDocument!
const script = doc.createElement('script')
script.textContent = sandboxCode
doc.body.appendChild(script)
