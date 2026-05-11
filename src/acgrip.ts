import type { AnimeQuery, TorrentResult } from './types.js'

interface AcgRipOptions {
  domain?: string
}

const DEFAULT_DOMAIN = 'https://acg.rip'
const SIZE_RE = /([\d.]+)\s*(B|KB|MB|GB|TB|KiB|MiB|GiB|TiB)/i
const RES_IN_TITLE_RE = /\b(2160p|1080p|720p|540p|480p)\b/i

function decodeText (raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .trim()
}

function pickField (body: string, tag: string): string {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i')
  const m = re.exec(body)
  return m ? decodeText(m[1]!) : ''
}

function pickEnclosure (body: string): string {
  const m = /<enclosure\b[^>]*\surl\s*=\s*"([^"]+)"/i.exec(body)
  return m ? decodeText(m[1]!) : ''
}

function parseSize (raw: string): number {
  if (!raw) return 0
  const m = SIZE_RE.exec(raw)
  if (!m) return 0
  const num = parseFloat(m[1]!)
  if (!Number.isFinite(num)) return 0
  const unit = m[2]!.toLowerCase()
  const mult: Record<string, number> = {
    b: 1,
    kb: 1000, kib: 1024,
    mb: 1000 ** 2, mib: 1024 ** 2,
    gb: 1000 ** 3, gib: 1024 ** 3,
    tb: 1000 ** 4, tib: 1024 ** 4
  }
  return Math.round(num * (mult[unit] ?? 1))
}

interface RawItem {
  title: string
  pageLink: string
  torrentUrl: string
  pubDate: string
  size: number
}

function parseRSS (xml: string): RawItem[] {
  const out: RawItem[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    const body = m[1]!
    const title = pickField(body, 'title')
    const description = pickField(body, 'description')
    out.push({
      title,
      pageLink: pickField(body, 'link'),
      torrentUrl: pickEnclosure(body),
      pubDate: pickField(body, 'pubDate'),
      size: parseSize(description) || parseSize(title)
    })
  }
  return out
}

async function fetchRSS (
  fetcher: typeof globalThis.fetch,
  domain: string,
  term: string
): Promise<RawItem[]> {
  const base = domain.replace(/\/+$/, '')
  const url = term
    ? `${base}/.xml?term=${encodeURIComponent(term)}`
    : `${base}/.xml`
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
      throw new Error('acg.rip request timed out after 15s. Site may be slow or blocked in your region.')
    }
    throw new Error(`Could not reach acg.rip: ${(err as Error).message}`)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`acg.rip returned HTTP ${res.status}.`)
  const xml = await res.text()
  if (!xml.includes('<rss')) throw new Error('acg.rip returned a non-RSS response. Site may have changed.')
  return parseRSS(xml)
}

function buildQuery (query: AnimeQuery, episode?: number): string {
  const title = query.titles?.[0]
  if (!title) return ''
  if (!episode) return title
  return `${title} ${String(episode).padStart(2, '0')}`
}

function matchesEpisode (title: string, episode: number | undefined): boolean {
  if (!episode) return true
  const padded = String(episode).padStart(2, '0')
  return new RegExp(`(?:^|[^\\d])${padded}(?:[^\\d]|$)`, 'i').test(title)
}

function matchesTitle (title: string, query: AnimeQuery): boolean {
  if (!query.titles?.length) return true
  const lc = title.toLowerCase()
  return query.titles.some(t => t && lc.includes(t.toLowerCase()))
}

function pickAccuracy (title: string, query: AnimeQuery): TorrentResult['accuracy'] {
  if (matchesTitle(title, query)) return 'medium'
  return 'low'
}

// acg.rip's RSS doesn't expose the torrent infoHash, only a .torrent file URL.
// Setting `hash` to the .torrent URL is a deliberate choice: webtorrent (which
// Hayase wraps) accepts URLs as torrent identifiers in `client.add()`, so
// metadata loads from the URL without DHT. The real infoHash is extracted by
// Hayase after metadata loads and is what gets passed to NZB extensions via
// `_addNZBs`. Trade-off: results from acg.rip won't dedupe with the same
// torrent surfaced by another extension that uses a real hash. Acceptable
// because acg.rip's catalog is largely CJK-tagged releases that rarely
// collide with other indexers.
function toResult (item: RawItem, query: AnimeQuery): TorrentResult | null {
  if (!item.torrentUrl) return null
  return {
    title: item.title,
    link: item.torrentUrl,
    hash: item.torrentUrl,
    size: item.size,
    seeders: 0,
    leechers: 0,
    downloads: 0,
    accuracy: pickAccuracy(item.title, query),
    date: item.pubDate ? new Date(item.pubDate) : new Date(0)
  }
}

async function search (query: AnimeQuery, options: AcgRipOptions, term: string, episode?: number): Promise<TorrentResult[]> {
  if (!term) return []
  const items = await fetchRSS(query.fetch, options.domain?.trim() || DEFAULT_DOMAIN, term)
  const out: TorrentResult[] = []
  for (const it of items) {
    if (episode !== undefined && !matchesEpisode(it.title, episode)) continue
    const r = toResult(it, query)
    if (r) out.push(r)
  }
  return out
}

const extension = {
  async test (): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch(`${DEFAULT_DOMAIN}/.xml`, { signal: controller.signal })
      if (!res.ok) throw new Error(`acg.rip returned HTTP ${res.status}.`)
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('acg.rip did not respond within 15s. Check your network or whether the site is blocked.')
      }
      throw new Error(`Could not reach acg.rip: ${(err as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  },

  async single (query: AnimeQuery, options: AcgRipOptions = {}): Promise<TorrentResult[]> {
    return search(query, options, buildQuery(query, query.episode), query.episode)
  },

  async batch (query: AnimeQuery, options: AcgRipOptions = {}): Promise<TorrentResult[]> {
    const title = query.titles?.[0]
    if (!title) return []
    const results = await search(query, options, `${title} batch`)
    if (results.length) return results
    return search(query, options, title)
  },

  async movie (query: AnimeQuery, options: AcgRipOptions = {}): Promise<TorrentResult[]> {
    const title = query.titles?.[0]
    if (!title) return []
    return search(query, options, title)
  }
}

export default extension
