# 차트 낙서 점술관 · Chart Doodle Oracle

주식·코인 차트를 고르면 차트 위에 대충 캐릭터 그림을 그리고, 그림을 "완성"하려면 가격이 어디로 가야 하는지로 오를지 내릴지를 맞히는(척하는) 밈 사이트입니다.

Pick a stock or coin and the site scribbles a character on the chart, then "predicts" the move by finishing the drawing. Korean / English.

**사이트:** https://sion1223.github.io/chart-doodle/

> 재미로 보는 낙서입니다. 투자 조언이 아닙니다. / For fun only. Not investment advice.

## 기능

- 국내주식·미국주식·지수·코인 86종 검색 (한글명, 영문명, 티커)
- 한국어 / English 전환. 한국어 모드는 상승 빨강·하락 파랑, 영어 모드는 상승 초록·하락 빨강
- 캐릭터 9종: 고양이, 낙타, 고래, 상어, 목 긴 공룡, 달팽이, 토끼, 뱀, 유령. 차트 모양(고점, 추세, 횡보 등)에 맞는 캐릭터를 자동으로 고르고, 직접 고를 수도 있음
- 3개월 / 6개월 / 1년, 이미지 저장, 링크 공유(`#us-TSLA` 같은 해시)

## 데이터

- 국내·미국 주식, 지수: 네이버 금융 일봉
- 코인: 바이낸스 USDT 일봉 (페이지에서 바이낸스 공개 API로 최신값을 다시 불러옴)
- `data.json`은 GitHub Actions(`.github/workflows/refresh-data.yml`)가 매일 두 번 `fetch_data.py`로 갱신

종목 추가는 `fetch_data.py`의 `KR`, `US`, `COINS` 목록에 넣으면 됩니다.

## 로컬 실행 (Windows PowerShell)

```powershell
python fetch_data.py
python -m http.server 8000
# 브라우저에서 http://localhost:8000
```
