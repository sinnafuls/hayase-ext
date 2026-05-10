import { parseRSS, type NyaaItem } from './nyaa-rss.js'
import type { AnimeQuery, TorrentResult } from './types.js'

interface NyaaOptions {
  domain?: string
  category?: string
  filter?: string
  appendResolution?: boolean
  sort?: 'seeders' | 'leechers' | 'downloads' | 'size' | 'id'
}

const DEFAULT_DOMAIN = 'https://nyaa.si'
const DEFAULT_CATEGORY = '1_2'
const DEFAULT_FILTER = '0'
const DEFAULT_SORT: NyaaOptions['sort'] = 'seeders'

const PROBLEMATIC_CHARS = /[!"#$%&'()*+,./:;<=>?@\\^_`{|}~]/g

function cleanQuery (raw: string): string {
  return raw.replace(PROBLEMATIC_CHARS, ' ').replace(/\s+/g, ' ').trim()
}

function buildUrl (options: NyaaOptions, query: string): string {
  const base = (options.domain?.trim() || DEFAULT_DOMAIN).replace(/\/+$/, '')
  const url = new URL(base + '/')
  url.searchParams.set('page', 'rss')
  url.searchParams.set('q', query)
  url.searchParams.set('c', options.category?.trim() || DEFAULT_CATEGORY)
  url.searchParams.set('f', options.filter?.trim() || DEFAULT_FILTER)
  url.searchParams.set('s', options.sort || DEFAULT_SORT!)
  url.searchParams.set('o', 'desc')
  return url.toString()
}

async function fetchRSS (
  fetcher: typeof globalThis.fetch,
  url: string
): Promise<NyaaItem[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  let res: Response
  try {
    res = await fetcher(url, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: controller.signal
    })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('Nyaa request timed out after 15s. Site may be slow or blocked.')
    }
    throw new Error(`Could not reach Nyaa: ${(err as Error).message}`)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`Nyaa returned HTTP ${res.status}. Site may be down or blocked in your region.`)
  const xml = await res.text()
  if (!xml.includes('<rss')) throw new Error('Nyaa returned a non-RSS response. The site may have changed.')
  return parseRSS(xml)
}

function isExcluded (title: string, exclusions?: string[]): boolean {
  if (!exclusions?.length) return false
  const lc = title.toLowerCase()
  return exclusions.some(e => e && lc.includes(e.toLowerCase()))
}

function detectBatch (title: string): boolean {
  return /\b(batch|complete|seasons?\s*\d+|s\d{1,2}\b|\b\d{1,3}\s*[~-]\s*\d{1,3}\b)/i.test(title)
}

function pickAccuracy (item: NyaaItem, query: AnimeQuery, expected: string): TorrentResult['accuracy'] {
  if (item.remake) return 'low'
  const lc = item.title.toLowerCase()
  const titleHit = (query.titles ?? []).some(t => t && lc.includes(t.toLowerCase()))
  if (item.trusted && titleHit) return 'high'
  if (titleHit) return 'medium'
  return expected && lc.includes(expected.toLowerCase()) ? 'medium' : 'low'
}

function toResult (item: NyaaItem, query: AnimeQuery, expected: string, asBatch = false): TorrentResult {
  const result: TorrentResult = {
    title: item.title,
    link: item.link,
    hash: item.hash,
    seeders: item.seeders,
    leechers: item.leechers,
    downloads: item.downloads,
    size: item.size,
    date: item.pubDate ? new Date(item.pubDate) : new Date(0),
    accuracy: pickAccuracy(item, query, expected)
  }
  if (asBatch || detectBatch(item.title)) result.type = 'batch'
  return result
}

async function searchOnce (query: AnimeQuery, options: NyaaOptions, term: string): Promise<NyaaItem[]> {
  return fetchRSS(query.fetch, buildUrl(options, term))
}

function buildEpisodeQuery (query: AnimeQuery, options: NyaaOptions): string {
  const title = cleanQuery(query.titles?.[0] ?? '')
  if (!title) return ''
  const parts = [title]
  if (query.episode) parts.push(String(query.episode).padStart(2, '0'))
  if (options.appendResolution !== false && query.resolution) parts.push(`${query.resolution}p`)
  return parts.join(' ')
}

const extension = {
  async test (): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch(`${DEFAULT_DOMAIN}/?page=rss`, { signal: controller.signal })
      if (!res.ok) throw new Error(`Nyaa returned HTTP ${res.status}. Site may be down or blocked in your region.`)
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('Nyaa did not respond within 15 seconds. Check your network or whether nyaa.si is blocked.')
      }
      throw new Error(`Could not reach Nyaa: ${(err as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  },

  async single (query: AnimeQuery, options: NyaaOptions = {}): Promise<TorrentResult[]> {
    const term = buildEpisodeQuery(query, options)
    if (!term) return []
    const items = await searchOnce(query, options, term)
    return items
      .filter(it => !isExcluded(it.title, query.exclusions))
      .map(it => toResult(it, query, term))
  },

  async batch (query: AnimeQuery, options: NyaaOptions = {}): Promise<TorrentResult[]> {
    const title = cleanQuery(query.titles?.[0] ?? '')
    if (!title) return []
    const terms = [`${title} batch`, `${title} complete`, `${title} season`]
    const seen = new Set<string>()
    const results: TorrentResult[] = []
    for (const term of terms) {
      const items = await searchOnce(query, options, term)
      for (const it of items) {
        if (!it.hash || seen.has(it.hash)) continue
        if (isExcluded(it.title, query.exclusions)) continue
        seen.add(it.hash)
        results.push(toResult(it, query, title, true))
      }
    }
    return results
  },

  async movie (query: AnimeQuery, options: NyaaOptions = {}): Promise<TorrentResult[]> {
    const title = cleanQuery(query.titles?.[0] ?? '')
    if (!title) return []
    const term = options.appendResolution !== false && query.resolution
      ? `${title} ${query.resolution}p`
      : title
    const items = await searchOnce(query, options, term)
    return items
      .filter(it => !isExcluded(it.title, query.exclusions))
      .map(it => toResult(it, query, title))
  }
}

export default extension
