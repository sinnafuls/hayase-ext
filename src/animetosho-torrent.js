// Vendored from https://exten.pages.dev/animetosho.js with one deliberate
// deviation: useTorrent defaults to TRUE (upstream defaults to false).
// Reason: returning a .torrent URL hands Hayase the file metadata directly,
// so it doesn't have to discover peers via DHT just to learn file names/sizes
// before the NZB pipeline can match. With magnet (upstream default), a
// dead-torrent (0 peers) play hangs at "Loading torrent metadata" and the
// NZB extensions never even get called. See AnimeTosho-torrent README row.
//
// This is the TORRENT variant (anidbEid/anidbAid lookups returning magnet/.torrent).
// For the NZB variant (infoHash lookups), see src/animetosho.ts.
const QUALITIES = [ "1080", "720", "540", "480" ];

export default new class Tosho {
  url=atob("aHR0cHM6Ly9mZWVkLmFuaW1ldG9zaG8ub3JnL2pzb24=");
  _buildQuery({resolution: resolution, exclusions: exclusions}) {
    if (!exclusions?.length && !resolution) return "";
    const base = `&qx=1&q=!("${exclusions.join('"|"')}")`;
    if (!resolution) return base;
    return base + `!(*${QUALITIES.filter(q => q !== resolution).join("*|*")}*)`;
  }
  map(entries, batch = !1, useTorrent = !0) {
    return entries.map(entry => ({
      title: entry.title || entry.torrent_name,
      link: useTorrent ? entry.torrent_url : entry.magnet_uri,
      seeders: (entry.seeders || 0) >= 3e4 ? 0 : entry.seeders || 0,
      leechers: (entry.leechers || 0) >= 3e4 ? 0 : entry.leechers || 0,
      downloads: entry.torrent_downloaded_count || 0,
      hash: entry.info_hash,
      size: entry.total_size,
      accuracy: entry.anidb_fid && !batch ? "high" : "medium",
      type: batch ? "batch" : void 0,
      date: new Date(1e3 * entry.timestamp)
    }));
  }
  async single({anidbEid: anidbEid, resolution: resolution, exclusions: exclusions}, options) {
    if (!navigator.onLine) return [];
    if (!anidbEid) throw new Error("No anidbEid provided");
    const query = this._buildQuery({
      resolution: resolution,
      exclusions: exclusions
    }), res = await fetch(this.url + "?eid=" + anidbEid + query), data = await res.json();
    return data.length ? this.map(data, !1, (options?.useTorrent ?? !0)) : [];
  }
  async batch({anidbAid: anidbAid, resolution: resolution, exclusions: exclusions, episode: episode}, options) {
    if (!navigator.onLine) return [];
    if (!anidbAid) throw new Error("No anidbAid provided");
    const query = this._buildQuery({
      resolution: resolution,
      exclusions: exclusions
    }), res = await fetch(this.url + "?order=size-d&aid=" + anidbAid + query), data = (await res.json()).filter(entry => entry.num_files >= Math.min(24, Math.max(2, episode ?? 1)));
    return data.length ? this.map(data, !0, (options?.useTorrent ?? !0)) : [];
  }
  async movie({anidbAid: anidbAid, resolution: resolution, exclusions: exclusions}, options) {
    if (!navigator.onLine) return [];
    if (!anidbAid) throw new Error("No anidbAid provided");
    const query = this._buildQuery({
      resolution: resolution,
      exclusions: exclusions
    }), res = await fetch(this.url + "?aid=" + anidbAid + query), data = await res.json();
    return data.length ? this.map(data, !1, (options?.useTorrent ?? !0)) : [];
  }
  async test() {
    try {
      if (!(await fetch(this.url)).ok) throw new Error(`Failed to load data from ${this.url}! Is the site down?`);
      return !0;
    } catch (error) {
      throw new Error(`Could not reach ${this.url}! Does the site work in your region?`);
    }
  }
};
