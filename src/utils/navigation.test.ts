import { describe, expect, it } from 'vitest'
import { safeNextPath } from './navigation'

describe('safeNextPath', () => {
  it('keeps in-app paths', () => {
    expect(safeNextPath('/search?q=bike')).toBe('/search?q=bike')
  })
  it.each([null, '', 'https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)'])('rejects %j', (v) => {
    expect(safeNextPath(v)).toBe('/home')
  })
})
