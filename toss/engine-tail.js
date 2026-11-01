
/* ---------- public API ---------- */
const ART_API = LIVE_API.replace(/chart-doodle$/, "chart-doodle-art");
export const engine = {
  T: () => T[LANG],
  async load(base = "") {
    const [data, chars] = await Promise.all([
      fetch(base + "data.json").then((r) => r.json()),
      fetch(base + "characters.json").then((r) => r.json()),
    ]);
    ITEMS = data.items; for (const it of ITEMS) BYID[it.id] = it;
    ARCH = chars.archetypes; chars.generic.forEach(addGeneric);
    return { items: ITEMS, asof: data.asof };
  },
  attach(canvas, h) { cv = canvas; ctx = cv.getContext("2d"); Object.assign(hooks, h); },
  items: () => ITEMS,
  popular: () => POPULAR.map((id) => BYID[id]).filter(Boolean),
  byId: (id) => BYID[id],
  directItem(q) {
    const s = q.trim().toUpperCase();
    if (/^\d{6}$/.test(s)) return { id: "kr-" + s, sym: s, ko: s, en: s, cat: "kr", cur: "KRW", d: null, direct: true };
    if (/^[A-Z]{1,5}$/.test(s)) return { id: "us-" + s, sym: s, ko: s, en: s, cat: "us", cur: "USD", d: null, direct: true };
    return null;
  },
  async select(it) {
    if (!it.d) {
      const ok = await ensureTf(it, "d");
      if (!ok) return false;
      it.d = it.tf.d;
      if (!BYID[it.id]) { ITEMS.push(it); BYID[it.id] = it; }
    }
    cur = it; reroll = 0; forced = null; tf = "d"; hooks.onTf(tf);
    await show(true);
    return true;
  },
  async setTf(f) { if (f === tf) return; tf = f; reroll = 0; await show(true); },
  redo() {
    if (forced) { const i = lastRank.indexOf(forced); forced = null; reroll = i + 1; } else reroll++;
    if (lastRank[reroll % lastRank.length] === lastPick) reroll++;
    draw(true);
  },
  setForced(id) { forced = id || null; if (!forced) reroll = 0; draw(true); },
  redraw() { if (cur) draw(false); },
  characters() { return [...CHAR_IDS].map((id) => ({ id, name: charName(id) })).sort((a, b) => a.name.localeCompare(b.name, "ko")); },
  header() {
    const d = rowsFor(cur, "d"), last = d[d.length - 1], prev = d[d.length - 2], tr = rowsFor(cur, tf);
    return { name: cur.ko, sub: `${cur.sym} · ${T.ko.cat[cur.cat]} · ${cur.en}`, price: fmtP(last[4], cur.cur), change: (last[4] / prev[4] - 1) * 100, asof: T.ko.asof(T.ko.tfs[tf], fmtDate(tr[tr.length - 1][0]), isLive(cur, tf)) };
  },
  snapshot() {
    // chart canvas plus a title band, for saving as an image
    const dpr = layout.dpr, pad = 20 * dpr, headH = 64 * dpr, footH = 36 * dpr;
    const out = document.createElement("canvas"); out.width = cv.width + pad * 2; out.height = cv.height + headH + footH;
    const c = out.getContext("2d");
    c.fillStyle = "#FFFFFF"; c.fillRect(0, 0, out.width, out.height);
    c.fillStyle = "#191F28"; c.font = `700 ${20 * dpr}px system-ui, sans-serif`; c.textBaseline = "top";
    c.fillText(`${cur.ko}  ${cur.sym}`, pad, pad);
    c.fillStyle = result.dir > 0 ? "#F04452" : result.dir < 0 ? "#3182F6" : "#191F28"; c.font = `700 ${18 * dpr}px Gaegu, cursive`;
    const vt = result.dir > 0 ? T.ko.up : result.dir < 0 ? T.ko.down : T.ko.flat;
    c.fillText(`${vt}  ${charName(result.pick)} · ${T.ko.target} ${fmtP(result.tp, cur.cur)}`, pad, pad + 28 * dpr);
    c.drawImage(cv, pad, headH);
    c.fillStyle = "#8B95A1"; c.font = `500 ${11 * dpr}px system-ui, sans-serif`;
    c.fillText(`${T.ko.title} · ${T.ko.disc1}`, pad, headH + cv.height + 10 * dpr);
    return out.toDataURL("image/png");
  },
  get cur() { return cur; }, get tf() { return tf; }, TFS,
};
