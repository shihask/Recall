// Natural-language recall queries → keyword terms + soft hints.
//
// "Find the Reel about a 3D printed phone holder" →
//   { terms: "3D printed phone holder", boostType: "reel" }
//
// Hints only BOOST ranking; they never filter, because people misremember
// where they saw things ("that Reel" may have been a YouTube Short).
import type { Source, SourceType } from './url.ts'

export interface SearchIntent {
  /** Original text (used for semantic search, which understands phrasing). */
  original: string
  /** Content words for keyword search. Falls back to `original` if nothing is left. */
  terms: string
  boostSource: Source | null
  boostType: SourceType | null
}

const SOURCE_WORDS: [RegExp, Source][] = [
  [/\b(instagram|insta|ig)\b/i, 'instagram'],
  [/\b(youtube|yt)\b/i, 'youtube'],
  [/\breddit\b/i, 'reddit'],
  [/\b(twitter|tweet|tweets|x\.com)\b/i, 'x'],
  [/\b(facebook|fb)\b/i, 'facebook'],
]

const TYPE_WORDS: [RegExp, SourceType][] = [
  [/\breels?\b/i, 'reel'],
  [/\bshorts?\b/i, 'short'],
  [/\b(videos?|clips?)\b/i, 'video'],
  [/\b(articles?|blog ?posts?)\b/i, 'article'],
  [/\b(pdfs?)\b/i, 'pdf'],
  [/\b(products?)\b/i, 'product'],
  [/\b(tweets?|posts?)\b/i, 'post'],
]

// Conversational scaffolding around the thing being remembered.
const LEADING = [
  /^(hey|ok|okay|so|um+|uh+)\b[\s,]*/i,
  /^(can you |could you |please )?(show|find|search|get|give|pull up|bring up|look for|look up|where( is| was|'s)?|what( is| was|'s| were)?|which|i('m| am) looking for|help me find)\b( me)?( for)?\s*/i,
  /^(i |i've |i have )?(saw|seen|saved|watched|read|found|remember|bookmarked)\b\s*/i,
  /^(all |any |some |my |the |that |this |those |these |a |an )+/i,
]

const FILLER_PHRASES = [
  /\b(something|anything|stuff|things?) (about|on|with|for|like)\b/gi,
  /\b(that|which|the one) (i|we) (saved|saw|found|watched|bookmarked|liked)\b/gi,
  /\bi (saved|saw|found|watched|bookmarked|liked|remember)( (once|before|earlier|recently|last (week|month|year)|a while ago))?\b/gi,
  /\bdid i (save|see|find)\b/gi,
  /\b(on|from|in) (instagram|insta|youtube|reddit|twitter|x|facebook)\b/gi,
  /\b(instagram|insta|ig|youtube|yt|reddit|twitter|facebook|fb) (reels?|shorts?|videos?|posts?|tweets?|clips?) (about|on|with|of|showing)\b/gi,
  /\b(a|the|one|some) (reels?|shorts?|videos?|posts?|tweets?|articles?|clips?) (about|on|with|of|showing)\b/gi,
  /\b(reels?|shorts?|videos?|posts?|tweets?|clips?) (about|on|with|of|showing)\b/gi,
  /\b(about|regarding)\b/gi,
]

const STOP = new Set(['a', 'an', 'the', 'my', 'me', 'i', 'that', 'this', 'some', 'any', 'of', 'to', 'for', 'and', 'or', 'saved', 'save', 'saves', 'please', 'again', 'there', 'was', 'is', 'it'])

export function parseSearchIntent(input: string): SearchIntent {
  const original = input.replace(/\s+/g, ' ').trim().slice(0, 300)
  const boostSource = SOURCE_WORDS.find(([re]) => re.test(original))?.[1] ?? null
  const boostType = TYPE_WORDS.find(([re]) => re.test(original))?.[1] ?? null

  let text = original.replace(/[?!.]+$/g, '')
  for (let i = 0; i < 3; i++) for (const re of LEADING) text = text.replace(re, '')
  for (const re of FILLER_PHRASES) text = text.replace(re, ' ')

  const words = text
    .split(/\s+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}#@+]+|[^\p{L}\p{N}+]+$/gu, ''))
    .filter(Boolean)
  // Trim stopwords at the edges only; inner ones can matter ("chicken and cheese").
  while (words.length && STOP.has(words[0]!.toLowerCase())) words.shift()
  while (words.length && STOP.has(words[words.length - 1]!.toLowerCase())) words.pop()

  const terms = words.join(' ').trim()
  return { original, terms: terms.length >= 2 ? terms : original, boostSource, boostType }
}
