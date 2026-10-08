// Minimal robots.txt evaluation (RFC 9309 semantics that matter here):
// pick the most specific matching user-agent group (ours, else "*"), then the
// longest matching Allow/Disallow rule wins; ties go to Allow.

export const BOT_TOKEN = 'recallbot'

interface Rule {
  allow: boolean
  pattern: string
}

function parseGroups(txt: string): Map<string, Rule[]> {
  const groups = new Map<string, Rule[]>()
  let agents: string[] = []
  let lastWasAgent = false
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (key === 'user-agent') {
      if (!lastWasAgent) agents = []
      agents.push(value.toLowerCase())
      for (const a of agents) if (!groups.has(a)) groups.set(a, [])
      lastWasAgent = true
    } else if (key === 'allow' || key === 'disallow') {
      lastWasAgent = false
      // An empty Disallow means "allow everything" — no rule.
      if (!value) continue
      for (const a of agents) groups.get(a)?.push({ allow: key === 'allow', pattern: value })
    } else {
      lastWasAgent = false
    }
  }
  return groups
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith('$')
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

/** Is `pathWithQuery` allowed for our bot under this robots.txt body? */
export function isAllowedByRobots(robotsTxt: string, pathWithQuery: string, botToken = BOT_TOKEN): boolean {
  const groups = parseGroups(robotsTxt)
  const rules = groups.get(botToken) ?? groups.get('*')
  if (!rules || rules.length === 0) return true
  let best: Rule | null = null
  for (const rule of rules) {
    if (!patternToRegex(rule.pattern).test(pathWithQuery)) continue
    if (!best || rule.pattern.length > best.pattern.length || (rule.pattern.length === best.pattern.length && rule.allow)) {
      best = rule
    }
  }
  return best ? best.allow : true
}
