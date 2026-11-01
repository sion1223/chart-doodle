// Chart drawing engine for the Apps in Toss build.
// Generated from ../index.html (the web version) by toss/make-engine.py — edit the web version, then regenerate.
/* eslint-disable */
let LANG = "ko";
let cv = null, ctx = null;
let ITEMS = [], BYID = {};
let cur = null, tf = "d", reroll = 0, forced = null;
let AI_ON = true;
const TFS = ["d", "w", "m", "h", "y"];
const TF_BASE = { d: "d", w: "w", m: "m", h: "m", y: "m" };
const TF_SHOW = { d: 120, w: 104, m: 120, h: 60, y: 60 };
const ai = { key: null, img: null, layer: null, dark: null, state: "", sim: 0 };
let animating = false, currentFrame = null;
let lastPick = null, lastRank = [], animId = 0;
// Toss light palette (TDS grey/red/blue) for canvas drawing
const COLORS = {
  "--panel": "#FFFFFF", "--fg": "#191F28", "--muted": "#8B95A1", "--line": "#F2F4F6", "--future": "rgba(49,130,246,0.06)",
  "--ink": "#6A2BE8", "--hl": "rgba(255,222,64,.55)", "--up-ko": "#F04452", "--down-ko": "#3182F6", "--up-en": "#F04452", "--down-en": "#3182F6",
  "--font-doodle": "Gaegu, 'Comic Sans MS', cursive", "--font-num": "'Toss Product Sans', ui-monospace, monospace", "--font-ui": "'Toss Product Sans', system-ui, sans-serif",
};
const css = (v) => COLORS[v] ?? "";
const hooks = { onResult() {}, onStatus() {}, onBusy() {}, onTf() {}, onHeader() {}, onPick() {}, toast() {} };
function header() { hooks.onHeader(cur); }
function verdictPanel() { hooks.onResult({ ...result, name: charName(result.pick), target: fmtP(result.tp, cur.cur), reasonText: reasonText(result, fmtP(result.tp, cur.cur)) }); }
function buildCharButtons() { hooks.onPick(lastPick, forced); }
