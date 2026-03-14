import { round, mean, sum } from 'lodash-es'

export function average(numbers: number[]): number {
  return round(mean(numbers), 2)
}

export function total(numbers: number[]): number {
  return sum(numbers)
}
