# hayase-ext

A self-hosted set of [Hayase](https://hayase.watch) anime extensions — three NZB indexers and five torrent indexers. Vendored copies of the public `exten.pages.dev` set plus a few of our own (NZBGeek, AltHub, Nyaa, SubsPlease, the AnimeTosho v1 pair).

## Install in Hayase

1. **Settings → Extensions → Repositories**
2. Paste:
   ```
   https://raw.githubusercontent.com/sinnafuls/hayase-ext/main/index.json
   ```
3. Click **Import Extensions**

All eight extensions show up. Open the cog (⚙) on each to configure if it needs a key.

## What's in here

### NZB (`Settings → NZB Client` must also be configured)

| Extension | Needs config? | Notes |
| --- | --- | --- |
| **NZBGeek** | API key | Newznab indexer. Strong on BD remuxes (Moozzi2, KAF). Get a key at [nzbgeek.info → Account → API Settings](https://nzbgeek.info). |
| **AltHub** | API key | Newznab indexer with better fansub coverage (Erai-raws, Almighty, Ember). Get a key at [althub.co.za → Profile → API](https://althub.co.za). |
| **AnimeTosho** | None | Looks up the torrent's infoHash in [AnimeTosho v1](https://feed.animetosho.net) and returns its mirrored `.nzb`. Byte-identical by design — the best odds Hayase's filename/filesize gate passes. |

For NZBs to actually deliver bytes, the NZB's file must match the torrent's file by **filename or filesize** (Hayase's matching gate in `torrent-client/nzb.ts`). AnimeTosho mirrors are byte-identical; NZBGeek/AltHub work when the indexer happens to have the same release as your torrent (often true for BD remuxes, rarely true for fansubs).

### Torrent

| Extension | Needs config? | Notes |
| --- | --- | --- |
| **Nyaa** | None | Direct [nyaa.si](https://nyaa.si) RSS — anime torrents with infoHash extraction. |
| **AnimeTosho (torrent)** | None | [AnimeTosho v1](https://feed.animetosho.net) — an aggregator over Nyaa, NekoBT, AniDex, DMHY and others. Searches by AniDB id, and by title when ani.zip has no mapping yet (common for a new season). Returns `.torrent` links by default so Hayase has file metadata immediately; set `useTorrent` false for magnets. |
| **SubsPlease** | None | [subsplease.org](https://subsplease.org) JSON API — a single trusted group, byte-identical to their published magnets. `resolution` option picks 480/720/1080. |
| **NekoBT** | None | Private-tracker-style index at [nekobt.to](https://nekobt.to). Resolves TVDB/TMDB/AniList → NekoBT media via the site's own `/torrents/search` endpoint. Shows without a usable id, or unknown to NekoBT, return no results instead of an error. |
| **SeaDex** | None | Curation layer at [seadex.moe](https://seadex.moe) (releases.moe now redirects there). Returns community-picked **best** / **alt** releases by AniList id — exposes hashes only, Hayase finds peers via DHT. SeaDex redacts hashes for private-tracker (AnimeBytes) entries; those are dropped. |

All eight extensions are bundled from this repo. Nothing depends on `exten.pages.dev` at runtime — if that site goes down or breaks, ours keep working.

AnimeTosho's **old** feed (`feed.animetosho.org/json`) stopped indexing in May 2026 and rejects unfiltered queries; its replacement, the v1 API, is live and current, which is what both AnimeTosho extensions here use. acg.rip is not included: it rate-limits short bursts and then refuses connections.

### Other trackers, evaluated

Checked live against a current-season search (Tougen Anki S2, Oct 2026):

| Source | What it gives | Verdict |
| --- | --- | --- |
| [AniSearch](https://api.anisearch.org) | AniDB-id search, JSON, `.torrent` URLs + infoHashes | Works, but for the test query all 29 results were sourced from Nyaa — redundant next to our Nyaa extension. Add only if it starts covering non-Nyaa sources. |
| [TokyoTosho](https://www.tokyotosho.info) | RSS search, large index | Every item's link points at `nyaa.si/download/…` — a mirror, no new coverage. |
| [Mikan Project](https://mikanani.me) | RSS search with real `.torrent` enclosures, CJK fansubs | Works, live current-season hits. Good option if CJK coverage is wanted (replaces what acg.rip offered). |
| [DMHY](https://share.dmhy.org) | RSS search with base32 magnet enclosures, CJK fansubs | Works. Same role as Mikan; needs a base32→hex hash decode (the SubsPlease extension does this already). |
| [AniDex](https://anidex.info) | RSS with infoHashes | HTTP 502 at check time. Candidate, untested. |
| [AniRena](https://www.anirena.com) | RSS | 302 redirect on the feed; needs redirect handling before use. |
| [Bangumi.moe](https://bangumi.moe) | JSON API | Documented API path returned 404; would need reverse-engineering. |

## Issues

If something breaks, open an issue: https://github.com/sinnafuls/hayase-ext/issues

A useful issue includes:
- Which extension is misbehaving
- The release name you tried to play (the `[Group] Show - 01 [...]` string)
- Anything in DevTools Network tab filtered by the extension's domain (`api.nzbgeek.info`, `api.althub.co.za`, `nyaa.si`, `feed.animetosho.net`, `nekobt.to`, `seadex.moe`)

## Development

```bash
nix develop         # optional: Node 22 toolchain from flake.nix (matches CI)
npm install
npm run build       # bundles src/ → dist/*.js (one per extension)
npm run watch       # rebuild on save
npm run typecheck   # tsc --noEmit
```

Pushes that touch `src/` trigger `.github/workflows/build.yml`, which rebuilds the bundles and commits them back. To roll out a change, also bump the relevant entry's `version` in `index.json` — Hayase only re-fetches when the version increases.

## Reference

- [Hayase wiki — Creating Extensions](https://github.com/hayase-app/wiki/blob/master/extensions/development/creating-extensions.md)
- [Hayase wiki — NZB Extensions](https://github.com/hayase-app/wiki/blob/master/extensions/nzb-extensions.md)
- [Newznab API spec](https://github.com/Prowlarr/Prowlarr/wiki/Newznab-API)
