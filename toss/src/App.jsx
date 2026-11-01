import { useEffect, useMemo, useRef, useState } from "react";
import {
  Top, SearchField, Tab, List, ListRow, Badge, Button, CTAButton, FixedBottomCTA, BottomSheet, Loader, useToast,
} from "@toss/tds-mobile";
import { saveBase64Data, generateHapticFeedback } from "@apps-in-toss/web-framework";
import { engine } from "./engine.js";

const CATS = [["all", "전체"], ["kr", "국내"], ["us", "미국"], ["coin", "코인"]];
const TF_LABEL = { d: "일봉", w: "주봉", m: "월봉", h: "6개월", y: "1년" };
const CAT_LABEL = { kr: "국내", us: "미국", coin: "코인" };
const norm = (s) => s.toLowerCase().replace(/[\s().\-/&]/g, "");

function search(items, q, cat) {
  const n = norm(q);
  let list = items.filter((it) => cat === "all" || it.cat === cat);
  if (n) {
    list = list
      .map((it) => {
        let s = -1;
        for (const k of [it.ko, it.en, it.sym, it.sym.replace("/USDT", "")].map(norm)) {
          if (k === n) s = Math.max(s, 3); else if (k.startsWith(n)) s = Math.max(s, 2); else if (k.includes(n)) s = Math.max(s, 1);
        }
        return [s, it];
      })
      .filter((x) => x[0] >= 0).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  }
  return list.slice(0, 40);
}

