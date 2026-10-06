# hayase-ext

A self-hosted set of [Hayase](https://hayase.watch) anime extensions — two NZB indexers and four torrent indexers. Vendored copies of the public `exten.pages.dev` set plus a few of our own (NZBGeek, AltHub, Nyaa, SubsPlease).

## Install in Hayase

1. **Settings → Extensions → Repositories**
2. Paste:
   ```
   https://raw.githubusercontent.com/sinnafuls/hayase-ext/main/index.json
   ```
3. Click **Import Extensions**

All six extensions show up. Open the cog (⚙) on each to configure if it needs a key.

## What's in here

### NZB (`Settings → NZB Client` must also be configured)

| Extension | Needs config? | Notes |
| --- | --- | --- |
| **NZBGeek** | API key | Newznab indexer. Strong on BD remuxes (Moozzi2, KAF). Get a key at [nzbgeek.info → Account → API Settings](https://nzbgeek.info). |
| **AltHub** | API key | Newznab indexer with better fansub coverage (Erai-raws, Almighty, Ember). Get a key at [althub.co.za → Profile → API](https://althub.co.za). |

For NZBs to actually deliver bytes, the NZB's file must match the torrent's file by **filename or filesize** (Hayase's matching gate in `torrent-client/nzb.ts`). NZBGeek/AltHub work when the indexer happens to have the same release as your torrent (often true for BD remuxes, rarely true for fansubs).

### Torrent

| Extension | Needs config? | Notes |
| --- | --- | --- |
| **Nyaa** | None | Direct [nyaa.si](https://nyaa.si) RSS — anime torrents with infoHash extraction. |
| **SubsPlease** | None | [subsplease.org](https://subsplease.org) JSON API — a single trusted group, byte-identical to their published magnets. `resolution` option picks 480/720/1080. |
| **NekoBT** | None | Private-tracker-style index at [nekobt.to](https://nekobt.to). Resolves TVDB/TMDB → NekoBT media via the site's own `/torrents/search?tvdbid=…` endpoint (the old external mapping JSON was removed upstream). Only `single()` works — NekoBT doesn't expose batch/movie. Shows without a TVDB/TMDB id, or unknown to NekoBT, return no results instead of an error. |
| **SeaDex** | None | Curation layer at [releases.moe](https://releases.moe). Returns community-picked **best** / **alt** releases by AniList id — exposes hashes only, Hayase finds peers via DHT. |

All six extensions are bundled from this repo. Nothing depends on `exten.pages.dev` at runtime — if that site goes down or breaks, ours keep working.

AnimeTosho (NZB and torrent) and acg.rip were removed: AnimeTosho stopped indexing new releases in May 2026 and is shutting down its feed; acg.rip rate-limits and then refuses connections after short bursts. If you had them installed, remove them under **Settings → Extensions**.

## Issues

If something breaks, open an issue: https://github.com/sinnafuls/hayase-ext/issues

A useful issue includes:
- Which extension is misbehaving
- The release name you tried to play (the `[Group] Show - 01 [...]` string)
- Anything in DevTools Network tab filtered by the extension's domain (`api.nzbgeek.info`, `api.althub.co.za`, or `nyaa.si`)

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
