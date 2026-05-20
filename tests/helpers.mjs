// Shared test helpers: navigator polyfill (some vendored extensions check
// `navigator.onLine`) and a mock-fetch builder for unit tests.

// Node 22+ ships `navigator`, but only with `userAgent` — `onLine` is undefined,
// which the vendored extensions read as "offline" and short-circuit to [].
// Define an own-prop with a getter so it overrides the read-only global on Node.
if (!('onLine' in (globalThis.navigator ?? {}))) {
  try { Object.defineProperty(globalThis.navigator ?? (globalThis.navigator = {}), 'onLine', { value: true, configurable: true }) }
  catch { globalThis.navigator = { ...(globalThis.navigator ?? {}), onLine: true } }
}

export function mockFetch (routes) {
  const calls = []
  const fetcher = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url ?? String(input)
    calls.push({ url, init })
    const route = routes.find(r => {
      if (typeof r.match === 'string') return url.includes(r.match)
      if (r.match instanceof RegExp) return r.match.test(url)
      if (typeof r.match === 'function') return r.match(url)
      return false
    })
    if (!route) throw new Error(`mockFetch: no route for ${url}`)
    const status = route.status ?? 200
    const headers = route.headers ?? { 'content-type': 'application/json' }
    const body = typeof route.body === 'function' ? route.body(url) : route.body
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers
    })
  }
  fetcher.calls = calls
  return fetcher
}

export function makeAnimeQuery (overrides = {}) {
  return {
    media: {},
    anilistId: 21,
    titles: ['One Piece'],
    episode: 1,
    resolution: '1080',
    exclusions: [],
    fetch: globalThis.fetch,
    ...overrides
  }
}

export function makeNzbQuery (overrides = {}) {
  return {
    media: {},
    anilistId: 21,
    titles: ['One Piece'],
    episode: 1,
    hash: '0000000000000000000000000000000000000000',
    name: '[Group] One Piece - 01 [1080p].mkv',
    file: '[Group] One Piece - 01 [1080p].mkv',
    fetch: globalThis.fetch,
    ...overrides
  }
}
