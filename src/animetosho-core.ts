// Shared client for AnimeTosho's current JSON API (feed.animetosho.net/json/v1).
//
// Replaces the old feed.animetosho.org/json feed, which stopped indexing in
// May 2026 and rejects unfiltered queries. The v1 API aggregates Nyaa, NekoBT,
// AniDex, DMHY and others, and every release carries info_hash, torrent_url and
// nzb_url — so one backend serves both the torrent and the NZB extension.
//
// Why the title fallback exists: Hayase's query only carries anidbEid/anidbAid
// when ani.zip has a mapping for the show, which lags behind new seasons. The
// v1 search endpoint accepts free text, so unmapped shows are still searchable.

export const API = 'https://feed.animetosho.net/json/v1'
const TIMEOUT_MS = 10_000
const MAX_LIMIT = 100

export interface ToshoSeries {
  anidb_aid?: number | null
  anidb_eid?: number | null
  episode_number?: number | null
  title?: string | null
}

export interface ToshoRelease {
  title: string
  info_hash: string
  magnet?: string | null
  torrent_url?: string | null
  nzb_url?: string | null
  size_bytes?: number | null
  seeders?: number | null
  leechers?: number | null
  downloads?: number | null
  file_count?: number | null
  is_batch?: boolean
  resolution?: string | null
  date_added?: string | null
  series?: ToshoSeries | null
}

interface Envelope<T> {
  ok?: boolean
  data?: T
  error?: string
}

async function get<T> (
  fetcher: typeof globalThis.fetch,
  url: string
): Promise<T | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let res: Response
  try {
    res = await fetcher(url, { signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('AnimeTosho did not respond within 10s. Check your network or whether feed.animetosho.net is blocked.')
    }
    throw new Error(`Could not reach AnimeTosho: ${(err as Error).message}`)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}.`)

  let body: Envelope<T>
  try {
    body = await res.json() as Envelope<T>
  } catch {
    throw new Error('AnimeTosho returned a non-JSON response. The API may have changed.')
  }
  if (body?.ok === false) throw new Error(`AnimeTosho error: ${body.error || 'request rejected'}`)
  return body?.data
}

export async function searchReleases (
  fetcher: typeof globalThis.fetch,
  params: Record<string, string | number>
): Promise<ToshoRelease[]> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries({ limit: MAX_LIMIT, ...params })) qs.set(k, String(v))
  const data = await get<ToshoRelease[]>(fetcher, `${API}/search?${qs}`)
  return Array.isArray(data) ? data : []
}

export async function episodeReleases (
  fetcher: typeof globalThis.fetch,
  eid: number
): Promise<ToshoRelease[]> {
  const data = await get<{ releases?: ToshoRelease[] }>(fetcher, `${API}/episodes/${eid}?limit=${MAX_LIMIT}`)
  return data?.releases ?? []
}

export async function seriesReleases (
  fetcher: typeof globalThis.fetch,
  aid: number
): Promise<ToshoRelease[]> {
  const data = await get<{ releases?: ToshoRelease[] }>(fetcher, `${API}/series/anidb/${aid}?limit=${MAX_LIMIT}`)
  return data?.releases ?? []
}

// Full-text search. Terms are ANDed; phrase quoting survives punctuation.
export function titleQuery (title: string, episode?: number): string {
  const phrase = `"${title.replace(/["\\]/g, ' ').trim()}"`
  return episode ? `${phrase} ${String(episode).padStart(2, '0')}` : phrase
}

export function primaryTitle (titles: string[] | undefined): string | undefined {
  return titles?.find(t => t && t.trim().length > 1)?.trim()
}
