import workerCode from './worker.ts?minify&to=js'

// Create an inline Web Worker from compiled code
const blob = new Blob([workerCode], { type: 'application/javascript' })
const worker = new Worker(URL.createObjectURL(blob))

worker.onmessage = (e) => {
  document.querySelector('#result')!.textContent =
    `fibonacci(${n}) = ${e.data.payload}`
}

const n = 10
worker.postMessage({ type: 'compute', payload: n })
