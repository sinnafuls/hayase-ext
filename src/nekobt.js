// Vendored verbatim from https://exten.pages.dev/nekobt.js
// Source: ThaUnknown's exten.pages.dev — kept as-is for upstream parity.
const mappings = fetch(atob("aHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL1RoYVVua25vd24vYW5pbWUtbGlzdHMtdHMvcmVmcy9oZWFkcy9tYWluL2RhdGEvbmJ0LW1hcHBpbmcuanNvbg==")).then(res => res.json()), m = BigInt("1735689600000");

function idToInfo(id) {
  let r = BigInt(id);
  const i = (r >> 8n) + m, n = r >> 4n & BigInt(15), o = r & BigInt(15);
  return {
    time: Number(i),
    type: Number(n),
    increment: Number(o)
  };
}

export default new class NekoBT {
  url=atob("aHR0cHM6Ly9uZWtvYnQudG8vYXBpL3YxLw==");
  async _media({tvdbId: tvdbId, tmdbId: tmdbId, imdbId: imdbId, fetch: fetch}) {
    const map = await mappings, nekoID = map.tvdb[tvdbId] ?? map.tmdb[tmdbId] ?? map.imdb[imdbId];
    if (!nekoID) throw new Error("No NekoBT mapping found for provided anime.");
    const res = await fetch(this.url + `media/${nekoID}`), json = await res.json();
    if (json.error) throw new Error("NekoBT: " + json.message);
    return {
      nekoID: nekoID,
      data: json.data
    };
  }
  _map(entries, batch = !1, high = !0) {
    return entries?.data?.results?.map(entry => ({
      title: entry.title,
      link: `${this.url}torrents/${entry.id}/download?public=true`,
      seeders: Number(entry.seeders),
      leechers: Number(entry.leechers),
      downloads: Number(entry.completed),
      hash: entry.infohash,
      size: Number(entry.filesize),
      accuracy: high ? "high" : "medium",
      type: (entry.level ?? 0) >= 3 ? "alt" : void 0,
      date: new Date(idToInfo(entry.id).time)
    })) ?? [];
  }
  async single({tvdbId: tvdbId, tvdbEId: tvdbEId, tmdbId: tmdbId, imdbId: imdbId, episode: episode, fetch: fetch}, options) {
    if (!navigator.onLine) return [];
    const {data: data, nekoID: nekoID} = await this._media({
      tvdbId: tvdbId,
      tmdbId: tmdbId,
      imdbId: imdbId,
      fetch: fetch
    }), ep = data?.episodes?.find(ep => ep.tvdbId === tvdbEId) ?? data?.episodes?.find(ep => ep.episode === episode);
    let searchURL = `${this.url}torrents/search?media_id=${nekoID}&fansub_lang=en%2Cenm&sub_lang=en%2Cenm`;
    ep?.id && (searchURL += `&episode_ids=${ep.id}`);
    const res = await fetch(searchURL), json = await res.json();
    if (json.error) throw new Error("NekoBT: " + json.message);
    return this._map(json, !!tvdbEId);
  }
  batch=this.single;
  movie=this.single;
  async test() {
    try {
      if (!(await fetch(this.url + "announcements")).ok) throw new Error(`Failed to load data from ${this.url}! Is the site down?`);
      return !0;
    } catch (error) {
      throw new Error(`Could not reach ${this.url}! Does the site work in your region?`);
    }
  }
};
