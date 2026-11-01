# 차트 낙서 점술관 · Chart Doodle Oracle

주식·코인 차트를 고르면 차트 위에 대충 캐릭터 그림을 그리고, 그림을 "완성"하려면 가격이 어디로 가야 하는지로 오를지 내릴지를 맞히는(척하는) 밈 사이트입니다.

Pick a stock or coin and the site scribbles a character on the chart, then "predicts" the move by finishing the drawing. Korean / English.

**사이트:** https://sion1223.github.io/chart-doodle/

> 재미로 보는 낙서입니다. 투자 조언이 아닙니다. / For fun only. Not investment advice.

## 기능

- 국내주식·미국주식·지수·코인 86종 검색 (한글명, 영문명, 티커)
- 한국어 / English 전환. 한국어 모드는 상승 빨강·하락 파랑, 영어 모드는 상승 초록·하락 빨강
- 캐릭터 107종: 직접 그린 9종(고양이, 낙타, 고래, 상어, 목 긴 공룡, 달팽이, 토끼, 뱀, 유령) + `characters.json`에 정의된 98종. 차트 모양(고점, 추세, 횡보 등)에 맞는 캐릭터를 자동으로 고르고, 목록에서 직접 고를 수도 있음
- 캐릭터 모양: `looks.js`에 템플릿(동물 체형, 사물 모양)이 있고, 각 캐릭터의 `look`이 템플릿·위치(`attach`/`ride`/`span`/`belowpath`)·예측선과 이어지는 점(`hook`)을 정해요
- 캐릭터 추가: `characters.json`의 `generic`에 한 줄 추가 (`arche`는 미래 경로 모양: rise, curl, hump, spikes, dipup, vee, drop, bumpdrop, crash, flat, zigup, zigdown). 같은 파일을 `supabase/functions/chart-doodle-art/characters.json`에도 복사한 뒤 함수를 재배포
- 일봉 / 주봉 / 월봉 / 6개월봉 / 1년봉, 이미지 저장, 링크 공유(`#us-TSLA` 같은 해시)
- **AI 그림**: 차트 선과 예측 경로를 이미지 모델에 보내 그 선을 외곽선으로 삼은 캐릭터 그림을 받아 차트 위에 겹침. 생성한 그림은 모양 벡터와 함께 저장해 두고, 비슷한 모양의 차트가 오면 새로 만들지 않고 재사용

## 데이터

- 국내·미국 주식, 지수: Supabase Edge Function(`supabase/functions/chart-doodle`)이 네이버 금융 일봉을 실시간으로 받아 전달 (60초 캐시). 목록에 없는 6자리 종목코드나 미국 티커도 검색창에 치면 바로 불러옴
- 코인: 바이낸스 USDT 일봉을 브라우저에서 바로 불러옴
- `data.json`은 첫 화면용 스냅샷이자 함수가 실패할 때의 대체 데이터. GitHub Actions(`.github/workflows/refresh-data.yml`)가 매일 두 번 갱신

- 주봉·월봉은 함수와 바이낸스에서 받고, 6개월봉·1년봉은 월봉을 묶어서 만듦

## AI 그림 (`supabase/functions/chart-doodle-art`)

1. 페이지가 "차트 선 + 예측 경로"를 48개 점의 모양 벡터로 만들어 보냄
2. 함수가 `doodle_art` 테이블(pgvector)에서 같은 캐릭터 중 가장 가까운 모양을 찾고, 차이가 작으면(RMS 0.09 이하) 그 그림을 재사용
3. 없으면 선 스케치를 BAZE 이미지 API(기본 `gemini-3.1-flash-lite-image`)로 보내 새로 그리고, Storage `doodle-art` 버킷과 테이블에 저장
4. IP당 하루 20장, 전체 하루 150장까지만 새로 생성 (비용 보호)

필요한 Supabase Edge Function 시크릿:

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `BAZE_API_KEY` | 예 | BAZE API 키 |
| `BAZE_IMAGE_MODEL` | 아니오 | 이미지 모델 바꾸기 |
| `DOODLE_IP_DAILY_LIMIT` / `DOODLE_GLOBAL_DAILY_LIMIT` | 아니오 | 하루 생성 한도 |
| `DOODLE_MATCH_RMS` | 아니오 | 재사용 기준. 클수록 더 자주 재사용 |

DB 구조는 `supabase/migrations/`에 있습니다. 함수 재배포:

```powershell
supabase functions deploy chart-doodle --no-verify-jwt
supabase functions deploy chart-doodle-art --no-verify-jwt
```

검색 목록에 종목을 추가하려면 `fetch_data.py`의 `KR`, `US`, `COINS` 목록에 넣으면 됩니다.

## 로컬 실행 (Windows PowerShell)

```powershell
python fetch_data.py
python -m http.server 8000
# 브라우저에서 http://localhost:8000
```