export default function App() {
  const toast = useToast();
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [cat, setCat] = useState("all");
  const [head, setHead] = useState(null);
  const [tf, setTf] = useState("d");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState({ text: "", busy: false });
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState({ id: null, forced: null });
  const [sheet, setSheet] = useState(false);

  useEffect(() => {
    engine.attach(canvasRef.current, {
      onResult: (r) => { setResult(r); setHead(engine.header()); },
      onStatus: (text, b) => setStatus({ text, busy: b }),
      onBusy: setBusy,
      onTf: setTf,
      onHeader: () => setHead(engine.header()),
      onPick: (id, forced) => setPick({ id, forced }),
      toast: (m) => toast.openToast(m),
    });
    engine.load("./").then(({ items }) => {
      setItems(items);
      setReady(true);
      engine.select(engine.byId("kr-005930") || items[0]);
    }).catch(() => setFailed(true));
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(() => engine.redraw(), 150); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const results = useMemo(() => (searching ? search(items, query, cat) : []), [items, query, cat, searching]);
  const direct = searching && cat !== "coin" ? engine.directItem(query) : null;
  const showDirect = direct && !items.some((it) => it.id === direct.id);
  const characters = useMemo(() => (ready ? engine.characters() : []), [ready]);

  async function choose(it) {
    setSearching(false); setQuery("");
    const ok = await engine.select(it);
    if (!ok) toast.openToast("그 코드로는 차트를 찾지 못했어요");
    else setItems([...engine.items()]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveImage() {
    try {
      const data = engine.snapshot().split(",")[1];
      await saveBase64Data({ data, fileName: `chart-doodle-${engine.cur.sym.replace("/", "-")}.png`, mimeType: "image/png" });
      toast.openToast("이미지를 저장했어요");
    } catch (e) {
      toast.openToast("이미지를 저장하지 못했어요. 토스 앱에서 다시 시도해 주세요.");
    }
  }

  function redo() {
    try { generateHapticFeedback({ type: "tickWeak" }); } catch (e) { /* outside Toss */ }
    engine.redo();
  }

  const up = head && head.change >= 0;
  const vColor = result ? (result.dir > 0 ? "#F04452" : result.dir < 0 ? "#3182F6" : "#191F28") : "#191F28";
  const vText = result ? (result.dir > 0 ? "↗ 오른다!!" : result.dir < 0 ? "↘ 내린다!!" : "→ 옆으로 기어간다") : "";

  return (
    <div className="wrap">
      <Top
        title={<Top.TitleParagraph size={22}>차트 낙서 점술관</Top.TitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph>차트에 대충 그림을 그려서 미래를 맞혀요. (안 맞아요)</Top.SubtitleParagraph>}
      />

      <div className="section">
        <SearchField
          placeholder="종목명, 티커, 코인 검색"
          value={query}
          onFocus={() => setSearching(true)}
          onChange={(e) => { setQuery(e.target.value); setSearching(true); }}
          onDeleteClick={() => { setQuery(""); setSearching(false); }}
        />
      </div>

      {searching ? (
        <>
          <Tab size="small" onChange={(i) => setCat(CATS[i][0])}>
            {CATS.map(([k, label]) => <Tab.Item key={k} selected={cat === k}>{label}</Tab.Item>)}
          </Tab>
          <List>
            {showDirect && (
              <ListRow
                onClick={() => choose(direct)}
                contents={<ListRow.Texts type="2RowTypeA" top={`${direct.sym} 차트 직접 불러오기`} bottom="목록에 없는 종목 코드(6자리)나 미국 티커" />}
                arrowType="right"
              />
            )}
            {results.map((it) => (
              <ListRow
                key={it.id}
                onClick={() => choose(it)}
                contents={<ListRow.Texts type="2RowTypeA" top={it.ko} bottom={`${it.en} · ${it.sym}`} />}
                right={<Badge size="small" color={it.cat === "coin" ? "teal" : it.cat === "us" ? "green" : "blue"} variant="weak">{CAT_LABEL[it.cat]}</Badge>}
              />
            ))}
          </List>
          {!results.length && !showDirect && <div className="empty">검색 결과가 없어요. 다른 이름이나 티커로 찾아보세요.</div>}
          <div className="section" style={{ paddingTop: 12 }}>
            <Button size="medium" color="dark" variant="weak" display="block" onClick={() => { setSearching(false); setQuery(""); }}>
              검색 닫기
            </Button>
          </div>
        </>
      ) : (
        <div className="chips">
          {engine.popular && ready && engine.popular().map((it) => (
            <Button key={it.id} size="small" color="dark" variant="weak" onClick={() => choose(it)}>{it.ko}</Button>
          ))}
        </div>
      )}

      <div hidden={searching}>
        {failed && <div className="empty">차트 데이터를 불러오지 못했어요. 잠시 후 다시 열어 주세요.</div>}
        {!ready && !failed && <div className="empty"><Loader size="small" /></div>}
        {head && (
          <ListRow
            border="none"
            contents={<ListRow.Texts type="2RowTypeA" top={head.name} bottom={head.sub} />}
            right={
              <div className="price">
                <div className="p">{head.price}</div>
                <div className="c" style={{ color: up ? "#F04452" : "#3182F6" }}>{`${up ? "+" : ""}${head.change.toFixed(2)}%`}</div>
              </div>
            }
          />
        )}
        {ready && (
          <Tab size="small" onChange={(i) => engine.setTf(engine.TFS[i])}>
            {engine.TFS.map((f) => <Tab.Item key={f} selected={tf === f}>{TF_LABEL[f]}</Tab.Item>)}
          </Tab>
        )}
        <div className="meta"><span>{head ? head.asof : ""}</span><span>{status.busy ? status.text : ""}</span></div>
        <div className={`cv${busy ? " dim" : ""}`}><canvas ref={canvasRef} aria-label="차트와 낙서" /></div>

        {result && (
          <div className="verdict">
            <span className="vbig" style={{ color: vColor }}>{vText}</span>
            <div className="vmeta">
              <Badge size="small" color="blue" variant="weak">{result.name}</Badge>
              <span>목표가 {result.target} ({result.pct >= 0 ? "+" : ""}{result.pct.toFixed(1)}%)</span>
              <span>· 확신도 {result.conf.toLocaleString("en-US")}%</span>
            </div>
            <p className="vreason">{result.reasonText}</p>
          </div>
        )}

        {ready && (
          <List>
            <ListRow
              onClick={() => setSheet(true)}
              contents={<ListRow.Texts type="1RowTypeA" top="캐릭터 직접 고르기" />}
              right={<span style={{ fontSize: 15, color: "#6B7684" }}>{pick.forced ? characters.find((c) => c.id === pick.forced)?.name : "자동"}</span>}
              arrowType="right"
            />
          </List>
        )}

        <div className="disc">
          재미로 보는 낙서예요. 투자 조언이 아니고, 맞아야 할 이유도 전혀 없어요.<br />
          데이터: 국내·미국 주식은 네이버 금융, 코인은 바이낸스(USDT) 일봉 기준이에요.
        </div>
      </div>

      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        header={<BottomSheet.Header>캐릭터 고르기</BottomSheet.Header>}
        expandBottomSheet
        expandBottomSheetWhenScroll
      >
        <BottomSheet.Select
          value={pick.forced || ""}
          options={[{ name: "자동 (차트 모양 보고 골라요)", value: "" }, ...characters.map((c) => ({ name: c.name, value: c.id }))]}
          onChange={(e) => { setSheet(false); engine.setForced(e.target.value); }}
        />
      </BottomSheet>

      {!searching && ready && (
        <FixedBottomCTA.Double
          leftButton={<CTAButton color="dark" variant="weak" onClick={saveImage}>이미지 저장</CTAButton>}
          rightButton={<CTAButton onClick={redo}>다른 그림으로</CTAButton>}
        />
      )}
    </div>
  );
}
