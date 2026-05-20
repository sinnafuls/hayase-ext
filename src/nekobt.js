// Vendored from https://exten.pages.dev/nekobt.js (rewritten upstream Nov 2024).
//
// What changed vs. our previous vendor:
//  - The external `nbt-mapping.json` on ThaUnknown/anime-lists-ts was deleted
//    upstream. The old extension fetched it at module load and crashed with a
//    JSON-parse error on the resulting 404 page, breaking the whole extension.
//  - Replaced by a server-side mapping: NekoBT's own /torrents/search endpoint
//    now resolves tvdbid/tmdbid → media in one call. No external JSON needed.
//  - batch() and movie() are no-ops upstream — NekoBT's index is per-episode.
//  - imdbId routing dropped (upstream removed it).
//
// Kept verbatim from upstream so future refreshes are a clean copy-paste.
export default new class NekoBT {
  url=atob("aHR0cHM6Ly9uZWtvYnQudG8vYXBpL3YxLw==");
  async _fetch(fetch, search) {
    const res = await fetch(`${this.url}torrents/search?${search}`), json = await res.json();
    if (json.error) throw new Error("NekoBT: " + json.message);
    if (!json.data) throw new Error("NekoBT: Invalid response from server!");
    return json.data;
  }
  async single({tvdbId: tvdbId, tvdbEId: tvdbEId, tmdbId: tmdbId, episode: episode, fetch: fetch}, options) {
    if (!navigator.onLine) return [];
    const mediaParams = new URLSearchParams({
      limit: "1"
    });
    tvdbId && mediaParams.append("tvdbid", tvdbId.toString()), tmdbId && mediaParams.append("tmdbid", tmdbId);
    const mappings = await this._fetch(fetch, mediaParams);
    if (!mappings?.media) throw new Error("NekoBT: No media found for the given anime!");
    const ep = mappings.media.episodes?.find(ep => ep.tvdbId === tvdbEId) ?? mappings.media.episodes?.find(ep => ep.episode === episode), searchParams = new URLSearchParams({
      media_id: mappings.media.id,
      fansub_lang: "en,enm",
      sub_lang: "en,enm"
    });
    ep?.id && searchParams.append("episode_ids", ep.id.toString());
    const high = ep?.tvdbId === tvdbEId;
    return (await this._fetch(fetch, searchParams)).results?.map(entry => ({
      title: entry.title,
      link: `${this.url}torrents/${entry.id}/download?public=true`,
      seeders: Number(entry.seeders),
      leechers: Number(entry.leechers),
      downloads: Number(entry.completed),
      hash: entry.infohash,
      size: Number(entry.filesize),
      accuracy: high ? "high" : "medium",
      type: (entry.level ?? 0) >= 3 ? "alt" : entry.batch ? "batch" : void 0,
      date: new Date(entry.uploaded_at)
    })) ?? [];
  }
  batch=() => [];
  movie=() => [];
  async test() {
    try {
      const {ok: ok} = await fetch(this.url + "announcements");
      if (!ok) throw new Error(`Failed to load data from ${this.url}! Is the site down?`);
      return !0;
    } catch (error) {
      throw new Error(`Could not reach ${this.url}! Does the site work in your region?`);
    }
  }
};
