export interface User {
  username: string
  sub: string
  email: string
  name?: string
  enabled: boolean
  status: string
  providers: string[]
  createdAt?: string
  groups: string[]
}
export const APPS = [
  { id: 'carlog', name: 'CarLog', accent: 'car' },
  { id: 'gighunter', name: 'GigHunter', accent: 'gig' },
  { id: 'foodlog', name: 'FoodLog', accent: 'food' },
] as const
