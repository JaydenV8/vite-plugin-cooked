import { pick } from 'lodash-es'

export const p = (o: any) => pick(o, ['a'])
