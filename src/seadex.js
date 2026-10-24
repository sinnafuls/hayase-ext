// Vendored from https://exten.pages.dev/seadex.js v0.0.8 (Oct 2026), which moves
// the API from releases.moe (now a 301) to seadex.moe.
//
// Deliberate deviations:
//  - `link` is omitted (undefined) instead of being set to the raw infoHash.
//    Hayase's dedupe in extensions.ts merges results by hash with
//    `dupe.link ??= entry.link` — when SeaDex returns first with
//    link=infoHash, it locks the merged result to a hash-only link and Nyaa's
//    real .torrent URL never wins, causing the "Loading torrent metadata"
//    hang on the green-tick best releases.
//  - `batch`/`movie` reuse single() instead of returning [] (upstream v0.0.8
//    drops them). SeaDex entries are per-release, so the same lookup answers
//    both; the type field still marks best/alt.
export default new class SeaDex {
  url=atob("aHR0cHM6Ly9zZWFkZXgubW9lL2FwaS9jb2xsZWN0aW9ucy9lbnRyaWVzL3JlY29yZHM=");
  async single({anilistId: anilistId, titles: titles, episodeCount: episodeCount}) {
    if (!navigator.onLine) return [];
    if (!anilistId) throw new Error("No anilistId provided");
    if (!titles?.length) throw new Error("No titles provided");
    const res = await fetch(`${this.url}?page=1&perPage=1&filter=alID%3D%22${anilistId}%22&skipTotal=1&expand=trs`), {items: items} = await res.json();
    if (!items[0]?.expand?.trs?.length) return [];
    const {trs: trs} = items[0].expand;
    return trs.filter(({infoHash: infoHash, files: files}) => "<redacted>" !== infoHash && (!episodeCount || 1 === episodeCount || 1 !== files.length)).map(torrent => ({
      hash: torrent.infoHash,
      link: void 0,
      title: 1 === torrent.files.length ? torrent.files[0].name : `[${torrent.releaseGroup}] ${titles[0]} ${torrent.dualAudio ? "Dual Audio" : ""}`,
      size: torrent.files.reduce((prev, curr) => prev + curr.length, 0),
      type: torrent.isBest ? "best" : "alt",
      date: new Date(torrent.created),
      seeders: 0,
      leechers: 0,
      downloads: 0,
      accuracy: "high"
    }));
  }
  batch=this.single;
  movie=this.single;
  async test() {
    try {
      if (!(await fetch(this.url)).ok) throw new Error(`Failed to load data from ${this.url}! Is the site down?`);
      return !0;
    } catch (error) {
      throw new Error(`Could not reach ${this.url}! Does the site work in your region?`);
    }
  }
};
