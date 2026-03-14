import { cloneDeep } from 'lodash-es'
import { greet } from './utils/helper'

export const clone = (o: any) => cloneDeep(o)
export const hello = greet('world')
