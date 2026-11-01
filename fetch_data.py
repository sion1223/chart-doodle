"""Snapshot ~1 year of daily OHLC for the chart-doodle page.

Sources: Naver (KR stocks/indices, US stocks/indices), Binance public data API (coins).
Output: data.json  -> {"asof": "...", "items": [{id, sym, ko, en, cat, cur, d:[[yyyymmdd,o,h,l,c],...]}]}
"""
import json, time, urllib.request, re, datetime, sys

DAYS = 260

KR = [
    ("005930", "삼성전자", "Samsung Electronics"), ("000660", "SK하이닉스", "SK hynix"),
    ("373220", "LG에너지솔루션", "LG Energy Solution"), ("207940", "삼성바이오로직스", "Samsung Biologics"),
    ("005380", "현대차", "Hyundai Motor"), ("000270", "기아", "Kia"),
    ("068270", "셀트리온", "Celltrion"), ("035420", "NAVER", "NAVER"),
    ("035720", "카카오", "Kakao"), ("005490", "POSCO홀딩스", "POSCO Holdings"),
    ("051910", "LG화학", "LG Chem"), ("006400", "삼성SDI", "Samsung SDI"),
    ("105560", "KB금융", "KB Financial"), ("055550", "신한지주", "Shinhan Financial"),
    ("012450", "한화에어로스페이스", "Hanwha Aerospace"), ("329180", "HD현대중공업", "HD Hyundai Heavy"),
    ("247540", "에코프로비엠", "EcoPro BM"), ("086520", "에코프로", "EcoPro"),
    ("196170", "알테오젠", "Alteogen"), ("352820", "하이브", "HYBE"),
    ("259960", "크래프톤", "Krafton"), ("036570", "엔씨소프트", "NCSoft"),
    ("034020", "두산에너빌리티", "Doosan Enerbility"), ("028260", "삼성물산", "Samsung C&T"),
    ("042700", "한미반도체", "Hanmi Semiconductor"), ("323410", "카카오뱅크", "KakaoBank"),
    ("003490", "대한항공", "Korean Air"), ("090430", "아모레퍼시픽", "Amorepacific"),
    ("017670", "SK텔레콤", "SK Telecom"), ("066570", "LG전자", "LG Electronics"),
    ("263750", "펄어비스", "Pearl Abyss"), ("277810", "레인보우로보틱스", "Rainbow Robotics"),
    ("028300", "HLB", "HLB"), ("010130", "고려아연", "Korea Zinc"),
]
KR_IDX = [("KOSPI", "코스피", "KOSPI"), ("KOSDAQ", "코스닥", "KOSDAQ")]

US = [
    ("AAPL.O", "AAPL", "애플", "Apple"), ("MSFT.O", "MSFT", "마이크로소프트", "Microsoft"),
    ("NVDA.O", "NVDA", "엔비디아", "NVIDIA"), ("TSLA.O", "TSLA", "테슬라", "Tesla"),
    ("AMZN.O", "AMZN", "아마존", "Amazon"), ("GOOGL.O", "GOOGL", "알파벳(구글)", "Alphabet (Google)"),
    ("META.O", "META", "메타", "Meta"), ("NFLX.O", "NFLX", "넷플릭스", "Netflix"),
    ("AMD.O", "AMD", "AMD", "AMD"), ("INTC.O", "INTC", "인텔", "Intel"),
    ("PLTR.O", "PLTR", "팔란티어", "Palantir"), ("COIN.O", "COIN", "코인베이스", "Coinbase"),
    ("MSTR.O", "MSTR", "스트래티지", "Strategy (MicroStrategy)"), ("AVGO.O", "AVGO", "브로드컴", "Broadcom"),
    ("QQQ.O", "QQQ", "QQQ (나스닥100 ETF)", "QQQ (Nasdaq-100 ETF)"), ("SPY", "SPY", "SPY (S&P500 ETF)", "SPY (S&P 500 ETF)"),
    ("KO", "KO", "코카콜라", "Coca-Cola"), ("JPM", "JPM", "JP모건", "JPMorgan"),
    ("GME", "GME", "게임스톱", "GameStop"), ("DIS", "DIS", "디즈니", "Disney"),
    ("NKE", "NKE", "나이키", "Nike"), ("BA", "BA", "보잉", "Boeing"),
        ("SOFI.O", "SOFI", "소파이", "SoFi"), ("RIVN.O", "RIVN", "리비안", "Rivian"),
]
US_IDX = [(".INX", "SPX", "S&P 500", "S&P 500"), (".IXIC", "IXIC", "나스닥 종합", "Nasdaq Composite"),
          (".DJI", "DJI", "다우존스", "Dow Jones")]

