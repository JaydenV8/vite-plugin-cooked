interface Message {
  type: string
  payload: number
}

self.onmessage = (e: MessageEvent<Message>) => {
  const { type, payload } = e.data

  if (type === 'compute') {
    const result = fibonacci(payload)
    self.postMessage({ type: 'result', payload: result })
  }
}

function fibonacci(n: number): number {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}
