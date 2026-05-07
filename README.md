# hayase-nzb-extensions

A self-hosted Hayase repository that ships an NZBGeek NZB extension built from TypeScript and bundled via esbuild — searches NZBGeek through the Newznab API.

## Layout

```
.
├── index.json                    Hayase manifest (manifestVersion 2)
├── index.js                      Built NZBGeek bundle (auto-built by CI)
├── src/                          TS sources
│   ├── index.ts                  test() / single() / batch() / movie()
│   ├── newznab.ts                Newznab JSON client
│   └── types.ts                  AnimeQuery / NZBQuery / option types
├── build.mjs                     esbuild bundler
├── package.json
├── tsconfig.json
└── .github/workflows/build.yml   CI: bundles src/ → index.js on push
```

## Build (locally, optional)

```bash
npm install
npm run build       # writes index.js
npm run watch       # rebuild on save (dev)
npm run typecheck   # tsc --noEmit
```

You don't have to run this before pushing — CI will. Locally is useful for sanity-checking type errors before the push.

## Deployment (GitHub Actions)

`.github/workflows/build.yml` runs on every push that touches `src/`, `package.json`, or the build config. It:

1. `npm ci`
2. `npm run typecheck`
3. `npm run build`
4. Commits the resulting `index.js` back to the same branch — only if it actually changed

The bot commit doesn't re-trigger the workflow because `index.js` isn't in the `paths:` filter. **Repo settings prerequisite:** *Settings → Actions → General → Workflow permissions → Read and write permissions*.

If your default branch is `master` (not `main`), edit `.github/workflows/build.yml` and update the `branches:` line.

## Configure

1. Push this repo to GitHub. The repo must be **public** for Hayase to fetch via `raw.githubusercontent.com`. For a strictly private setup, host `index.json` and `index.js` yourself (Cloudflare Pages, NAS, etc.) and use those direct URLs.
2. Bump `version` in `index.json` whenever you want Hayase to apply an update — Hayase only fetches when the version increases.

## Install in Hayase

1. Settings → Extensions → Repositories
2. Paste the raw URL of `index.json`: `https://raw.githubusercontent.com/sinnafuls/hayase-ext/main/index.json`
3. Click **Import Extensions**
4. Open the extension's settings → paste your **NZBGeek API key** (Account → API Settings on nzbgeek.info)

## How it works

For each play, Hayase passes the chosen torrent's `infoHash`, release `name`, AniList/AniDB/TVDB/IMDb/TMDB IDs, the title list, and episode number. The extension:

1. **Movies** (`imdbId`/`tmdbId`, no `tvdbId`): `t=movie` Newznab query, scoped to movie cats `2000,2020,2030,2040,2045,2050,2060`.
2. **TV episodes** (with `tvdbId`): `t=tvsearch&tvdbid=…&season=1&ep=…`. Falls back to `absoluteEpisodeNumber` if the first lookup is empty.
3. **Fallback**: `t=search&q="<title> <ep>"` against Anime cat `5070`.
4. **Batch**: `tvsearch` without `ep`, falling back to `q="<title> batch"` / `"<title> complete"`. Results matching `batch|complete|season|s\d+` get scored higher.
5. The best result is picked by a score that strongly favors items whose name contains the original release `name` from the query (this matches the user-selected torrent), then title overlap, then size and episode-tag presence.

The extension returns the Newznab `link` URL — calling it downloads the actual `.nzb`. Hayase handles gzip/decompression automatically.

## Manifest options

| key       | default                       | what it does                                                  |
| --------- | ----------------------------- | ------------------------------------------------------------- |
| `apikey`  | (empty)                       | NZBGeek API key. Required.                                    |
| `baseUrl` | `https://api.nzbgeek.info`    | Override only if NZBGeek changes endpoints.                   |
| `category`| `5070`                        | Comma-separated Newznab category IDs. `5070` = Anime.         |

## Notes

- The extension runs in a sandboxed Web Worker — no DOM, no `localStorage`. All network requests use the `query.fetch` helper Hayase passes in (CORS-aware).
- `accuracy` in the manifest is set to `"medium"`. Bump to `"high"` if you tighten matching to require an exact `name` containment, or `"low"` if you find false positives.
- Errors thrown from `test()` / `single()` / `batch()` are surfaced to the user verbatim — keep them descriptive.

## Reference

- Hayase wiki — Creating Extensions: https://github.com/hayase-app/wiki/blob/master/extensions/development/creating-extensions.md
- Hayase wiki — NZB Extensions: https://github.com/hayase-app/wiki/blob/master/extensions/nzb-extensions.md
- Newznab API spec: https://github.com/Prowlarr/Prowlarr/wiki/Newznab-API
- NZBGeek API: https://api.nzbgeek.info/api?t=caps&o=json
