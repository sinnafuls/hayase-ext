import type { AnimeQuery, TorrentResult } from './types.js'
import type { ToshoRelease } from './animetosho-core.js'
import {
  API,
  episodeReleases,
  primaryTitle,
  searchReleases,
  seriesReleases,
  titleQuery
} from './animetosho-core.js'

interface ToshoOptions {
  useTorrent?: boolean
}

// series.episode_number is authoritative when present; otherwise fall back to
// the episode number in the title (releases AnimeTosho has no series link for).
function isEpisode (release: ToshoRelease, episode: number): boolean {
  const numbered = release.series?.episode_number
  if (typeof numbered === 'number' && numbered > 0) return numbered === episode
  if (!episode) return true
  const padded = String(episode).padStart(2, '0')
  return new RegExp(`(?:^|[^\\d])${padded}(?:[^\\d]|$)`, 'i').test(release.title ?? '')
}

function passesFilters (release: ToshoRelease, query: AnimeQuery): boolean {
  if (release.is_batch) return false
  const wanted = query.resolution
  if (wanted && release.resolution && !release.resolution.startsWith(wanted)) return false
  const title = (release.title ?? '').toLowerCase()
  return !query.exclusions?.some(e => e && title.includes(e.toLowerCase()))
}

function toResult (release: ToshoRelease, query: AnimeQuery, useTorrent: boolean): TorrentResult {
  return {
    title: release.title,
    link: ((useTorrent ? release.torrent_url : release.magnet) ?? release.magnet ?? release.torrent_url) as string,
    seeders: release.seeders ?? 0,
    leechers: release.leechers ?? 0,
    downloads: release.downloads ?? 0,
    hash: (release.info_hash ?? '').toLowerCase(),
    size: release.size_bytes ?? 0,
    accuracy: query.anidbEid && release.series?.anidb_eid === query.anidbEid ? 'high' : 'medium',
    date: release.date_added ? new Date(release.date_added) : new Date(0)
  }
}

async function episodePool (query: AnimeQuery): Promise<ToshoRelease[]> {
  if (query.anidbEid) return episodeReleases(query.fetch, query.anidbEid)
  const title = primaryTitle(query.titles)
  if (!title) return []
  return searchReleases(query.fetch, { q: titleQuery(title, query.episode) })
}

async function seriesPool (query: AnimeQuery): Promise<ToshoRelease[]> {
  if (query.anidbAid) return seriesReleases(query.fetch, query.anidbAid)
  const title = primaryTitle(query.titles)
  if (!title) return []
  return searchReleases(query.fetch, { q: titleQuery(title) })
}

const extension = {
  async test (): Promise<boolean> {
    const res = await fetch(API)
    if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}.`)
    return true
  },

  async single (query: AnimeQuery, options: ToshoOptions = {}): Promise<TorrentResult[]> {
    const useTorrent = options.useTorrent ?? true
    return (await episodePool(query))
      .filter(r => (r.torrent_url || r.magnet) && passesFilters(r, query) && isEpisode(r, query.episode))
      .map(r => toResult(r, query, useTorrent))
  },

  async batch (query: AnimeQuery, options: ToshoOptions = {}): Promise<TorrentResult[]> {
    const useTorrent = options.useTorrent ?? true
    const title = primaryTitle(query.titles)
    const minFiles = Math.min(24, Math.max(2, query.episode ?? 1))
    const fromSeries = (await seriesPool(query)).filter(r => r.is_batch && (r.file_count ?? 0) >= minFiles)
    const pool = fromSeries.length || !title
      ? fromSeries
      : (await searchReleases(query.fetch, { q: `${titleQuery(title)} batch` })).filter(r => r.is_batch)
    return pool
      .filter(r => (r.torrent_url || r.magnet) && !query.exclusions?.some(e => e && (r.title ?? '').toLowerCase().includes(e.toLowerCase())))
      .map(r => ({ ...toResult(r, query, useTorrent), type: 'batch' as const }))
  },

  async movie (query: AnimeQuery, options: ToshoOptions = {}): Promise<TorrentResult[]> {
    const useTorrent = options.useTorrent ?? true
    return (await seriesPool(query))
      .filter(r => (r.torrent_url || r.magnet) && passesFilters(r, query))
      .map(r => toResult(r, query, useTorrent))
  }
}

export default extension
