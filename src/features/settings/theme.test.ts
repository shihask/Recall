import { describe, expect, it } from 'vitest'
import { parseThemePreference, readStoredTheme, resolveTheme } from './theme'

describe('theme', () => {
  it('parses known preferences and defaults to system', () => {
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('neon')).toBe('system')
    expect(parseThemePreference(null)).toBe('system')
  })

  it('resolves system against the OS preference', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('survives storage that throws', () => {
    const throwing = { getItem: () => { throw new Error('blocked') } }
    expect(readStoredTheme(throwing)).toBe('system')
    expect(readStoredTheme(undefined)).toBe('system')
  })
})
