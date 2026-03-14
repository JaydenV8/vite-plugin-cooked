import { groupBy, mapValues, round, meanBy, orderBy, escape } from 'lodash-es'

interface Item {
  id: number
  name: string
  score: number
}

const items: Item[] = [
  { id: 1, name: 'Alice', score: 85 },
  { id: 2, name: 'Bob', score: 92 },
  { id: 3, name: 'Charlie', score: 78 },
  { id: 4, name: 'Alice', score: 95 },
  { id: 5, name: 'Bob', score: 88 },
]

// Use lodash to group by name, then compute average score per person
const grouped = groupBy(items, 'name')
const averages = mapValues(grouped, (group) => round(meanBy(group, 'score'), 1))
const sorted = orderBy(
  Object.entries(averages).map(([name, avg]) => ({ name, avg })),
  'avg',
  'desc',
)

const html = sorted
  .map((r) => `<li><strong>${escape(r.name)}</strong>: ${r.avg}</li>`)
  .join('')

document.body.innerHTML = `
  <h2>Leaderboard (computed with lodash)</h2>
  <ol>${html}</ol>
`
