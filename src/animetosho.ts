import type { NZBQuery } from './types.js'
import { API, searchReleases } from './animetosho-core.js'

// NZB side of AnimeTosho v1: look the torrent's infoHash up in the catalog and
// return the mirrored .nzb. The releases are byte-identical mirrors, which is
// what Hayase's filename/filesize gate needs.
const HASH_RE = /^[0-9a-f]{40}$/i

async function lookup (fetcher: typeof globalThis.fetch, hash: string): Promise<string | undefined> {
  const wanted = hash?.trim().toLowerCase()
  if (!wanted || !HASH_RE.test(wanted)) return undefined
  // The search endpoint is full-text, so the hash itself is the query term.
  const releases = await searchReleases(fetcher, { q: wanted, limit: 5 })
  const hit = releases.find(r => (r.info_hash ?? '').toLowerCase() === wanted)
  return hit?.nzb_url ?? undefined
}

const extension = {
  async test (): Promise<boolean> {
    const res = await fetch(API)
    if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}.`)
    return true
  },

  async single (query: NZBQuery): Promise<string | undefined> {
    return lookup(query.fetch, query.hash)
  },

  async batch (query: NZBQuery): Promise<string | undefined> {
    return lookup(query.fetch, query.hash)
  },

  async movie (query: NZBQuery): Promise<string | undefined> {
    return lookup(query.fetch, query.hash)
  }
}

export default extension
