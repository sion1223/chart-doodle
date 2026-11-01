# 차트 낙서 점술관 — 앱인토스 미니앱

웹 버전(저장소 루트의 `index.html`)을 앱인토스 미니앱으로 옮긴 버전이에요. 화면은 TDS(`@toss/tds-mobile`) 컴포넌트로 만들었고, 차트·낙서 엔진은 웹 버전에서 자동으로 뽑아 써요.

## 구조

- `src/App.jsx`: TDS 화면 (Top, SearchField, Tab, ListRow, Badge, BottomSheet, FixedBottomCTA)
- `src/engine.js`: 차트 그리기 엔진. `make-engine.py`가 `../index.html`에서 생성해요. 직접 고치지 말고 웹 버전을 고친 뒤 다시 생성하세요.
- `public/data.json`, `public/characters.json`: 루트 파일 복사본
- `apps-in-toss.config.ts`: `appName`은 콘솔에 등록한 앱 이름과 같아야 해요 (지금 `chart-doodle`)

## 빌드와 배포 (Windows PowerShell)

```powershell
cd toss
npm install
Copy-Item ..\data.json, ..\characters.json public\
npm run build          # engine 생성 → vite build → chart-doodle.ait
npx ait deploy --api-key <콘솔에서 발급한 키>
```

`npm run dev`로 브라우저에서 미리 볼 수 있지만, 이미지 저장·진동 같은 토스 기능은 토스 앱(샌드박스) 안에서만 동작해요.
