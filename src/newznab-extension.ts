import { newznabSearch } from './newznab.js'
import type { ExtensionOptions, NewznabItem, NZBQuery } from './types.js'

export interface NewznabDefaults {
  base: string
  animeCat: string
  movieCats: string
  serviceName: string
}

const BRACKET_RE = /\[[^\]]*\]|\([^)]*\)/g
const QUALITY_TOKEN_RE = /\b(?:2160p|1080p|720p|540p|480p|4k|uhd|x265|x264|h\.?265|h\.?264|hevc|avc|xvid|10bit|8bit|bluray|blu-?ray|bd|webrip|web-?dl|webdl|dvdrip|hdrip|aac|flac|ac3|dts|eac3|opus|multisub|multi[-.]?subtitle|dual[-.]?audio|raw|remux|repack|proper|hdr10?|crc32)\b/gi
const HEX_TAG_RE = /\b[a-f0-9]{8}\b/gi
const GROUP_SUFFIX_RE = /-[A-Z][A-Za-z0-9]+$/

const RES_RE = /\b(2160p|1080p|720p|540p|480p)\b/i
const BATCH_TAG_RE = /\b(?:BD[-\s]?BOX|Box(?:set)?|Complete|Batch|Season|S\d{1,2}|\d{1,3}\s*[-~]\s*\d{1,3})\b/i
const SEASON_IN_TITLE_RE = /\b(?:Season\s*\d+|\d+(?:st|nd|rd|th)\s*Season|S\d{1,2}\b)/i
const RESULT_SEASON_RE = /\bS(\d{1,2})(?:E\d+)?\b|\b(\d+)(?:st|nd|rd|th)\s*Season\b|\bSeason\s*(\d+)\b/i

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
  return out.slice(0, 3)
}

function extractResolution (name: string): string | undefined {
  return RES_RE.exec(name ?? '')?.[1]?.toLowerCase()
}

function detectSeason (titles: string[]): number | undefined {
  for (const t of titles ?? []) {
    let m = /\b(\d+)(?:st|nd|rd|th)\s*Season\b/i.exec(t)
    if (m) return Number(m[1])
    m = /\bSeason\s*(\d+)\b/i.exec(t)
    if (m) return Number(m[1])
  }
  return undefined
}

function extractResultSeason (title: string): number | undefined {
  const m = RESULT_SEASON_RE.exec(title)
  if (!m) return undefined
  const n = Number(m[1] ?? m[2] ?? m[3])
  if (n >= 1 && n <= 30) return n
  return undefined
}

function titleAlreadyHasSeason (title: string): boolean {
  return SEASON_IN_TITLE_RE.test(title)
}

function isMovieQuery (q: NZBQuery): boolean {
  if (q.tvdbId) return false
  if ((q.episodeCount ?? 0) > 1) return false
  return !!(q.imdbId || q.tmdbId)
}

interface ScoreContext {
  wantedRes?: string
  wantedSeason: number
  isExplicitSeason: boolean
}

function score (item: NewznabItem, query: NZBQuery, ctx: ScoreContext): number {
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

  if (ctx.wantedRes && lc.includes(ctx.wantedRes)) s += 50

  const resultSeason = extractResultSeason(item.title)
  if (resultSeason !== undefined) {
    if (resultSeason === ctx.wantedSeason) s += 75
    else s -= ctx.isExplicitSeason ? 200 : 100
  }

  if (item.size > 0) s += Math.min(8, Math.log10(item.size))

  return s
}

function buildContext (query: NZBQuery): ScoreContext {
  const explicit = detectSeason(query.titles ?? [])
  return {
    wantedRes: extractResolution(query.name),
    wantedSeason: explicit ?? 1,
    isExplicitSeason: explicit !== undefined
  }
}

function pickBest (items: NewznabItem[], query: NZBQuery): NewznabItem | undefined {
  if (!items.length) return undefined
  const ctx = buildContext(query)
  return items
    .map(it => ({ it, s: score(it, query, ctx) }))
    .sort((a, b) => b.s - a.s)[0]?.it
}

