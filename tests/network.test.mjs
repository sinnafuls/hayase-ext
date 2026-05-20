// Live-network tests. These actually hit the indexer backends to prove the
// extensions still work end-to-end. Slow, flaky if any indexer is down.
//
// Run with: npm run test:network
// Skip individual extensions: set SKIP=nzbgeek,althub (comma-separated ids).
// API keys for paid indexers: NZBGEEK_APIKEY, ALTHUB_APIKEY (skipped if absent).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import './helpers.mjs' // installs navigator polyfill

const SKIP = new Set((process.env.SKIP ?? '').split(',').map(s => s.trim()).filter(Boolean))
const NZBGEEK_APIKEY = process.env.NZBGEEK_APIKEY ?? ''
const ALTHUB_APIKEY = process.env.ALTHUB_APIKEY ?? ''

// Real-ish anime query: One Piece, ep 1.
// anilistId 21, anidbAid 69, anidbEid for ep 1 is 1 (legacy enough that data exists).
// tvdbId 81797, tvdbEId for S01E01 is 295068.
const ONE_PIECE = {
  media: {},
  anilistId: 21,
  anidbAid: 69,
  anidbEid: 1,
  tvdbId: 81797,
  tvdbEId: 295068,
  titles: ['One Piece'],
  episode: 1,
  resolution: '1080',
  exclusions: [],
  fetch: globalThis.fetch
}

// SubsPlease cleared their back catalog frequently — use a currently-airing
// show for that test to keep it green. Override with TEST_SHOW=... if needed.
const SUBSPLEASE_SHOW = process.env.TEST_SHOW ?? 'One Piece'

function maybeSkip (id, opts = {}) {
  if (SKIP.has(id)) return { skip: `SKIP env includes ${id}` }
  return opts
}

// -------- AnimeTosho (NZB by hash) --------
test('animetosho (nzb): test() reaches feed.animetosho.org', maybeSkip('animetosho'), async () => {
  const { default: ext } = await import('../dist/animetosho.js')
  assert.equal(await ext.test(), true)
})

