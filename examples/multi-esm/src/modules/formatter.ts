import { capitalize, kebabCase } from 'lodash-es'

export function formatTitle(text: string): string {
  return text.split(' ').map(capitalize).join(' ')
}

export function toSlug(text: string): string {
  return kebabCase(text)
}
