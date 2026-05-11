import type { AnimeQuery, TorrentResult } from './types.js'

interface SubsPleaseOptions {
  resolution?: '480' | '720' | '1080'
}

interface SubsPleaseDownload {
  res: string
  magnet: string
}

interface SubsPleaseRelease {
  show?: string
  episode?: string
  release_date?: string
  downloads?: SubsPleaseDownload[]
}

const API_BASE = 'https://subsplease.org/api/'
const BTIH_RE = /xt=urn:btih:([A-Za-z0-9]+)/i
const XL_RE = /[?&]xl=(\d+)/
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32ToHex (b32: string): string {
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const c of b32.toUpperCase()) {
    const idx = BASE32_ALPHABET.indexOf(c)
    if (idx < 0) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 0xff)
    }
  }
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

function normaliseHash (raw: string): string {
  const clean = raw.trim()
  if (/^[0-9a-f]{40}$/i.test(clean)) return clean.toLowerCase()
  if (/^[A-Z2-7]{32}$/i.test(clean)) return base32ToHex(clean)
  return clean.toLowerCase()
}

function pickResolution (
  downloads: SubsPleaseDownload[],
  preferred: '480' | '720' | '1080'
): SubsPleaseDownload | undefined {
  const exact = downloads.find(d => d.res === preferred)
  if (exact) return exact
  const fallback: Array<'1080' | '720' | '480'> = ['1080', '720', '480']
  for (const r of fallback) {
    const hit = downloads.find(d => d.res === r)
    if (hit) return hit
  }
  return downloads[0]
}

function resolveResolution (query: AnimeQuery, options: SubsPleaseOptions): '480' | '720' | '1080' {
  if (options.resolution === '480' || options.resolution === '720' || options.resolution === '1080') {
    return options.resolution
  }
  if (query.resolution === '480') return '480'
  if (query.resolution === '540' || query.resolution === '720') return '720'
  return '1080'
}

function searchUrl (term: string): string {
  return `${API_BASE}?f=search&tz=UTC&s=${encodeURIComponent(term)}`
}

async function fetchSearch (
  fetcher: typeof globalThis.fetch,
  term: string
): Promise<SubsPleaseRelease[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  let res: Response
  try {
    res = await fetcher(searchUrl(term), { signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('SubsPlease request timed out after 15s. Site may be slow or blocked.')
    }
    throw new Error(`Could not reach SubsPlease: ${(err as Error).message}`)
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) throw new Error(`SubsPlease returned HTTP ${res.status}.`)
  const text = await res.text()
  // The API returns text/html with a JSON body. Empty searches return [].
  if (!text.trim() || text.trim() === '[]') return []
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('SubsPlease returned a non-JSON response. API may have changed.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return []
  return Object.values(data as Record<string, SubsPleaseRelease>)
    .filter((r): r is SubsPleaseRelease => !!r && typeof r === 'object')
}

function buildTitle (release: SubsPleaseRelease, download: SubsPleaseDownload, hash: string): string {
  const show = release.show ?? 'Unknown'
  const ep = release.episode ?? ''
  const epStr = /^\d+$/.test(ep) ? ep.padStart(2, '0') : ep
  const hashTag = hash ? ` [${hash.slice(0, 8).toUpperCase()}]` : ''
  return `[SubsPlease] ${show}${epStr ? ` - ${epStr}` : ''} (${download.res}p)${hashTag}.mkv`
}

function magnetToResult (
  release: SubsPleaseRelease,
  download: SubsPleaseDownload,
  isBatch: boolean
): TorrentResult | null {
  const magnet = download.magnet
  if (!magnet) return null
  const hashMatch = BTIH_RE.exec(magnet)
  if (!hashMatch) return null
  const hash = normaliseHash(hashMatch[1]!)
  if (!hash) return null
  const sizeMatch = XL_RE.exec(magnet)
  const size = sizeMatch ? Number(sizeMatch[1]) || 0 : 0
  const date = release.release_date ? new Date(release.release_date) : new Date(0)
  const result: TorrentResult = {
    title: buildTitle(release, download, hash),
    link: magnet,
    hash,
    size,
    seeders: 0,
    leechers: 0,
    downloads: 0,
    accuracy: 'high',
    date
  }
  if (isBatch) result.type = 'batch'
  return result
}

function matchesShow (release: SubsPleaseRelease, query: AnimeQuery): boolean {
  const show = (release.show ?? '').toLowerCase()
  if (!show) return false
  for (const t of query.titles ?? []) {
    if (!t) continue
    const lc = t.toLowerCase()
    if (show.includes(lc) || lc.includes(show)) return true
  }
  return false
}

function matchesEpisode (release: SubsPleaseRelease, episode: number): boolean {
  const ep = release.episode ?? ''
  if (ep === 'Batch') return false
  const n = Number(ep)
  return Number.isFinite(n) && n === episode
}

function isBatchRelease (release: SubsPleaseRelease): boolean {
  return release.episode === 'Batch'
}

async function searchByTitles (
  query: AnimeQuery,
  filterEpisode: number | undefined,
  wantBatch: boolean,
  options: SubsPleaseOptions
): Promise<TorrentResult[]> {
  const titles = (query.titles ?? []).filter(Boolean)
  if (!titles.length) return []
  const preferred = resolveResolution(query, options)
  const seen = new Set<string>()
  const out: TorrentResult[] = []
  for (const term of titles.slice(0, 3)) {
    const releases = await fetchSearch(query.fetch, term)
    for (const release of releases) {
      if (!matchesShow(release, query)) continue
      if (wantBatch && !isBatchRelease(release)) continue
      if (!wantBatch && isBatchRelease(release)) continue
      if (filterEpisode !== undefined && !matchesEpisode(release, filterEpisode)) continue
      const download = pickResolution(release.downloads ?? [], preferred)
      if (!download) continue
      const result = magnetToResult(release, download, isBatchRelease(release))
      if (!result || seen.has(result.hash)) continue
      seen.add(result.hash)
      out.push(result)
    }
    if (out.length) break
  }
  return out
}

const extension = {
  async test (): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    try {
      const res = await fetch(`${API_BASE}?f=schedule&tz=UTC`, { signal: controller.signal })
      if (!res.ok) throw new Error(`SubsPlease returned HTTP ${res.status}.`)
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('SubsPlease did not respond within 15s. Check your network or whether subsplease.org is blocked.')
      }
      throw new Error(`Could not reach SubsPlease: ${(err as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  },

  async single (query: AnimeQuery, options: SubsPleaseOptions = {}): Promise<TorrentResult[]> {
    return searchByTitles(query, query.episode, false, options)
  },

  async batch (query: AnimeQuery, options: SubsPleaseOptions = {}): Promise<TorrentResult[]> {
    return searchByTitles(query, undefined, true, options)
  },

  async movie (query: AnimeQuery, options: SubsPleaseOptions = {}): Promise<TorrentResult[]> {
    return searchByTitles(query, undefined, false, options)
  }
}

export default extension
