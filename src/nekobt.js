// Vendored from https://exten.pages.dev/nekobt.js v0.1.2 (Oct 2026).
//
// Upstream history: the external `nbt-mapping.json` on ThaUnknown/anime-lists-ts
// was deleted, so NekoBT's own /torrents/search endpoint resolves
// tvdb/tmdb/anilist ids → media in one call. v0.1.2 adds the AniList fallback
// (media_id=anilist-<id>) for shows whose TVDB mapping is missing, implements
// movie(), and filters by resolution/exclusions.
//
// Deliberate deviations (both keep a missing mapping from breaking the search):
//  - No media / no usable id returns [] instead of throwing "No media found",
//    which Hayase renders as an error banner on every play.
//  - With no tvdbId, tmdbId or anilistId at all, no request is made — an
//    id-less search matches an arbitrary media entry.
const QUALITIES = [ "1080", "720", "540", "480" ];

export default new class NekoBT {
  url=atob("aHR0cHM6Ly9uZWtvYnQudG8vYXBpL3YxLw==");
  async _fetch(fetch, search) {
    const res = await fetch(`${this.url}torrents/search?${search}`), json = await res.json();
    if (json.error) throw new Error("NekoBT: " + json.message);
    if (!json.data) throw new Error("NekoBT: Invalid response from server!");
    return json.data;
  }
  async _media({tvdbId: tvdbId, tvdbEId: tvdbEId, tmdbId: tmdbId, fetch: fetch, anilistId: anilistId}) {
    const hasAnilist = anilistId !== undefined && anilistId !== null && anilistId !== "";
    const mediaParams = new URLSearchParams({
      limit: "1"
    });
    tvdbId && mediaParams.append("tvdbid", tvdbId.toString()), tmdbId && mediaParams.append("tmdbid", tmdbId),
    !tmdbId && !tvdbEId && hasAnilist && mediaParams.append("media_id", "anilist-" + anilistId);
    let mappings = await this._fetch(fetch, mediaParams);
    if (!mappings?.media && (tmdbId || tvdbEId) && hasAnilist) {
      mappings = await this._fetch(fetch, new URLSearchParams({
        limit: "1",
        media_id: "anilist-" + anilistId
      }));
    }
    return mappings?.media;
  }
  _map(entry, high) {
    return {
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
    };
  }
  _excluded(title, exclusions, resolution) {
    const lower = title.toLowerCase();
    const all = (exclusions ?? []).map(e => e.toLowerCase()).filter(Boolean);
    if (resolution) all.push(...QUALITIES.filter(q => q !== resolution).map(q => `${q}p`));
    return all.some(e => lower.includes(e));
  }
  async single({tvdbId: tvdbId, tvdbEId: tvdbEId, tmdbId: tmdbId, episode: episode, fetch: fetch, resolution: resolution, exclusions: exclusions, anilistId: anilistId}) {
    if (!navigator.onLine) return [];
    if (!tvdbId && !tmdbId && (anilistId === undefined || anilistId === null)) return [];
    const media = await this._media({
      tvdbId: tvdbId,
      tvdbEId: tvdbEId,
      tmdbId: tmdbId,
      fetch: fetch,
      anilistId: anilistId
    });
    if (!media) return [];
    const ep = media.episodes?.find(ep => ep.tvdbId === tvdbEId) ?? media.episodes?.find(ep => ep.episode === episode);
    if (!ep?.id) return [];
    const searchParams = new URLSearchParams({
      media_id: media.id,
      fansub_lang: "en,enm",
      sub_lang: "en,enm",
      episode_ids: ep.id.toString()
    }), high = ep?.tvdbId === tvdbEId;
    return (await this._fetch(fetch, searchParams)).results?.filter(({title: title}) => !this._excluded(title, exclusions, resolution)).map(entry => this._map(entry, high)) ?? [];
  }
  async movie({tvdbId: tvdbId, tvdbEId: tvdbEId, tmdbId: tmdbId, episode: episode, fetch: fetch, resolution: resolution, exclusions: exclusions, anilistId: anilistId}) {
    if (!navigator.onLine) return [];
    if (!tvdbId && !tmdbId && (anilistId === undefined || anilistId === null)) return [];
    const media = await this._media({
      tvdbId: tvdbId,
      tvdbEId: tvdbEId,
      tmdbId: tmdbId,
      fetch: fetch,
      anilistId: anilistId
    });
    if (!media) return [];
    if (media.episodes?.find(ep => ep.tvdbId === tvdbEId) ?? media.episodes?.find(ep => ep.episode === episode)) return [];
    const searchParams = new URLSearchParams({
      media_id: media.id,
      fansub_lang: "en,enm",
      sub_lang: "en,enm"
    });
    return (await this._fetch(fetch, searchParams)).results?.filter(({title: title}) => !this._excluded(title, exclusions, resolution)).map(entry => this._map(entry, false)) ?? [];
  }
  batch=() => [];
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
