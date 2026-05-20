// Offline tests for the built extensions. Every backend is mocked via either
// query.fetch (for TS extensions that take an injected fetcher) or by swapping
// globalThis.fetch (for vendored .js extensions that use the global directly).
//
// Run with: npm run test:unit
//
// These exercise parsing, ranking, and the response shape Hayase consumes.
// They do NOT prove the live APIs work — that's network.test.mjs's job.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mockFetch, makeAnimeQuery, makeNzbQuery } from './helpers.mjs'
import * as fx from './fixtures.mjs'

const realFetch = globalThis.fetch
function swapGlobalFetch (fetcher) {
  globalThis.fetch = fetcher
  return () => { globalThis.fetch = realFetch }
}

// -------- Nyaa --------
test('nyaa: parses RSS and surfaces seeders/hash/size', async () => {
  const { default: nyaa } = await import('../dist/nyaa.js')
  const fetcher = mockFetch([{ match: 'nyaa.si', body: fx.nyaaRss, headers: { 'content-type': 'application/rss+xml' } }])
  const results = await nyaa.single(makeAnimeQuery({ fetch: fetcher }))
  assert.ok(results.length >= 1, 'expected at least one result')
  const first = results[0]
  assert.equal(first.hash, 'aabbccddeeff00112233445566778899aabbccdd')
  assert.equal(first.seeders, 123)
  assert.equal(first.size, Math.round(1.4 * 1024 ** 3))
  assert.equal(first.accuracy, 'high', 'trusted+title hit should be high')
  assert.ok(first.link.includes('1234567.torrent'))
})

test('nyaa: exclusions filter out unwanted titles', async () => {
  const { default: nyaa } = await import('../dist/nyaa.js')
  const fetcher = mockFetch([{ match: 'nyaa.si', body: fx.nyaaRss, headers: { 'content-type': 'application/rss+xml' } }])
  const results = await nyaa.single(makeAnimeQuery({ fetch: fetcher, exclusions: ['Remake'] }))
  assert.ok(results.every(r => !r.title.includes('Remake')))
})

// -------- acg.rip --------
test('acgrip: parses RSS, uses .torrent URL as both link and hash', async () => {
  const { default: acgrip } = await import('../dist/acgrip.js')
  const fetcher = mockFetch([{ match: 'acg.rip', body: fx.acgripRss, headers: { 'content-type': 'application/rss+xml' } }])
  const results = await acgrip.single(makeAnimeQuery({ fetch: fetcher }))
  assert.ok(results.length === 1)
  assert.equal(results[0].link, 'https://acg.rip/t/999.torrent')
  assert.equal(results[0].hash, results[0].link, 'hash should equal .torrent URL (no infoHash exposed)')
  assert.ok(results[0].size > 0)
})

// -------- SubsPlease --------
test('subsplease: decodes base32 magnet hash, picks preferred resolution', async () => {
  const { default: sp } = await import('../dist/subsplease.js')
  const fetcher = mockFetch([{ match: 'subsplease.org/api', body: fx.subspleaseJson }])
  const results = await sp.single(makeAnimeQuery({ fetch: fetcher }))
  assert.ok(results.length === 1, 'should find One Piece ep 1, ignore batch')
  assert.equal(results[0].hash, 'ccddeeff00112233445566778899aabbccddeef0')
  assert.equal(results[0].size, 1_500_000_000)
  assert.ok(results[0].title.includes('1080p'))
})

test('subsplease: batch() returns only Batch releases', async () => {
  const { default: sp } = await import('../dist/subsplease.js')
  const fetcher = mockFetch([{ match: 'subsplease.org/api', body: fx.subspleaseJson }])
  const results = await sp.batch(makeAnimeQuery({ fetch: fetcher }))
  assert.equal(results.length, 1)
  assert.equal(results[0].type, 'batch')
})

// -------- Newznab (NZBGeek/AltHub share the factory) --------
test('nzbgeek: parses JSON, returns the .nzb link', async () => {
  const { default: ext } = await import('../dist/nzbgeek.js')
  const fetcher = mockFetch([
    // Order matters: nzb URLs first so they don't get caught by the `apikey=`
    // search route (the URL also contains apikey only via the search request).
    { match: '/nzb/', body: fx.nzbXml, headers: { 'content-type': 'application/x-nzb' } },
    { match: 'apikey=', body: fx.newznabJson }
  ])
  const link = await ext.single(
    makeNzbQuery({ fetch: fetcher }),
    { apikey: 'test', baseUrl: 'https://api.nzbgeek.info' }
  )
  assert.equal(link, 'https://api.example.com/nzb/abc')
})

test('nzbgeek: missing API key throws a helpful error', async () => {
  const { default: ext } = await import('../dist/nzbgeek.js')
  await assert.rejects(
    () => ext.single(makeNzbQuery(), {}),
    /API key is missing/
  )
})

test('althub: same factory as nzbgeek, same behavior', async () => {
  const { default: ext } = await import('../dist/althub.js')
  const fetcher = mockFetch([
    { match: '/nzb/', body: fx.nzbXml, headers: { 'content-type': 'application/x-nzb' } },
    { match: 'apikey=', body: fx.newznabJson }
  ])
  const link = await ext.single(
    makeNzbQuery({ fetch: fetcher }),
    { apikey: 'test', baseUrl: 'https://api.althub.co.za' }
  )
  assert.equal(link, 'https://api.example.com/nzb/abc')
})

// -------- AnimeTosho (NZB by hash) --------
test('animetosho (nzb): looks up by infoHash, returns nzb_url', async () => {
  const { default: ext } = await import('../dist/animetosho.js')
  const fetcher = mockFetch([{ match: 'feed.animetosho.org', body: fx.animetoshoByHashJson }])
  const link = await ext.single(makeNzbQuery({ fetch: fetcher, hash: 'aabbccddeeff00112233445566778899aabbccdd' }))
  assert.equal(link, 'https://animetosho.org/storage/nzbs/abc.nzb')
})

