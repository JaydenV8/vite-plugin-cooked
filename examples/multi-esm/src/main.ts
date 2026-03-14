// Each module is cooked separately with lodash-es as external.
// The host page provides lodash-es via importmap,
// so all three modules share the same lodash instance — no duplication.
import mathCode from './modules/math.ts?external=lodash-es&to=js'
import formatterCode from './modules/formatter.ts?external=lodash-es&to=js'
import rendererCode from './modules/renderer.ts?external=lodash-es&to=js'

const modules = {
  math: { name: 'math', code: mathCode },
  formatter: { name: 'formatter', code: formatterCode },
  renderer: { name: 'renderer', code: rendererCode },
}

// Display each module's compiled code size
const info = document.querySelector('#info')!
for (const mod of Object.values(modules)) {
  const size = new Blob([mod.code]).size
  info.innerHTML += `<p><strong>${mod.name}</strong>: ${size} bytes (lodash-es not included)</p>`
}

// Load all modules into an iframe that has lodash-es via importmap
const iframe = document.createElement('iframe')
iframe.style.cssText = 'width:100%;height:400px;border:1px solid #ccc;border-radius:4px'
document.querySelector('#sandbox')!.appendChild(iframe)

const doc = iframe.contentDocument!
doc.open()
doc.write(`
<!DOCTYPE html>
<html>
<head>
  <script type="importmap">
  {
    "imports": {
      "lodash-es": "https://cdn.jsdelivr.net/npm/lodash-es@4.17.21/+esm"
    }
  }
  <\/script>
</head>
<body>
  <div id="output" style="display:flex;flex-wrap:wrap"></div>
  <div id="list"></div>
  <script type="module">
    // Create blob URLs for each cooked module
    function toModule(code) {
      return URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))
    }

    // Import the cooked modules dynamically
    const [math, formatter, renderer] = await Promise.all([
      import(toModule(${JSON.stringify(mathCode)})),
      import(toModule(${JSON.stringify(formatterCode)})),
      import(toModule(${JSON.stringify(rendererCode)})),
    ])

    const scores = [85, 92, 78, 95, 88]
    const output = document.getElementById('output')
    const list = document.getElementById('list')

    output.innerHTML =
      renderer.renderCard({ title: 'Average', value: math.average(scores) }) +
      renderer.renderCard({ title: 'Total', value: math.total(scores) })

    const titles = ['hello world', 'multi esm demo', 'vite plugin cooked']
    list.innerHTML =
      '<h3>Formatted Titles</h3>' +
      renderer.renderList(titles.map(t =>
        formatter.formatTitle(t) + ' (' + formatter.toSlug(t) + ')'
      ))
  <\/script>
</body>
</html>
`)
doc.close()
