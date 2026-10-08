import { describe, expect, it } from 'vitest'
import { csvCell, toCsv, toJson, type ExportRow } from './exportData'

describe('CSV export', () => {
  it('quotes and escapes', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a, b')).toBe('"a, b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell(['Motorcycle', 'DIY'])).toBe('Motorcycle; DIY')
    expect(csvCell(null)).toBe('')
    expect(csvCell(true)).toBe('true')
  })

  it('neutralizes spreadsheet formula injection from saved web content', () => {
    expect(csvCell('=HYPERLINK("http://evil","x")')).toBe(`"'=HYPERLINK(""http://evil"",""x"")"`)
    expect(csvCell('+1+1')).toBe("'+1+1")
    expect(csvCell('-2')).toBe("'-2")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  const row: ExportRow = {
    url: 'https://www.instagram.com/reel/ABC/',
    title: '3D Printed Motorcycle Phone Mount',
    description: null,
    summary: 'A DIY mount.',
    category: 'Motorcycles',
    tags: ['Motorcycle', '3D Printing'],
    note: 'Need to try this for my XPulse.',
    collections: ['Bike Ideas'],
    source: 'instagram',
    source_type: 'reel',
    saved_at: '2026-09-12T10:00:00Z',
    favorite: true,
    archived: false,
  }

  it('produces a header + rows with BOM', () => {
    const csv = toCsv([row])
    expect(csv.startsWith('﻿url,title,')).toBe(true)
    expect(csv).toContain('Motorcycle; 3D Printing')
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('JSON export includes everything the spec lists', () => {
    const json = JSON.parse(toJson([row]))
    expect(json.count).toBe(1)
    expect(Object.keys(json.items[0])).toEqual(expect.arrayContaining(['url', 'title', 'description', 'summary', 'tags', 'note', 'collections', 'saved_at']))
  })
})
