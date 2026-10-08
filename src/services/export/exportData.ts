import { supabase } from '@/lib/supabase'
import { toAppError } from '@/services/supabase/errors'

// Paged so even a very large library exports without one giant request.
const BATCH = 500

export interface ExportRow {
  url: string
  title: string | null
  description: string | null
  summary: string | null
  category: string | null
  tags: string[]
  note: string | null
  collections: string[]
  source: string
  source_type: string
  saved_at: string
  favorite: boolean
  archived: boolean
}

type Raw = {
  url: string
  title: string | null
  description: string | null
  ai_summary: string | null
  ai_category: string | null
  personal_note: string | null
  source: string
  source_type: string
  saved_at: string
  is_favorite: boolean
  is_archived: boolean
  item_tags: { tags: { name: string } | null }[]
  collection_items: { collections: { name: string; parent: { name: string } | null } | null }[]
}

export async function fetchAllForExport(onProgress?: (count: number) => void): Promise<ExportRow[]> {
  const rows: ExportRow[] = []
  for (let offset = 0; ; offset += BATCH) {
    const { data, error } = await supabase
      .from('saved_items')
      .select(
        'url, title, description, ai_summary, ai_category, personal_note, source, source_type, saved_at, is_favorite, is_archived, item_tags(tags(name)), collection_items(collections(name, parent:parent_id(name)))',
      )
      .order('saved_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + BATCH - 1)
      .overrideTypes<Raw[], { merge: false }>()
    if (error) throw toAppError(error)
    for (const r of data) {
      rows.push({
        url: r.url,
        title: r.title,
        description: r.description,
        summary: r.ai_summary,
        category: r.ai_category,
        tags: r.item_tags.map((t) => t.tags?.name).filter((n): n is string => !!n),
        note: r.personal_note,
        // Sub-collections as "Travel / Munnar".
        collections: r.collection_items
          .map(({ collections: c }) => c && (c.parent ? `${c.parent.name} / ${c.name}` : c.name))
          .filter((n): n is string => !!n),
        source: r.source,
        source_type: r.source_type,
        saved_at: r.saved_at,
        favorite: r.is_favorite,
        archived: r.is_archived,
      })
    }
    onProgress?.(rows.length)
    if (data.length < BATCH) return rows
  }
}

/**
 * RFC 4180 CSV. Cells that a spreadsheet would treat as a formula
 * (=, +, -, @, tab, CR) are prefixed with ' — saved web content is untrusted
 * and must not execute when the export is opened in Excel/Sheets.
 */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : Array.isArray(value) ? value.join('; ') : String(value)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const CSV_COLUMNS: (keyof ExportRow)[] = [
  'url', 'title', 'description', 'summary', 'category', 'tags', 'note', 'collections', 'source', 'source_type', 'saved_at', 'favorite', 'archived',
]

export function toCsv(rows: ExportRow[]): string {
  const lines = [CSV_COLUMNS.join(',')]
  for (const row of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(row[c])).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n' // BOM so Excel reads UTF-8 correctly
}

export function toJson(rows: ExportRow[]): string {
  return JSON.stringify({ app: 'Recall', exported_at: new Date().toISOString(), count: rows.length, items: rows }, null, 2)
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
