interface User {
  name: string
  age: number
}

type Status = 'active' | 'inactive'

function greet<T extends User>(user: T): string {
  return `Hello, ${user.name}`
}

export { greet, type User, type Status }
