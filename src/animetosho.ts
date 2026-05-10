import type { NZBQuery } from './types.js'

const API = 'https://feed.animetosho.org/json'

async function lookupByHash (hash: string, fetcher: typeof globalThis.fetch): Promise<string | undefined> {
  if (!hash) return undefined
  const url = `${API}?show=torrent&btih=${hash.toLowerCase()}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  let res: Response
  try {
    res = await fetcher(url, { signal: controller.signal })
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('AnimeTosho request timed out after 10s. Site may be slow or blocked in your region.')
    }
    throw new Error(`Could not reach AnimeTosho: ${(err as Error).message}`)
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 404) return undefined
  if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}.`)

  const data = await res.json() as { nzb_url?: string } | null | undefined
  return data?.nzb_url
}

const extension = {
  async test (): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetch(API, { signal: controller.signal })
      if (!res.ok) throw new Error(`AnimeTosho returned HTTP ${res.status}.`)
      return true
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new Error('AnimeTosho did not respond within 10s. Check your network or whether feed.animetosho.org is blocked.')
      }
      throw new Error(`Could not reach AnimeTosho: ${(err as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  },

  async single (query: NZBQuery): Promise<string | undefined> {
    return lookupByHash(query.hash, query.fetch)
  },

  async batch (query: NZBQuery): Promise<string | undefined> {
    return lookupByHash(query.hash, query.fetch)
  },

  async movie (query: NZBQuery): Promise<string | undefined> {
    return lookupByHash(query.hash, query.fetch)
  }
}

export default extension
