import { newznabSearch } from './newznab.js'
import type { ExtensionOptions, NewznabItem, NZBQuery } from './types.js'

const DEFAULT_BASE = 'https://api.nzbgeek.info'
const DEFAULT_CATEGORY = '5070'
const TV_CATS = '5000,5030,5040,5070'
const MOVIE_CATS = '2000,2020,2030,2040,2045,2050,2060'

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

function score (item: NewznabItem, query: NZBQuery): number {
  let s = 0
  const lc = item.title.toLowerCase()

  if (query.name && lc.includes(query.name.toLowerCase())) s += 200

  for (const t of query.titles ?? []) {
    if (t && lc.includes(t.toLowerCase())) { s += 25; break }
  }

  if (query.episode) {
    const padded = String(query.episode).padStart(2, '0')
    if (new RegExp(`(?:e|ep|episode|-\\s)${padded}\\b`, 'i').test(item.title)) s += 30
  }

  if (item.size > 0) s += Math.min(8, Math.log10(item.size))

  return s
}

function pickBest (items: NewznabItem[], query: NZBQuery): NewznabItem | undefined {
  if (!items.length) return undefined
  const ranked = items
    .map(it => ({ it, s: score(it, query) }))
    .sort((a, b) => b.s - a.s)
  return ranked[0]?.it
}

async function tvSearch (query: NZBQuery, options: ExtensionOptions, episode?: number): Promise<NewznabItem[]> {
  return newznabSearch({
    fetch: query.fetch,
    baseUrl: baseOf(options),
    apikey: requireKey(options),
    params: {
      t: 'tvsearch',
      tvdbid: query.tvdbId,
      season: 1,
      ep: episode,
      cat: options.category || TV_CATS
    }
  })
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

async function singleEpisode (query: NZBQuery, options: ExtensionOptions): Promise<string | undefined> {
  let items: NewznabItem[] = []

  if (isMovieQuery(query)) {
    items = await movieSearch(query, options)
  } else if (query.tvdbId && query.episode) {
    items = await tvSearch(query, options, query.episode)
    if (!items.length && query.absoluteEpisodeNumber && query.absoluteEpisodeNumber !== query.episode) {
      items = await tvSearch(query, options, query.absoluteEpisodeNumber)
    }
  }

  if (!items.length) {
    const title = query.titles?.[0]
    if (!title) return undefined
    const ep = query.episode ? ` ${String(query.episode).padStart(2, '0')}` : ''
    items = await textSearch(query, options, `${title}${ep}`)
  }

  return pickBest(items, query)?.link
}

async function batchSeason (query: NZBQuery, options: ExtensionOptions): Promise<string | undefined> {
  let items: NewznabItem[] = []

  if (query.tvdbId) {
    items = await tvSearch(query, options)
  }

  if (!items.length) {
    const title = query.titles?.[0]
    if (!title) return undefined
    items = await textSearch(query, options, `${title} batch`)
    if (!items.length) items = await textSearch(query, options, `${title} complete`)
  }

  const boosted = items.map(it => {
    const bonus = /\b(batch|complete|season|s\d{1,2})\b/i.test(it.title) ? 75 : 0
    return { it, bonus }
  })
  const ranked = boosted
    .map(x => ({ it: x.it, s: score(x.it, query) + x.bonus }))
    .sort((a, b) => b.s - a.s)

  return ranked[0]?.it.link
}

const extension = {
  async test (): Promise<boolean> {
    // Hayase calls test() with no arguments, so we can't read the API key
    // from options here. Limit this to a reachability check against the
    // default base; the actual API key is validated lazily inside
    // single()/batch()/movie() where Hayase does pass options.
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
