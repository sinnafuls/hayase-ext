export type Resolution = '2160' | '1080' | '720' | '540' | '480' | ''

export interface AnimeQuery {
  media: unknown
  anilistId: number
  anidbAid?: number
  anidbEid?: number
  tvdbId?: number
  tvdbEId?: number
  imdbId?: string
  tmdbId?: string
  titles: string[]
  episode: number
  episodeCount?: number
  absoluteEpisodeNumber?: number
  resolution: Resolution
  exclusions: string[]
  fetch: typeof globalThis.fetch
}

export type NZBQuery = Omit<AnimeQuery, 'resolution' | 'exclusions'> & {
  hash: string
  name: string
} & ({ file: string } | { files: string[] })

export interface ExtensionOptions {
  apikey?: string
  baseUrl?: string
  category?: string
}

export interface NewznabItem {
  title: string
  guid: string
  link: string
  size: number
  pubDate: string
}

export interface TorrentResult {
  title: string
  link: string
  id?: number
  seeders: number
  leechers: number
  downloads: number
  accuracy: 'high' | 'medium' | 'low'
  hash: string
  size: number
  date: Date
  type?: 'batch' | 'best' | 'alt'
}
