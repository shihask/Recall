// Shared between Edge Functions and the browser.

/**
 * processing_error value meaning "no public preview and nothing else to go
 * on yet". Not a failure: the UI asks for a note, and saving one re-runs
 * enrichment using the note.
 */
export const NEEDS_NOTE = 'needs_note'
