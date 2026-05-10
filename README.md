# hayase-ext

A small set of [Hayase](https://hayase.watch) extensions for anime — two NZB indexers and one torrent indexer. Self-hosted from this repo.

## Install in Hayase

1. **Settings → Extensions → Repositories**
2. Paste:
   ```
   https://raw.githubusercontent.com/sinnafuls/hayase-ext/main/index.json
   ```
3. Click **Import Extensions**

All three extensions show up. Open the cog (⚙) on each to configure if it needs a key.

## What's in here

| Extension | Type | Needs config? | Notes |
| --- | --- | --- | --- |
| **NZBGeek** | NZB | API key | Newznab indexer. Strong on BD remuxes (Moozzi2, KAF). Get a key at [nzbgeek.info → Account → API Settings](https://nzbgeek.info). |
| **AltHub** | NZB | API key | Newznab indexer with better fansub coverage (Erai-raws, Almighty, Ember). Get a key at [althub.co.za → Profile → API](https://althub.co.za). |
| **Nyaa** | Torrent | None | Direct Nyaa.si RSS — anime torrents with infoHash extraction. |

NZB extensions also need a **Usenet provider** configured in Hayase (Settings → NZB Client). Without it, Hayase finds NZBs but has nowhere to download from.

## Issues

If something breaks, open an issue: https://github.com/sinnafuls/hayase-ext/issues

A useful issue includes:
- Which extension is misbehaving
- The release name you tried to play (the `[Group] Show - 01 [...]` string)
- Anything in DevTools Network tab filtered by the extension's domain (`api.nzbgeek.info`, `api.althub.co.za`, or `nyaa.si`)

## Development

```bash
npm install
npm run build       # bundles src/ → index.js, althub.js, nyaa.js
npm run watch       # rebuild on save
npm run typecheck   # tsc --noEmit
```

Pushes that touch `src/` trigger `.github/workflows/build.yml`, which rebuilds the bundles and commits them back. To roll out a change, also bump the relevant entry's `version` in `index.json` — Hayase only re-fetches when the version increases.

## Reference

- [Hayase wiki — Creating Extensions](https://github.com/hayase-app/wiki/blob/master/extensions/development/creating-extensions.md)
- [Hayase wiki — NZB Extensions](https://github.com/hayase-app/wiki/blob/master/extensions/nzb-extensions.md)
- [Newznab API spec](https://github.com/Prowlarr/Prowlarr/wiki/Newznab-API)
