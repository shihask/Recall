// Fetching user-supplied URLs from the server safely.
//
// * SSRF: only http(s) on default ports; every hop's host must resolve
//   exclusively to public addresses; redirects are followed manually (max 3)
//   and re-validated.
// * Honest identity: a descriptive User-Agent, no cookies, no auth headers —
//   Recall only reads what any anonymous visitor could.
// * Bounded: per-request timeout and a hard byte cap on the body.
import { isForbiddenHostname, isIpLiteral, isPrivateAddress } from '../net.ts'

export const USER_AGENT = 'Mozilla/5.0 (compatible; RecallBot/1.0; personal link preview)'

export class FetchBlockedError extends Error {}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new FetchBlockedError('scheme not allowed')
  if (url.port && url.port !== '80' && url.port !== '443') throw new FetchBlockedError('port not allowed')
  if (url.username || url.password) throw new FetchBlockedError('credentials not allowed')

  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIpLiteral(host)) {
    if (isPrivateAddress(host)) throw new FetchBlockedError('private address')
    return
  }
  if (isForbiddenHostname(host)) throw new FetchBlockedError('internal hostname')

  const addresses: string[] = []
  for (const type of ['A', 'AAAA'] as const) {
    try {
      addresses.push(...(await Deno.resolveDns(host, type)))
    } catch {
      // A missing record type is normal (no AAAA); judged below on what exists.
    }
  }
  if (addresses.length === 0) throw new FetchBlockedError('host did not resolve')
  if (addresses.some(isPrivateAddress)) throw new FetchBlockedError('resolves to a private address')
}

export interface SafeResponse {
  url: string
  status: number
  contentType: string
  body: string | null
}

interface SafeFetchOptions {
  accept: string
  maxBytes: number
  timeoutMs: number
  /** Skip reading the body unless the content-type matches. */
  bodyIf?: (contentType: string) => boolean
}

async function readCapped(res: Response, maxBytes: number, contentType: string): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return ''
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < maxBytes) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    total += value.byteLength
  }
  await reader.cancel().catch(() => {})
  const buf = new Uint8Array(Math.min(total, maxBytes))
  let offset = 0
  for (const c of chunks) {
    const slice = c.subarray(0, Math.max(0, buf.length - offset))
    buf.set(slice, offset)
    offset += slice.length
  }
  const charset = contentType.match(/charset=([^;\s]+)/i)?.[1]?.toLowerCase() ?? 'utf-8'
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buf)
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf)
  }
}

export async function safeFetch(input: string, options: SafeFetchOptions): Promise<SafeResponse> {
  let current = new URL(input)
  for (let hop = 0; hop <= 3; hop++) {
    await assertPublicHost(current)
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs),
      headers: { 'User-Agent': USER_AGENT, Accept: options.accept, 'Accept-Language': 'en;q=1, *;q=0.5' },
    })
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location')
      await res.body?.cancel().catch(() => {})
      if (!location) throw new Error('redirect without location')
      current = new URL(location, current)
      continue
    }
    const contentType = res.headers.get('content-type') ?? ''
    const wantBody = res.ok && (options.bodyIf ? options.bodyIf(contentType) : true)
    const body = wantBody ? await readCapped(res, options.maxBytes, contentType) : null
    if (!wantBody) await res.body?.cancel().catch(() => {})
    return { url: current.toString(), status: res.status, contentType, body }
  }
  throw new Error('too many redirects')
}
