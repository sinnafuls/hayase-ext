export default new class ToshoNZB {
  url=atob("aHR0cHM6Ly9mZWVkLmFuaW1ldG9zaG8ub3JnL2pzb24=");
  async batch({hash: hash}) {
    if (!navigator.onLine) return;
    const res = await fetch(this.url + "?show=torrent&btih=" + hash);
    if (!res.ok) return;
    return (await res.json()).nzb_url;
  }
  async single() {}
  async test() {
    try {
      if (!(await fetch(this.url)).ok) throw new Error(`Failed to load data from ${this.url}! Is the site down?`);
      return !0;
    } catch (error) {
      throw new Error(`Could not reach ${this.url}! Does the site work in your region?`);
    }
  }
};