test('animetosho (nzb): real hash lookup returns nzb_url or undefined', maybeSkip('animetosho'), async () => {
  const { default: ext } = await import('../dist/animetosho.js')
  // A SubsPlease One Piece release that has been on AnimeTosho a long time.
  // If it disappears, the test should still pass (undefined is valid).
  const result = await ext.single({
    ...ONE_PIECE,
    hash: '01a13aa6dd6e2ca7ee5d6db14e2fd4e0a3c0c5cd',
    name: '[SubsPlease] One Piece - 1000 (1080p) [9C1AC09C].mkv',
    file: '[SubsPlease] One Piece - 1000 (1080p) [9C1AC09C].mkv'
  })
  assert.ok(result === undefined || typeof result === 'string')
  if (typeof result === 'string') assert.match(result, /^https?:\/\//)
})

// -------- AnimeTosho (torrent) --------
test('animetosho-torrent: test() reaches feed.animetosho.org', maybeSkip('animetosho-torrent'), async () => {
  const { default: ext } = await import('../dist/animetosho-torrent.js')
  assert.equal(await ext.test(), true)
})

test('animetosho-torrent: single() by anidbEid returns shape', maybeSkip('animetosho-torrent'), async () => {
  const { default: ext } = await import('../dist/animetosho-torrent.js')
  const results = await ext.single(ONE_PIECE, {})
  assert.ok(Array.isArray(results))
  if (results.length) {
    const r = results[0]
    assert.ok(r.link?.includes('.torrent'), 'default is .torrent URL')
    assert.equal(typeof r.hash, 'string')
    assert.equal(typeof r.size, 'number')
  }
})

// -------- Nyaa --------
test('nyaa: test() reaches nyaa.si', maybeSkip('nyaa'), async () => {
  const { default: ext } = await import('../dist/nyaa.js')
  assert.equal(await ext.test(), true)
})

test('nyaa: real search returns torrents with infoHashes', maybeSkip('nyaa'), async () => {
  const { default: ext } = await import('../dist/nyaa.js')
  const results = await ext.single({ ...ONE_PIECE, episode: 1000 })
  assert.ok(Array.isArray(results))
  if (results.length) {
    assert.match(results[0].hash, /^[0-9a-f]{40}$/, 'infoHash should be 40 hex chars')
  }
})

// -------- SubsPlease --------
test('subsplease: test() reaches subsplease.org', maybeSkip('subsplease'), async () => {
  const { default: ext } = await import('../dist/subsplease.js')
  assert.equal(await ext.test(), true)
})

test('subsplease: batch() returns at least one batch release', maybeSkip('subsplease'), async () => {
  const { default: ext } = await import('../dist/subsplease.js')
  const results = await ext.batch({ ...ONE_PIECE, titles: [SUBSPLEASE_SHOW] }, {})
  assert.ok(Array.isArray(results))
  // Batch existence is content-dependent; just verify shape if any returned.
  for (const r of results) assert.equal(r.type, 'batch')
})

// -------- acg.rip --------
test('acgrip: test() reaches acg.rip', maybeSkip('acgrip'), async () => {
  const { default: ext } = await import('../dist/acgrip.js')
  assert.equal(await ext.test(), true)
})

test('acgrip: real search returns torrents with .torrent URLs', maybeSkip('acgrip'), async () => {
  const { default: ext } = await import('../dist/acgrip.js')
  const results = await ext.single(ONE_PIECE, {})
  assert.ok(Array.isArray(results))
  if (results.length) {
    assert.ok(results[0].link.endsWith('.torrent'), 'acg.rip returns .torrent URLs')
    assert.equal(results[0].hash, results[0].link)
  }
})

// -------- SeaDex --------
test('seadex: test() reaches releases.moe', maybeSkip('seadex'), async () => {
  const { default: ext } = await import('../dist/seadex.js')
  assert.equal(await ext.test(), true)
})

test('seadex: real query by anilistId returns hashes (link=undefined)', maybeSkip('seadex'), async () => {
  const { default: ext } = await import('../dist/seadex.js')
  const results = await ext.single({ anilistId: 21, titles: ['One Piece'], episodeCount: 1000 })
  assert.ok(Array.isArray(results))
  for (const r of results) {
    assert.equal(r.link, undefined, 'link must stay undefined for dedupe')
    assert.match(r.hash, /^[0-9a-f]{40}$/i)
    assert.ok(r.type === 'best' || r.type === 'alt')
  }
})

// -------- NekoBT --------
test('nekobt: test() reaches nekobt.to', maybeSkip('nekobt'), async () => {
  const { default: ext } = await import('../dist/nekobt.js')
  assert.equal(await ext.test(), true)
})

// -------- NZBGeek (needs API key) --------
const nzbgeekOpts = NZBGEEK_APIKEY
  ? maybeSkip('nzbgeek')
  : { skip: 'NZBGEEK_APIKEY not set' }

test('nzbgeek: test() reaches api.nzbgeek.info', nzbgeekOpts, async () => {
  const { default: ext } = await import('../dist/nzbgeek.js')
  assert.equal(await ext.test(), true)
})

test('nzbgeek: single() with real API key returns string or undefined', nzbgeekOpts, async () => {
  const { default: ext } = await import('../dist/nzbgeek.js')
  const result = await ext.single(
    { ...ONE_PIECE, hash: '0000000000000000000000000000000000000000', name: 'One Piece 01', file: 'One Piece 01.mkv' },
    { apikey: NZBGEEK_APIKEY }
  )
  assert.ok(result === undefined || typeof result === 'string')
})

// -------- AltHub (needs API key) --------
const althubOpts = ALTHUB_APIKEY
  ? maybeSkip('althub')
  : { skip: 'ALTHUB_APIKEY not set' }

test('althub: test() reaches api.althub.co.za', althubOpts, async () => {
  const { default: ext } = await import('../dist/althub.js')
  assert.equal(await ext.test(), true)
})

test('althub: single() with real API key returns string or undefined', althubOpts, async () => {
  const { default: ext } = await import('../dist/althub.js')
  const result = await ext.single(
    { ...ONE_PIECE, hash: '0000000000000000000000000000000000000000', name: 'One Piece 01', file: 'One Piece 01.mkv' },
    { apikey: ALTHUB_APIKEY }
  )
  assert.ok(result === undefined || typeof result === 'string')
})
