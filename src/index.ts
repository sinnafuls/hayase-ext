import { newznabSearch } from './newznab.js'
import type { ExtensionOptions, NewznabItem, NZBQuery } from './types.js'

const DEFAULT_BASE = 'https://api.nzbgeek.info'
const DEFAULT_CATEGORY = '5070'
const MOVIE_CATS = '2000,2020,2030,2040,2045,2050,2060'

const BRACKET_RE = /\[[^\]]*\]|\([^)]*\)/g
const QUALITY_TOKEN_RE = /\b(?:2160p|1080p|720p|540p|480p|4k|uhd|x265|x264|h\.?265|h\.?264|hevc|avc|xvid|10bit|8bit|bluray|blu-?ray|bd|webrip|web-?dl|webdl|dvdrip|hdrip|aac|flac|ac3|dts|eac3|opus|multisub|multi[-.]?subtitle|dual[-.]?audio|raw|remux|repack|proper|hdr10?|crc32)\b/gi
const HEX_TAG_RE = /\b[a-f0-9]{8}\b/gi
const GROUP_SUFFIX_RE = /-[A-Z][A-Za-z0-9]+$/

const RES_RE = /\b(2160p|1080p|720p|540p|480p)\b/i
const BATCH_TAG_RE = /\b(?:BD[-\s]?BOX|Box(?:set)?|Complete|Batch|Season|S\d{1,2}|\d{1,3}\s*[-~]\s*\d{1,3})\b/i

function requireKey (options: ExtensionOptions): string {
  const k = options.apikey?.trim()
  if (!k) throw new Error('NZBGeek API key is missing. Set it in Settings → Extensions → NZBGeek → Configure.')
  return k
}

function baseOf (options: ExtensionOptions): string {
  return (options.baseUrl?.trim() || DEFAULT_BASE).replace(/\/+$/, '')
}

function isMovieQuery (q: NZBQuery): boolean {
  if (q.tvdbId) return false
  if ((q.episodeCount ?? 0) > 1) return false
  return !!(q.imdbId || q.tmdbId)
}

