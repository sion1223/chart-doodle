// Supabase Edge Function: live daily candles for Chart Doodle Oracle.
// GET /functions/v1/chart-doodle?id=kr-005930   (kr-<6 digits> | kr-KOSPI | kr-KOSDAQ | us-<TICKER> | us-SPX | us-IXIC | us-DJI)
// Returns { id, name?, live: true, d: [[yyyymmdd, open, high, low, close], ...] } with CORS enabled.
// Deploy:  supabase functions deploy chart-doodle --no-verify-jwt

const DAYS = 260;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
// Naver uses ".O" for Nasdaq listings and bare tickers for NYSE.
const NASDAQ = new Set(["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "GOOGL", "META", "NFLX", "AMD", "INTC", "PLTR", "COIN", "MSTR", "AVGO", "QQQ", "SOFI", "RIVN"]);
const US_INDEX: Record<string, string> = { SPX: ".INX", IXIC: ".IXIC", DJI: ".DJI" };

const cache = new Map<string, { at: number; body: string }>();
const TTL_MS = 60_000;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", ...extra },
  });
}

async function naverKr(sym: string) {
  const r = await fetch(`https://fchart.stock.naver.com/sise.nhn?symbol=${sym}&timeframe=day&count=${DAYS}&requestType=0`);
  if (!r.ok) throw new Error(`naver ${r.status}`);
  const text = new TextDecoder("euc-kr").decode(await r.arrayBuffer());
  const name = text.match(/name="([^"]*)"/)?.[1] ?? "";
  const out: number[][] = [];
  for (const m of text.matchAll(/data="([^"]+)"/g)) {
    const [d, o, h, l, c] = m[1].split("|");
    const close = +c;
    out.push([+d, +o || close, +h, +l, close]);
  }
  return { d: out, name };
}

async function naverUs(code: string, index: boolean) {
  const end = new Date();
  const start = new Date(end.getTime() - DAYS * 1.5 * 86_400_000);
  const ymd = (t: Date) => t.toISOString().slice(0, 10).replaceAll("-", "");
  const kind = index ? "index" : "item";
  const r = await fetch(`https://api.stock.naver.com/chart/foreign/${kind}/${code}/day?startDateTime=${ymd(start)}0000&endDateTime=${ymd(end)}2359`);
  if (!r.ok) throw new Error(`naver ${r.status}`);
  const js = await r.json() as Array<Record<string, number | string>>;
  return { d: js.slice(-DAYS).map((x) => [+x.localDate, +x.openPrice, +x.highPrice, +x.lowPrice, +x.closePrice]), name: "" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const id = new URL(req.url).searchParams.get("id") ?? "";

  let job: (() => Promise<{ d: number[][]; name: string }>) | null = null;
  let m: RegExpMatchArray | null;
  if ((m = id.match(/^kr-(\d{6}|KOSPI|KOSDAQ)$/))) {
    const sym = m[1];
    job = () => naverKr(sym);
  } else if ((m = id.match(/^us-([A-Z]{1,6})$/))) {
    const t = m[1];
    job = US_INDEX[t]
      ? () => naverUs(US_INDEX[t], true)
      : async () => {
        // Unknown tickers: try NYSE-style first, then Nasdaq.
        const first = await naverUs(NASDAQ.has(t) ? `${t}.O` : t, false);
        return first.d.length >= 30 || NASDAQ.has(t) ? first : naverUs(`${t}.O`, false);
      };
  }
  if (!job) return json({ error: "Unknown id. Use kr-005930, kr-KOSPI, us-AAPL or us-SPX." }, 400);

  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return json(hit.body, 200, { "Cache-Control": "public, max-age=60" });

  try {
    const { d, name } = await job();
    if (d.length < 30) return json({ error: "No data for this symbol." }, 404);
    const body = JSON.stringify({ id, name, live: true, d });
    cache.set(id, { at: Date.now(), body });
    return json(body, 200, { "Cache-Control": "public, max-age=60" });
  } catch (e) {
    return json({ error: `Upstream failed: ${(e as Error).message}` }, 502);
  }
});
