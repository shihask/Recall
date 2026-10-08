# Recall

**Remember what you found.** A private memory layer for things you save from the internet. Paste a link from Instagram, YouTube, Reddit, X, Facebook or any website, and find it later by describing what you remember.

Core loop: **Save → Forget → Recall → Find**

```
Browser (React 19 + Vite PWA, on Vercel)
  └─ supabase-js ── Supabase Auth · Postgres (RLS) · Edge Functions
                                         ├─ process-saved-item  metadata → Groq enrichment → gte-small embedding
                                         ├─ search              query embedding → hybrid (keyword + vector) RPC
                                         ├─ delete-account      auth.admin.deleteUser (cascades all data)
                                         └─ process-pending     optional retry worker (CRON_SECRET)
```

Recall uses its **own dedicated Supabase project**. It shares nothing with any other app.

## Local development

```bash
npm install
cp .env.example .env        # fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

| Command | What it runs |
| --- | --- |
| `npm run check` | Everything below |
| `npm run typecheck` | `tsc -b` (strict) |
| `npm run lint` | ESLint |
| `npm test` | Vitest: unit tests **and** the real SQL migrations in PGlite (RLS, search, job state machine, hybrid ranking) |
| `npm run check:functions` | `deno check` + `deno lint` + `deno test` for Edge Functions (runs Deno via `npx`) |

The database tests run the real migrations in PGlite (Postgres in WASM with pgvector, pg_trgm and unaccent), behind a small Supabase shim (roles, `auth.uid()`, default grants). Acceptance **Test 10** (a second user cannot access the first user's data) lives in `tests/db/rls.test.ts`.

## Deploy

### 1. Supabase (new project)

```bash
supabase link --project-ref <recall-project-ref>
supabase db push                                  # applies supabase/migrations
supabase secrets set AI_API_KEY=<groq key> AI_MODEL=openai/gpt-oss-20b
supabase functions deploy process-saved-item
supabase functions deploy search
supabase functions deploy delete-account
```

- **Auth → URL configuration:** set the Site URL to your Vercel domain. Add `https://<domain>/auth/callback` and `https://<domain>/reset-password` as redirect URLs.
- **Google sign-in (optional):** enable the Google provider under Auth → Providers and add the OAuth client from Google Cloud. Use the callback URL that Supabase shows.
- **Without `AI_API_KEY`:** saves still work and get metadata and embeddings, but no summaries or tags (status `partial`).

**Optional retry worker.** Not needed for normal saves, which process immediately. It is a safety net for saves whose immediate processing failed:

```bash
supabase secrets set CRON_SECRET=<32+ random chars>
supabase functions deploy process-pending --no-verify-jwt
```

Then follow `supabase/optional/retry_cron.sql` (pg_cron + pg_net + Vault). The service-role key is never stored in the database or the browser.

### 2. Vercel

Import the repo. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the project's environment variables. `vercel.json` provides the SPA rewrites and security headers (CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`).

## How processing works

1. **Save** inserts the row right away and shows "✓ Saved". The browser then fires `process-saved-item` without waiting for it. A save is never lost because AI or metadata failed.
2. **Metadata.** Recall first tries the public oEmbed endpoints (YouTube, X, Reddit). Then, **only if robots.txt allows it**, it reads the page's OpenGraph, Twitter and HTML metadata. Fetching is guarded against SSRF: public IPs only, DNS checked on every redirect hop, default ports only, size and time limits, an honest User-Agent and no cookies. Login walls are treated as "metadata unavailable".
3. **AI (Groq).** One JSON call returns a summary, category (from a controlled list), 3–7 tags and an optional title. The output is strictly validated. When there's too little source text, the summary is forced to "Summary unavailable." regardless of what the model says. Fields the user edited are never overwritten.
4. **Embedding.** Supabase's built-in `gte-small` (384 dims) runs over the title, summary, note, tags and category. Items are re-embedded when their note or tags change.
5. **Idempotency.** `start_processing()` claims jobs atomically, reclaims stale jobs and retries at most 3 times. `apply_ai_tags()` converges to the same result no matter how often it runs.

## Search

- **Keyword** (`search_items`): a weighted tsvector (title > tags/note > summary > content) with OR'd prefix terms, plus trigram matching for typos and substring matching. Filters: source, category, collection, tag, favorites, date range, archived.
- **Natural language:** `"Find the Reel about a 3D printed phone holder"` becomes the terms `3D printed phone holder` plus a soft boost for Reels. Hints only boost results; they never filter.
- **Hybrid** (`search` function → `hybrid_search_items`): Reciprocal Rank Fusion of the keyword and vector rankings. Meaning-only matches must reach cosine ≥ 0.80, a threshold calibrated on real gte-small output. When semantic search is unavailable, keyword results remain.
- **"I think I found it."** appears only when the top result clearly stands out.

## Platform limitations (by design)

- **Instagram and Facebook** previews are available only through Meta’s official oEmbed API. To enable it, create a Meta app with the **oEmbed Read** feature and run `supabase secrets set META_OEMBED_TOKEN=APP_ID|CLIENT_TOKEN`. Without the token, Instagram and Facebook pages disallow generic crawlers in robots.txt, and Recall doesn't get around that. These saves keep their URL and detected type. Recall asks for a short note right after saving. Adding or editing that note re-runs enrichment, so the item gets a category and tags from your own words. AI never guesses from a bare URL, and the summary stays "Summary unavailable."
- **Share sheet:** the installed PWA registers a Web Share Target (`/save`). This works in **Chrome, Edge and Samsung Internet on Android**. **iOS Safari doesn't support Web Share Target.** On iPhone: copy the link, open Recall, and tap **Paste** in the Save sheet.
- **Offline:** the app shell opens offline. Saves and search need a connection. Private data is deliberately never cached by the service worker.

## Privacy

Every table has Row Level Security, and anonymous users get no access at all. Server-owned columns (URL, enrichment, embeddings) are not writable by clients. Service-role code always scopes by the verified user. Export is available as JSON or CSV (with spreadsheet-formula injection neutralized). Account deletion cascades to every row. Saved content is never used for analytics or AI training.
