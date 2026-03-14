import { escape } from 'lodash-es'

interface CardData {
  title: string
  value: string | number
}

export function renderCard(data: CardData): string {
  return `
    <div style="border:1px solid #ddd;border-radius:8px;padding:16px;margin:8px;min-width:150px">
      <h3 style="margin:0 0 8px">${escape(data.title)}</h3>
      <p style="margin:0;font-size:24px;font-weight:bold">${escape(String(data.value))}</p>
    </div>
  `
}

export function renderList(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>`
}