test('animetosho (nzb): 404 returns undefined, not an error', async () => {
  const { default: ext } = await import('../dist/animetosho.js')
  const fetcher = mockFetch([{ match: 'feed.animetosho.org', status: 404, body: 'not found', headers: { 'content-type': 'text/plain' } }])
  const link = await ext.single(makeNzbQuery({ fetch: fetcher }))
  assert.equal(link, undefined)
})

// -------- AnimeTosho (torrent by anidbEid/anidbAid) --------
test('animetosho-torrent: returns .torrent URL by default (useTorrent=true)', async () => {
  const restore = swapGlobalFetch(mockFetch([{ match: 'feed.animetosho.org', body: fx.animetoshoByEidJson }]))
  try {
    const { default: ext } = await import('../dist/animetosho-torrent.js')
    const results = await ext.single({ anidbEid: 12345, resolution: '1080', exclusions: [] }, {})
    assert.equal(results.length, 1)
    assert.ok(results[0].link.includes('.torrent'), 'default should be .torrent URL not magnet')
    assert.equal(results[0].hash, 'aabbccddeeff00112233445566778899aabbccdd')
  } finally {
    restore()
  }
})

test('animetosho-torrent: useTorrent=false returns magnet', async () => {
  const restore = swapGlobalFetch(mockFetch([{ match: 'feed.animetosho.org', body: fx.animetoshoByEidJson }]))
  try {
    const { default: ext } = await import('../dist/animetosho-torrent.js')
    const results = await ext.single({ anidbEid: 12345, resolution: '1080', exclusions: [] }, { useTorrent: false })
    assert.ok(results[0].link.startsWith('magnet:'))
  } finally {
    restore()
  }
})

// -------- SeaDex --------
test('seadex: returns infoHash with link=undefined (dedupe-friendly)', async () => {
  const restore = swapGlobalFetch(mockFetch([{ match: 'releases.moe', body: fx.seadexJson }]))
  try {
    const { default: ext } = await import('../dist/seadex.js')
    const results = await ext.single({ anilistId: 21, titles: ['One Piece'], episodeCount: 1000 })
    assert.equal(results.length, 1, 'should drop the <redacted> entry')
    assert.equal(results[0].hash, 'aabbccddeeff00112233445566778899aabbccdd')
    assert.equal(results[0].link, undefined, 'link must be undefined so Nyaa can win dedupe')
    assert.equal(results[0].type, 'best')
  } finally {
    restore()
  }
})

// -------- NekoBT --------
test('nekobt: resolves tvdbId via /torrents/search, then queries by media_id', async () => {
  // First call (tvdbid=...) returns media+episodes; second call (media_id=...)
  // returns actual torrent results. Route order matters — media_id= must come
  // first because tvdbid= would also be a substring of the first URL.
  const fetcher = mockFetch([
    { match: 'media_id=', body: fx.nekobtSearchJson },
    { match: 'tvdbid=', body: fx.nekobtMediaSearchJson }
  ])
  const ext = (await import(`../dist/nekobt.js?nekobt-${Date.now()}`)).default
  const results = await ext.single({ tvdbId: 12345, tvdbEId: 11111, episode: 1, fetch: fetcher }, {})
  assert.equal(results.length, 1)
  assert.equal(results[0].hash, 'aabbccddeeff00112233445566778899aabbccdd')
  assert.equal(results[0].accuracy, 'high', 'matching tvdbEId means high accuracy')
  assert.ok(results[0].link.includes('1099511627776/download'))
})

test('nekobt: batch() and movie() return empty (NekoBT only indexes singles)', async () => {
  const ext = (await import(`../dist/nekobt.js?nekobt-${Date.now()}-b`)).default
  assert.deepEqual(await ext.batch({}, {}), [])
  assert.deepEqual(await ext.movie({}, {}), [])
})

// -------- nzb-precheck (via newznab-extension ranking) --------
test('nzbgeek: pre-check filters NZBs whose internal files do not match expected', async () => {
  // Set up two NZBs: one with our wanted filename, one without. We expect
  // the pre-check to pick the one that matches.
  const newznabWithTwo = JSON.stringify({
    channel: {
      item: [
        // First (higher pubDate score) does NOT contain the expected file
        { title: 'wrong release', guid: 'g1', link: 'https://api.example.com/nzb/wrong', pubDate: 'x', size: '2000000000' },
        { title: 'right release', guid: 'g2', link: 'https://api.example.com/nzb/right', pubDate: 'x', size: '1500000000' }
      ]
    }
  })
  const wrongNzb = fx.nzbXml.replace(/One Piece - 01/g, 'Different Show - 01')
  const fetcher = mockFetch([
    // nzb routes first — substring 'api' would otherwise leak from 'api.example.com'.
    { match: '/nzb/wrong', body: wrongNzb, headers: { 'content-type': 'application/x-nzb' } },
    { match: '/nzb/right', body: fx.nzbXml, headers: { 'content-type': 'application/x-nzb' } },
    { match: 'apikey=', body: newznabWithTwo }
  ])
  const { default: ext } = await import('../dist/nzbgeek.js')
  const link = await ext.single(
    makeNzbQuery({ fetch: fetcher, name: '[Group] One Piece - 01 [1080p].mkv', file: '[Group] One Piece - 01 [1080p].mkv' }),
    { apikey: 'test' }
  )
  // Pre-check should have walked past `wrong` (no filename match) to `right`.
  assert.equal(link, 'https://api.example.com/nzb/right')
})
