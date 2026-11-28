# 🐶 코아 테트리스 (Coa Tetris)

아이템을 터뜨리며 즐기는 아이템 테트리스 미니게임. 폰(390×844)과 PC에서 스크롤 없이 바로 플레이할 수 있습니다.

**플레이:** https://yun840527-tech.github.io/coa-world/tetris/

(별도 저장소 생성 권한이 없어 `yun840527-tech/coa-world` 저장소의 `tetris/` 경로에 배포했습니다.)

## 게임

- 10×20 보드 · 7종 테트로미노 · 고스트 피스 · HOLD · NEXT 2개
- 라인 클리어 애니메이션 + 파티클, Web Audio 효과음(음소거 토글), 최고 기록 저장
- 조작
  - 키보드: ← → 이동, ↑ 회전(Z 반대 회전), ↓ 소프트 드롭, Space 하드 드롭, C 홀드, P 일시정지, M 음소거
  - 터치: ◀ ▼ ▶ ↻ / HOLD / ⬇ 하드드롭 / ⏸

### 라운드

- 12줄을 지우거나 32초가 지나면 라운드가 오르고 낙하 속도가 빨라집니다 (850ms → 630 → 470 …)
- **3라운드부터** 주기적으로 회색 방해 줄(빈칸 1개)이 아래에서 올라옵니다.

### 아이템 (해당 줄을 지우면 발동)

| 아이템 | 효과 |
| --- | --- |
| 💣 폭탄 | 주변 3×3 블록 폭발 제거 |
| ⚡ 번개 | 가장 아래에 쌓인 줄 1줄 즉시 제거 |
| 🐢 슬로우 | 8초간 낙하 속도 50% 감속 |
| 🧲 중력 압축 | 떠 있는 블록을 바닥으로 압축 |
| 🌟 2배 피버 | 10초간 점수 2배 |
| 🧹 바닥 청소 | 맨 아래 2줄 제거 |

## 하루 플레이 횟수 · 관리자 · 퀴즈 충전

- 상단 `🎮 남은 횟수 N/M` — 날짜(YYYY-MM-DD) 기준으로 저장되고 자정이 지나면 자동 초기화
- 시작할 때 1회 차감. 0회가 되면 `📚 영어·수학 문제 풀고 +1회 받기` 버튼이 강조됩니다.
- `⚙️ 관리자` — PIN(기본 `5927`) 입력 후
  - 하루 기본 횟수 1~20회
  - 아이 나이 5~13세 (나이에 따라 문제 난이도 4단계 자동)
  - 오늘 횟수 즉시 초기화 / +1회 추가 / PIN 변경
  - 📊 아이들 활동 리포트 (오늘·최근 7일: 플레이 횟수, 최고 점수·라운드, 퀴즈 푼 문제·정답·정답률, 충전 횟수)
- 퀴즈: 영어 / 수학 / 랜덤 중 선택, 5문제를 **모두** 맞히면 오늘 횟수 +1
  - 영어 문제는 `🔊 발음 듣기`(Web Speech API, en-US, rate 0.88)로 원어민 발음을 들려줍니다. 새 문제·정답 시 자동 재생(음소거 시 생략).

### 나이별 난이도

| 나이 | 수학 | 영어 |
| --- | --- | --- |
| 5~7세 | 한 자리 덧셈·뺄셈 | 알파벳, 기초 동물·과일·색깔 |
| 8~9세 | 받아올림 두 자리 덧셈·뺄셈, 쉬운 구구단 | 숫자·인사·생활 영단어 |
| 10~11세 | 구구단, 두 자리×한 자리, 나눗셈 | 동사·형용사, 문장 빈칸 |
| 12~13세 | 혼합 계산, 두 자리 곱셈·나눗셈, 분수·비율 | 중등 기초 영단어·문법·반의어/유의어 |

## 🏆 가족 랭킹

- 시작 화면·결과 화면에서 플레이어를 고릅니다 — 빠른 선택 `솜이` `쭈니` `엄마` `아빠` + 직접 입력(최대 10자).
- 고른 이름은 기기에 기억돼 다음에 열어도 그대로예요(`coa-tetris-player`).
- 게임이 끝나면 점수가 **Top 10 랭킹 보드**에 자동 저장되고, 결과 화면에 바로 표시됩니다 (순위·이름·점수·라운드·날짜). 이번 판 기록은 강조되고 `🥇 1위`·`🏆 N위` 배지로 순위를 알려 줍니다.
- 0점은 랭킹에 넣지 않고, 점수가 같으면 라운드가 높은 기록이 위로 옵니다.
- 상단 `🏆` 버튼으로 언제든 랭킹을 열 수 있습니다(플레이 중이면 자동 일시정지). 결과 화면의 랭킹 제목을 눌러도 같은 보드가 열립니다.
- 기록은 이 기기 브라우저(localStorage `coa-tetris-rankings`)에만 저장됩니다.

## 가족 앱 연동용 API

```js
// 활동 기록 JSON (전체)
CoaGameStats.get();
// { app, version, updatedAt, child:{age,level}, player, rankings:[Top10], rankingMax, today:{...}, week:[7일], totals:{...} }
CoaGameStats.export();   // 위 객체를 보기 좋은 JSON 문자열로
CoaGameStats.today();    // { date, plays, bestScore, bestRound, quiz:{solved,correct,accuracy}, charges }
CoaGameStats.week(7);    // 오늘 포함 최근 7일 배열
CoaGameStats.rankings(); // [{ id, name, score, round, date, ts }, ...] 점수 높은 순 Top 10

// 플레이어
CoaMeta.player();        // 현재 선택된 이름 (없으면 '플레이어')
CoaMeta.setPlayer('솜이');
CoaMeta.rankings();      // 랭킹 배열 (CoaGameStats.rankings() 와 같음)
CoaMeta.recordRanking(score, round);  // 직접 기록 (게임오버 시 자동 호출)
```

랭킹 한 줄 구조:

```json
{ "id": "rmx0jsf4k5", "name": "솜이", "score": 3210, "round": 4, "date": "2026-11-29", "ts": 1795878772829 }
```

하루치 구조:

```json
{
  "date": "2026-11-28",
  "plays": 2,
  "bestScore": 4321,
  "bestRound": 5,
  "quiz": { "solved": 10, "correct": 8, "accuracy": 80 },
  "charges": 2
}
```

저장 위치(localStorage): `coa-tetris-plays`, `coa-tetris-admin`, `coa-tetris-stats`, `coa-tetris-best`, `coa-tetris-muted`, `coa-tetris-rankings`, `coa-tetris-player`

## 개발 · 테스트

```bash
python3 tests/test_game.py     # Playwright: 390×844 모바일 · 1280×900 데스크톱 · 메타 기능 · 리포트 · 가족 랭킹
```

`index.html?debug=1` 로 열면 `window.__coaTetris`, `CoaMeta._debug` 테스트 훅이 열립니다(`CoaMeta._debug.setRankings()/clearRankings()/setPlayer()` 포함).

파일: `index.html` · `style.css` · `game.js`(게임) · `meta.js`(횟수·관리자·퀴즈·통계·가족 랭킹)
