// SSRF guards for server-side fetching of user-supplied URLs.
// Pure functions; the Edge Function resolves DNS and checks every address.

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n
}

const V4_BLOCKS: [string, number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local (cloud metadata lives here)
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
]

function inV4Block(n: number, base: string, bits: number): boolean {
  const b = ipv4ToInt(base)!
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return (n & mask) >>> 0 === (b & mask) >>> 0
}

export function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip)
  if (n === null) return true // unparseable → refuse
  return V4_BLOCKS.some(([base, bits]) => inV4Block(n, base, bits))
}

export function isPrivateIPv6(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0] ?? ''
  if (addr === '::' || addr === '::1') return true
  // IPv4-mapped / -compatible (::ffff:10.0.0.1, ::10.0.0.1)
  const mapped = addr.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped?.[1]) return isPrivateIPv4(mapped[1])
  const first = parseInt(addr.split(':')[0] || '0', 16)
  if (Number.isNaN(first)) return true
  if ((first & 0xfe00) === 0xfc00) return true // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true // multicast
  if (addr.startsWith('64:ff9b:')) return true // NAT64 can reach v4 internals
  if (addr.startsWith('2001:db8:')) return true // documentation
  return false
}

export function isIpLiteral(host: string): boolean {
  return /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':')
}

export function isPrivateAddress(ip: string): boolean {
  return ip.includes(':') ? isPrivateIPv6(ip) : isPrivateIPv4(ip)
}

/** Hostnames that must never be fetched regardless of DNS. */
export function isForbiddenHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  return (
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.home.arpa') ||
    h === 'metadata.google.internal' ||
    !h.includes('.')
  )
}