export function createNewznabExtension (d: NewznabDefaults) {
  function requireKey (options: ExtensionOptions): string {
    const k = options.apikey?.trim()
    if (!k) throw new Error(`${d.serviceName} API key is missing. Set it in Settings → Extensions → ${d.serviceName} → Configure.`)
    return k
  }

  function baseOf (options: ExtensionOptions): string {
    return (options.baseUrl?.trim() || d.base).replace(/\/+$/, '')
  }

  async function textSearch (query: NZBQuery, options: ExtensionOptions, q: string): Promise<NewznabItem[]> {
    return newznabSearch({
      fetch: query.fetch,
      baseUrl: baseOf(options),
      apikey: requireKey(options),
      params: {
        t: 'search',
        q,
        cat: options.category || d.animeCat
      }
    })
  }

  async function movieLookup (query: NZBQuery, options: ExtensionOptions): Promise<NewznabItem[]> {
    return newznabSearch({
      fetch: query.fetch,
      baseUrl: baseOf(options),
      apikey: requireKey(options),
      params: {
        t: 'movie',
        imdbid: query.imdbId?.replace(/^tt/i, ''),
        tmdbid: query.tmdbId,
        cat: options.category || d.movieCats
      }
    })
  }

  async function singleEpisode (query: NZBQuery, options: ExtensionOptions): Promise<string | undefined> {
    if (isMovieQuery(query)) {
      const items = await movieLookup(query, options)
      const best = pickBest(items, query)
      if (best) return best.link
    }

    const candidates = uniqueCandidates(query.titles ?? [])
    if (!candidates.length) return undefined

    const explicitSeason = detectSeason(query.titles ?? [])
    const wantedSeason = explicitSeason ?? 1

    if (query.episode) {
      const epPadded = String(query.episode).padStart(2, '0')
      const sePadded = `S${String(wantedSeason).padStart(2, '0')}E${epPadded}`

      for (const title of candidates) {
        const terms = titleAlreadyHasSeason(title)
          ? [`${title} ${epPadded}`, `${title} ${sePadded}`]
          : [`${title} ${sePadded}`, `${title} ${epPadded}`]
        for (const term of terms) {
          const items = await textSearch(query, options, term)
          const best = pickBest(items, query)
          if (best) return best.link
        }
      }
    }

    if (query.absoluteEpisodeNumber && query.absoluteEpisodeNumber !== query.episode) {
      const padded = String(query.absoluteEpisodeNumber).padStart(2, '0')
      for (const title of candidates) {
        const items = await textSearch(query, options, `${title} ${padded}`)
        const best = pickBest(items, query)
        if (best) return best.link
      }
    }

    const broad = await textSearch(query, options, candidates[0]!)
    return pickBest(broad, query)?.link
  }

  async function batchSeason (query: NZBQuery, options: ExtensionOptions): Promise<string | undefined> {
    const candidates = uniqueCandidates(query.titles ?? [])
    if (!candidates.length) return undefined

    const title = candidates[0]!
    let items = await textSearch(query, options, `${title} BD-BOX`)
    if (!items.length) items = await textSearch(query, options, `${title} Batch`)
    if (!items.length) items = await textSearch(query, options, title)
    if (!items.length) return undefined

    const ctx = buildContext(query)
    const ranked = items
      .map(it => {
        const bonus = BATCH_TAG_RE.test(it.title) ? 100 : 0
        return { it, s: score(it, query, ctx) + bonus }
      })
      .sort((a, b) => b.s - a.s)

    return ranked[0]?.it.link
  }

  return {
    async test (): Promise<boolean> {
      const url = `${d.base}/api?t=caps&o=json`
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 15_000)
      try {
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
          signal: controller.signal
        })
        if (!res.ok) throw new Error(`${d.serviceName} returned HTTP ${res.status}. The indexer may be down.`)
        return true
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          throw new Error(`${d.serviceName} did not respond within 15 seconds. Check your network or the indexer status.`)
        }
        throw new Error(`Could not reach ${d.serviceName}: ${(err as Error).message}`)
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
}