COINS = [
    ("BTC", "비트코인", "Bitcoin"), ("ETH", "이더리움", "Ethereum"), ("SOL", "솔라나", "Solana"),
    ("XRP", "리플", "XRP"), ("DOGE", "도지코인", "Dogecoin"), ("ADA", "에이다", "Cardano"),
    ("BNB", "바이낸스코인", "BNB"), ("AVAX", "아발란체", "Avalanche"), ("LINK", "체인링크", "Chainlink"),
    ("DOT", "폴카닷", "Polkadot"), ("SHIB", "시바이누", "Shiba Inu"), ("PEPE", "페페", "Pepe"),
    ("TRX", "트론", "TRON"), ("SUI", "수이", "Sui"), ("LTC", "라이트코인", "Litecoin"),
    ("BCH", "비트코인캐시", "Bitcoin Cash"), ("NEAR", "니어", "NEAR"), ("APT", "앱토스", "Aptos"),
    ("WIF", "도그위프햇", "dogwifhat"), ("BONK", "봉크", "Bonk"), ("ETC", "이더리움클래식", "Ethereum Classic"),
    ("HBAR", "헤데라", "Hedera"), ("XLM", "스텔라루멘", "Stellar"),
]


def get(url):
    with urllib.request.urlopen(url, timeout=20) as r:
        return r.read()


def naver_kr(sym):
    raw = get(f"https://fchart.stock.naver.com/sise.nhn?symbol={sym}&timeframe=day&count={DAYS}&requestType=0").decode("euc-kr", "replace")
    out = []
    for m in re.finditer(r'data="([^"]+)"', raw):
        p = m.group(1).split("|")
        d, o, h, l, c = p[0], *map(float, p[1:5])
        if o == 0:  # halted days report 0 open
            o = c
        out.append([int(d), o, h, l, c])
    return out


def naver_us(code, index=False):
    end = datetime.date.today()
    start = end - datetime.timedelta(days=int(DAYS * 1.5))
    kind = "index" if index else "item"
    url = (f"https://api.stock.naver.com/chart/foreign/{kind}/{code}/day?"
           f"startDateTime={start:%Y%m%d}0000&endDateTime={end:%Y%m%d}2359")
    js = json.loads(get(url))
    out = [[int(r["localDate"]), r["openPrice"], r["highPrice"], r["lowPrice"], r["closePrice"]] for r in js]
    return out[-DAYS:]


def binance(sym):
    js = json.loads(get(f"https://data-api.binance.vision/api/v3/klines?symbol={sym}USDT&interval=1d&limit={DAYS}"))
    out = []
    for k in js:
        d = datetime.datetime.fromtimestamp(k[0] / 1000, datetime.timezone.utc).strftime("%Y%m%d")
        out.append([int(d), *map(float, k[1:5])])
    return out


def rnd(rows):
    import math
    res = []
    for d, *v in rows:
        mx = max(abs(x) for x in v) or 1
        digits = max(0, 4 - int(math.floor(math.log10(mx))))
        res.append([d] + [round(x, digits) for x in v])
    return res


items, fails = [], []

def add(id_, sym, ko, en, cat, cur, fn):
    try:
        rows = fn()
        if len(rows) < 60:
            raise ValueError(f"only {len(rows)} rows")
        items.append({"id": id_, "sym": sym, "ko": ko, "en": en, "cat": cat, "cur": cur, "d": rnd(rows)})
        print("ok ", sym, len(rows), rows[-1][0], file=sys.stderr)
    except Exception as e:
        fails.append((sym, str(e)))
        print("ERR", sym, e, file=sys.stderr)
    time.sleep(0.15)

for s, ko, en in KR_IDX:
    add("kr-" + s, s, ko, en, "kr", "pt", lambda s=s: naver_kr(s))
for s, ko, en in KR:
    add("kr-" + s, s, ko, en, "kr", "KRW", lambda s=s: naver_kr(s))
for code, s, ko, en in US_IDX:
    add("us-" + s, s, ko, en, "us", "pt", lambda c=code: naver_us(c, True))
for code, s, ko, en in US:
    add("us-" + s, s, ko, en, "us", "USD", lambda c=code: naver_us(c))
for s, ko, en in COINS:
    add("c-" + s, s + "/USDT", ko, en, "coin", "USDT", lambda s=s: binance(s))

if len(fails) > 5:
    print("too many failures, keeping the old data.json:", fails, file=sys.stderr)
    sys.exit(1)
asof = max(it["d"][-1][0] for it in items if it["cat"] != "coin")
json.dump({"asof": asof, "items": items}, open("data.json", "w"), separators=(",", ":"), ensure_ascii=False)
print(len(items), "items, fails:", fails, file=sys.stderr)
