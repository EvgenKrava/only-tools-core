import { describe, expect, it } from 'vitest'
import { HttpError, assertCanChange, isRole, parseGroups } from './roles'

describe('parseGroups', () => {
  it('reads the bracketed string form API Gateway sends', () => {
    expect(parseGroups('[platform-admin carlog-user]')).toEqual(['platform-admin', 'carlog-user'])
  })
  it('accepts arrays and empty values', () => {
    expect(parseGroups(['a', 'b'])).toEqual(['a', 'b'])
    expect(parseGroups(undefined)).toEqual([])
    expect(parseGroups('')).toEqual([])
  })
})

describe('roles', () => {
  it('knows app and platform roles only', () => {
    expect(isRole('gighunter-user')).toBe(true)
    expect(isRole('foodlog-admin')).toBe(true)
    expect(isRole('root')).toBe(false)
  })
})

describe('assertCanChange', () => {
  it('stops an admin removing their own platform-admin or disabling themselves', () => {
    expect(() => assertCanChange('me', 'me', 'platform-admin', 'remove')).toThrow(HttpError)
    expect(() => assertCanChange('me', 'me', null, 'disable')).toThrow(HttpError)
  })
  it('allows the same actions on other users and other self changes', () => {
    expect(() => assertCanChange('me', 'you', 'platform-admin', 'remove')).not.toThrow()
    expect(() => assertCanChange('me', 'me', 'carlog-user', 'remove')).not.toThrow()
  })
})
