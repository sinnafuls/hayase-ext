export interface NyaaItem {
  title: string
  link: string
  guid: string
  hash: string
  size: number
  seeders: number
  leechers: number
  downloads: number
  trusted: boolean
  remake: boolean
  categoryId: string
  pubDate: string
}

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'"
}

function decodeText (raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(?:lt|gt|amp|quot|apos|#39);/g, m => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .trim()
}

function parseItemBody (body: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /<((?:[a-zA-Z][a-zA-Z0-9]*:)?[a-zA-Z][a-zA-Z0-9]*)(?:\s[^>]*?)?>([\s\S]*?)<\/\1>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    out[m[1]!] = decodeText(m[2]!)
  }
  return out
}

export function parseSize (raw: string): number {
  if (!raw) return 0
  const m = /^([\d.,]+)\s*(B|KiB|MiB|GiB|TiB|KB|MB|GB|TB)$/i.exec(raw.trim())
  if (!m) return 0
  const num = parseFloat(m[1]!.replace(/,/g, ''))
  if (!Number.isFinite(num)) return 0
  const mult: Record<string, number> = {
    b: 1,
    kib: 1024, kb: 1000,
    mib: 1024 ** 2, mb: 1000 ** 2,
    gib: 1024 ** 3, gb: 1000 ** 3,
    tib: 1024 ** 4, tb: 1000 ** 4
  }
  return Math.round(num * (mult[m[2]!.toLowerCase()] ?? 1))
}

export function parseRSS (xml: string): NyaaItem[] {
  const items: NyaaItem[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    const f = parseItemBody(m[1]!)
    const link = f.link ?? ''
    if (!link) continue
    items.push({
      title: f.title ?? '',
      link,
      guid: f.guid ?? '',
      hash: (f['nyaa:infoHash'] ?? '').toLowerCase(),
      size: parseSize(f['nyaa:size'] ?? ''),
      seeders: Number(f['nyaa:seeders'] ?? 0) || 0,
      leechers: Number(f['nyaa:leechers'] ?? 0) || 0,
      downloads: Number(f['nyaa:downloads'] ?? 0) || 0,
      trusted: /^yes$/i.test(f['nyaa:trusted'] ?? ''),
      remake: /^yes$/i.test(f['nyaa:remake'] ?? ''),
      categoryId: f['nyaa:categoryId'] ?? '',
      pubDate: f.pubDate ?? ''
    })
  }
  return items
}
