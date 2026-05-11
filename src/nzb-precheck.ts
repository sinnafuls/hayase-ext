// Fetches a candidate .nzb file and reports whether it carries any of the
// expected filenames. We don't try to extract clean filenames from the free-text
// `<file subject="...">` attributes — different indexers format them differently
// and the regex gymnastics aren't reliable. Instead we just check whether the
// expected filename appears anywhere as a substring of any subject. That's the
// best heuristic available without parsing a full XML DOM.
//
// Hayase's matching gate (torrent-client/nzb.ts) requires `f.name === file.name`
// or `f.size === file.length` for an NZB file to feed bytes into the torrent.
// String-search indexers (NZBGeek, AltHub) often return NZBs whose internal
// filenames don't match the torrent the user picked — those silently get
// dropped on the Hayase side and the NNTP peer shows 0% availability.
//
// This pre-check filters those NZBs at the extension level so we only return
// URLs that have a real chance of byte-matching. If we can't reach the .nzb
// or can't parse it, we err on the side of returning the URL anyway (the gate
// downstream still rejects bad bytes — pre-check is a hint, not a guarantee).

const SUBJECT_RE = /<file\b[^>]*\ssubject\s*=\s*"([^"]*)"/gi

function decodeXMLEntities (s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
}

export function extractNZBSubjects (xml: string): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = SUBJECT_RE.exec(xml)) !== null) {
    out.push(decodeXMLEntities(m[1]!))
  }
  return out
}

async function fetchNZBText (
  fetcher: typeof globalThis.fetch,
  url: string,
  timeoutMs = 5000
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetcher(url, { signal: controller.signal })
    if (!res.ok) return null
    const ct = (res.headers.get('content-type') ?? '').toLowerCase()
    // Web Workers can't easily ungzip without a dependency. If the indexer
    // serves the .nzb gzipped, skip the pre-check and let Hayase try anyway.
    if (ct.includes('gzip') || url.endsWith('.gz') || url.endsWith('.nzb.gz')) {
      return null
    }
    return await res.text()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function nzbMatchesAnyFile (
  fetcher: typeof globalThis.fetch,
  nzbUrl: string,
  expected: string[]
): Promise<boolean> {
  const wanted = expected.filter(Boolean)
  if (!wanted.length) return true
  const xml = await fetchNZBText(fetcher, nzbUrl)
  if (!xml) return true
  const subjects = extractNZBSubjects(xml)
  if (!subjects.length) return true
  const lowerSubjects = subjects.map(s => s.toLowerCase())
  return wanted.some(f => {
    const lc = f.toLowerCase()
    return lowerSubjects.some(s => s.includes(lc))
  })
}