function cleanTitle (raw: string): string {
  if (!raw) return ''
  return raw
    .replace(BRACKET_RE, ' ')
    .replace(QUALITY_TOKEN_RE, ' ')
    .replace(HEX_TAG_RE, ' ')
    .replace(GROUP_SUFFIX_RE, ' ')
    .replace(/[._]+/g, ' ')
    .replace(/[^\w\s\-:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueCandidates (titles: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of titles ?? []) {
    const c = cleanTitle(t)
    const k = c.toLowerCase()
    if (c && !seen.has(k)) {
      seen.add(k)
      out.push(c)
    }
  }
  return out
}

function extractResolution (name: string): string | undefined {
  return RES_RE.exec(name ?? '')?.[1]?.toLowerCase()
}

function score (item: NewznabItem, query: NZBQuery, wantedRes: string | undefined): number {
  let s = 0
  const lc = item.title.toLowerCase()

  if (query.name && lc.includes(query.name.toLowerCase())) s += 200
  const cleanedName = cleanTitle(query.name).toLowerCase()
  if (cleanedName && lc.includes(cleanedName)) s += 100

  for (const t of query.titles ?? []) {
    if (t && lc.includes(t.toLowerCase())) { s += 50; break }
  }

  if (query.episode) {
    const padded = String(query.episode).padStart(2, '0')
    const re = new RegExp(`(?:^|[^\\d])${padded}(?:[^\\d]|$)`, 'i')
    if (re.test(item.title)) s += 30
  }

  if (wantedRes && lc.includes(wantedRes)) s += 50

  if (item.size > 0) s += Math.min(8, Math.log10(item.size))

  return s
}

function pickBest (items: NewznabItem[], query: NZBQuery): NewznabItem | undefined {
  if (!items.length) return undefined
  const wantedRes = extractResolution(query.name)
  return items
    .map(it => ({ it, s: score(it, query, wantedRes) }))
    .sort((a, b) => b.s - a.s)[0]?.it
}

async function movieSearch (query: NZBQuery, options: ExtensionOptions): Promise<NewznabItem[]> {
  return newznabSearch({
    fetch: query.fetch,
    baseUrl: baseOf(options),
    apikey: requireKey(options),
    params: {
      t: 'movie',
      imdbid: query.imdbId?.replace(/^tt/i, ''),
      tmdbid: query.tmdbId,
      cat: options.category || MOVIE_CATS
    }
  })
}

async function textSearch (query: NZBQuery, options: ExtensionOptions, q: string): Promise<NewznabItem[]> {
  return newznabSearch({
    fetch: query.fetch,
    baseUrl: baseOf(options),
    apikey: requireKey(options),
    params: {
      t: 'search',
      q,
      cat: options.category || DEFAULT_CATEGORY
    }
  })
}

async function searchTitleEp (query: NZBQuery, options: ExtensionOptions, candidates: string[], padded: string): Promise<NewznabItem | undefined> {
  for (const title of candidates) {
    const term = padded ? `${title} ${padded}` : title
    const items = await textSearch(query, options, term)
    const best = pickBest(items, query)
    if (best) return best
  }
  return undefined
}

async function singleEpisode (query: NZBQuery, options: ExtensionOptions): Promise<string | undefined> {
  // Movies with imdb/tmdb id: try movie endpoint first (works for live-action;
  // anime movies usually live in cat 5070 and won't, so we fall through).
  if (isMovieQuery(query)) {
    const items = await movieSearch(query, options)
    const best = pickBest(items, query)
    if (best) return best.link
  }

  const candidates = uniqueCandidates(query.titles ?? [])
  if (!candidates.length) return undefined

  // Primary: text search "<title> <padded ep>". Iterates titles[] until a hit.
  // (NZBGeek's tvsearch+tvdbid returns 0 for anime cat 5070 — skip it.)
  if (query.episode) {
    const padded = String(query.episode).padStart(2, '0')
    const hit = await searchTitleEp(query, options, candidates, padded)
    if (hit) return hit.link
  }

  // Fallback: absolute episode number for non-standard anime numbering.
  if (query.absoluteEpisodeNumber && query.absoluteEpisodeNumber !== query.episode) {
    const padded = String(query.absoluteEpisodeNumber).padStart(2, '0')
    const hit = await searchTitleEp(query, options, candidates, padded)
    if (hit) return hit.link
  }

  // Last resort: broad title search, score will surface anything ep-tagged.
  const broad = await textSearch(query, options, candidates[0]!)
  return pickBest(broad, query)?.link
}

async function batchSeason (query: NZBQuery, options: ExtensionOptions): Promise<string | undefined> {
  const candidates = uniqueCandidates(query.titles ?? [])
  if (!candidates.length) return undefined

  const title = candidates[0]!
  const wantedRes = extractResolution(query.name)

  // NZBGeek anime is heavily Moozzi2 BD-BOX uploads — that's the dominant batch format.
  let items = await textSearch(query, options, `${title} BD-BOX`)
  if (!items.length) items = await textSearch(query, options, `${title} Batch`)
  if (!items.length) items = await textSearch(query, options, title)
  if (!items.length) return undefined

  const ranked = items
    .map(it => {
      const bonus = BATCH_TAG_RE.test(it.title) ? 100 : 0
      return { it, s: score(it, query, wantedRes) + bonus }
    })
    .sort((a, b) => b.s - a.s)

  return ranked[0]?.it.link
}

const extension = {
  async test (): Promise<boolean> {
    // Hayase invokes test() with no arguments — no options, no API key.
    // Reachability check only; key gets validated lazily in search methods.
    const url = `${DEFAULT_BASE}/api?t=caps&o=json`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`NZBGeek returned HTTP ${res.status}. The indexer may be down.`)
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('NZBGeek did not respond within 15 seconds. Check your network or the indexer status.')
      }
      throw new Error(`Could not reach NZBGeek: ${(err as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  },

  async single (query: NZBQuery, options: ExtensionOptions = {}): Promise<string | undefined> {
    return singleEpisode(query, options)
  },

  async batch (query: NZBQuery, options: ExtensionOptions = {}): Promise<string | undefined> {
    return batchSeason(query, options)
  },

  async movie (query: NZBQuery, options: ExtensionOptions = {}): Promise<string | undefined> {
    return singleEpisode(query, options)
  }
}

export default extension
