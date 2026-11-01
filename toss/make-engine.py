"""Regenerate toss/src/engine.js from the web page (../index.html).

Run from the repo root:  python toss/make-engine.py
"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / "index.html").read_text(encoding="utf-8")
js = html[html.index("<script>") + 8: html.rindex("</script>")]

def seg(a, b):
    i = js.index(a); j = js.index(b, i)
    return js[i:j]

parts = [seg("const T = {", "/* ---------- state ---------- */")]
u = seg("function hash(s)", "function toast(msg)")
parts.append(re.sub(r"function name\(it\).*\n", "", u))
c = seg("const charName", "/* ---------- search ---------- */")
c = re.sub(r"function buildCharButtons\(\) \{.*?\n\}\n", "", c, flags=re.S)
parts.append(re.sub(r'\$\("charsel"\)\.onchange.*\n', "", c))
d = seg("function weekKey(d)", "/* ---------- geometry ---------- */")
parts.append(re.sub(r"function header\(\) \{.*?\n\}\n", "", d, flags=re.S))
parts.append(seg("/* ---------- geometry ---------- */", "function verdictPanel() {"))
body = "\n".join(parts)

for a, b in [
    ('cv.classList.add("dim"); setStat(T[LANG].busy, true);', "hooks.onBusy(true);"),
    ('cv.classList.remove("dim"); setStat("");', "hooks.onBusy(false);"),
    ('toast(T[LANG].tooFew); tf = "d"; applyLang(false);', 'hooks.toast(T[LANG].tooFew); tf = "d"; hooks.onTf(tf);'),
    ('function setStat(text, busy = false) { const el = $("aistat"); el.textContent = text; el.classList.toggle("busy", busy); }',
     "function setStat(text, busy = false) { hooks.onStatus(text, busy); }"),
    ('const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;',
     "const isDark = () => false;"),
    ("  const w = cv.parentElement.clientWidth - 12;\n  const h = Math.round(w < 560 ? w * 1.0 : clamp(w * 0.56, 340, 560));",
     "  const w = cv.parentElement.clientWidth;\n  const h = Math.round(w < 560 ? w * 0.95 : clamp(w * 0.56, 340, 560));"),
]:
    assert body.count(a) == 1, (body.count(a), a[:60])
    body = body.replace(a, b)

head = (root / "toss" / "engine-head.js").read_text(encoding="utf-8")
tail = (root / "toss" / "engine-tail.js").read_text(encoding="utf-8")
(root / "toss" / "src" / "engine.js").write_text(head + body + tail, encoding="utf-8")
print("wrote toss/src/engine.js")
