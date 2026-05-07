import type { NewznabItem } from './types.js'

interface SearchOpts {
  fetch: typeof globalThis.fetch
  baseUrl: string
  apikey: string
  params: Record<string, string | number | undefined>
}

function asArray<T> (v: T | T[] | null | undefined): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function pickField (it: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = it[k]
    if (typeof v === 'string' && v) return v
    if (v && typeof v === 'object') {
      const obj = v as Record<string, unknown>
      const inner = obj['#text'] ?? obj.text ?? obj['@attributes']
      if (typeof inner === 'string' && inner) return inner
      if (inner && typeof inner === 'object') {
        const url = (inner as Record<string, unknown>).url
        if (typeof url === 'string' && url) return url
      }
    }
  }
  return ''
}

function pickEnclosureUrl (it: Record<string, unknown>): string {
  const enc = it.enclosure as Record<string, unknown> | undefined
  if (!enc) return ''
  const attrs = enc['@attributes'] as Record<string, unknown> | undefined
  if (attrs && typeof attrs.url === 'string') return attrs.url
  if (typeof enc.url === 'string') return enc.url
  return ''
}

function pickSize (it: Record<string, unknown>): number {
  if (typeof it.size === 'number') return it.size
  if (typeof it.size === 'string' && it.size) return Number(it.size) || 0
  const enc = it.enclosure as Record<string, unknown> | undefined
  const attrs = enc?.['@attributes'] as Record<string, unknown> | undefined
  const len = attrs?.length ?? enc?.length
  if (typeof len === 'string' || typeof len === 'number') return Number(len) || 0
  const newznabAttrs = asArray(it['newznab:attr'] ?? it.attr) as Array<Record<string, unknown>>
  for (const a of newznabAttrs) {
    const at = (a['@attributes'] ?? a) as Record<string, unknown>
    if (at.name === 'size' && (typeof at.value === 'string' || typeof at.value === 'number')) {
      return Number(at.value) || 0
    }
  }
  return 0
}

export async function newznabSearch ({ fetch, baseUrl, apikey, params }: SearchOpts): Promise<NewznabItem[]> {
  const url = new URL(baseUrl.replace(/\/+$/, '') + '/api')
  url.searchParams.set('apikey', apikey)
  url.searchParams.set('o', 'json')
  url.searchParams.set('extended', '1')
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue
    url.searchParams.set(k, String(v))
  }

  let res: Response
  try {
    res = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  } catch (err) {
    throw new Error(`Could not reach NZBGeek: ${(err as Error).message}`)
  }

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`NZBGeek returned HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }

  if (text.includes('<error')) {
    const code = /code="([^"]+)"/.exec(text)?.[1]
    const desc = /description="([^"]+)"/.exec(text)?.[1]
    throw new Error(`NZBGeek error${code ? ` ${code}` : ''}: ${desc || 'check your API key and category settings'}`)
  }

  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('NZBGeek returned a non-JSON response. Verify the API base URL and that the indexer supports o=json.')
  }

  const root = (data as Record<string, unknown>) ?? {}
  const channel = (root.channel ?? root) as Record<string, unknown>
  const items = asArray(channel.item) as Array<Record<string, unknown>>

  return items
    .map<NewznabItem>(it => ({
      title: pickField(it, 'title'),
      guid: pickField(it, 'guid'),
      link: pickField(it, 'link') || pickEnclosureUrl(it),
      size: pickSize(it),
      pubDate: pickField(it, 'pubDate')
    }))
    .filter(it => it.link)
}
