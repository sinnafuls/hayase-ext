# hayase-ext

A self-hosted set of [Hayase](https://hayase.watch) anime extensions — three NZB indexers and four torrent indexers. Vendored copies of the public `exten.pages.dev` set plus a few of our own (NZBGeek, AltHub, our self-hosted Nyaa, plus a working AnimeTosho NZB to replace the upstream one whose `single()` is empty).

## Install in Hayase

1. **Settings → Extensions → Repositories**
2. Paste:
   ```
   https://raw.githubusercontent.com/sinnafuls/hayase-ext/main/index.json
   ```
3. Click **Import Extensions**

All three extensions show up. Open the cog (⚙) on each to configure if it needs a key.

## What's in here

### NZB (`Settings → NZB Client` must also be configured)

| Extension | Needs config? | Notes |
| --- | --- | --- |
| **AnimeTosho** | None | Looks up NZBs by torrent infoHash via [feed.animetosho.org](https://feed.animetosho.org). Byte-identical mirror of fansub torrents → highest chance Hayase actually streams from Usenet. The upstream `exten.pages.dev` extension has a bug (its `single()` is empty so single-file torrents never match); this version implements both. |
| **NZBGeek** | API key | Newznab indexer. Strong on BD remuxes (Moozzi2, KAF). Get a key at [nzbgeek.info → Account → API Settings](https://nzbgeek.info). |
| **AltHub** | API key | Newznab indexer with better fansub coverage (Erai-raws, Almighty, Ember). Get a key at [althub.co.za → Profile → API](https://althub.co.za). |

For NZBs to actually deliver bytes, the NZB's file must match the torrent's file by **filename or filesize** (Hayase's matching gate in `torrent-client/nzb.ts`). AnimeTosho is byte-identical by design; NZBGeek/AltHub work when the indexer happens to have the same release as your torrent (often true for BD remuxes, rarely true for fansubs).

### Torrent

| Extension | Needs config? | Notes |
| --- | --- | --- |
| **Nyaa** | None | Direct [nyaa.si](https://nyaa.si) RSS — anime torrents with infoHash extraction. |
| **AnimeTosho (torrent)** | None | AniDB-based search via [feed.animetosho.org](https://feed.animetosho.org). Returns `.torrent` URLs by default (deviation from upstream, which uses magnet) so Hayase has file metadata immediately — required for the NZB pipeline to fire on dead torrents. Toggle `useTorrent` off if you specifically want magnet links. |
| **NekoBT** | None | Private-tracker-style index at [nekobt.to](https://nekobt.to). Maps TVDB/TMDB/IMDB → NekoBT id via an external JSON (vendored — fetched at runtime from a fixed GitHub URL). |
| **SeaDex** | None | Curation layer at [releases.moe](https://releases.moe). Returns community-picked **best** / **alt** releases by AniList id — exposes hashes only, Hayase finds peers via DHT. |

All seven extensions are vendored locally. The repo doesn't depend on `exten.pages.dev` at runtime — if that site goes down or breaks, ours keep working.

## Issues

If something breaks, open an issue: https://github.com/sinnafuls/hayase-ext/issues

A useful issue includes:
- Which extension is misbehaving
- The release name you tried to play (the `[Group] Show - 01 [...]` string)
- Anything in DevTools Network tab filtered by the extension's domain (`api.nzbgeek.info`, `api.althub.co.za`, or `nyaa.si`)

## Development

```bash
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
