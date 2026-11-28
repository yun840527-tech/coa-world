# 🕹️ 코아 아케이드 (Coa Arcade)

아이들이 놀면서 영어·수학을 익히는 모바일 미니게임 아케이드입니다.
한 페이지 안에서 **🍉 과일 합치기(수박 게임)** 와 **🃏 그림·영단어 짝 맞추기** 를 탭으로 오갑니다.

- 라이브: https://yun840527-tech.github.io/coa-world/arcade/
- 설치 없이 폰 브라우저에서 바로 실행 (세로 화면 기준, 데스크톱은 가운데 프레임)

## 게임

### 🍉 과일 합치기
- 체리 → 딸기 → 포도 → 귤 → 감 → 사과 → 배 → 복숭아 → 파인애플 → 멜론 → 수박 **11단계**
- 터치·드래그로 과일을 떨어뜨리고, 같은 과일끼리 닿으면 합쳐집니다 (원형 물리: 중력·충돌·마찰)
- 합체 파티클, Web Audio 효과음, 다음 과일 미리보기, 위험선 경고, 최고 기록 저장

### 🃏 그림·영단어 짝 맞추기
- 그림(이모지+한글 뜻) 카드와 영단어 카드를 짝지어 뒤집기
- 카드를 뒤집을 때 영어 단어를 원어민 발음(`speechSynthesis`, en-US)으로 읽어 줍니다
- 라운드 3×4 → 4×4 → 4×5, 콤보 점수, 제한 시간·별점, 최고 기록 저장
- 단어는 아이 나이에 맞춰 4단계(5~7 / 8~9 / 10~11 / 12~13세)로 출제

## 공통 시스템
- **하루 놀이 횟수**(기본 3회, 날짜가 바뀌면 자동 리셋) — 게임을 시작할 때 1회 차감
- **📚 문제 풀고 +1회** — 나이에 맞는 영어·수학 5문제를 맞히면 오늘 횟수 +1 (영어 문제는 🔊 발음 듣기)
- **⚙️ 관리자(PIN)** — 하루 기본 횟수(1~20), 아이 나이(5~13), 오늘 횟수 초기화·+1회 충전, PIN 변경
- **🏆 가족 랭킹** — 게임 전·결과 화면에서 플레이어(솜이·쭈니·엄마·아빠·직접 입력)를 고르고, 게임별 Top 10에 이름·점수·날짜가 자동 등록
- **📊 아이들 활동 리포트** (관리자 안) — 오늘/최근 7일 게임별 플레이·최고 점수, 영어·수학 문제 수·정답률, 퀴즈 충전 횟수

## 가족 앱 연동 (window.CoaGameStats)
`localStorage`에 쌓인 활동 기록을 다른 앱(가족 앱 등)에서 읽고 내보낼 수 있습니다.

```js
window.CoaGameStats.get();            // 전체 JSON 객체 (일별 기록·7일 합계·랭킹)
window.CoaGameStats.toJSON();         // JSON 문자열
window.CoaGameStats.download();       // JSON 파일 저장
window.CoaGameStats.snapshot();       // 남은 횟수·플레이어까지 포함한 요약
```

```json
{
  "app": "coa-arcade",
  "version": 1,
  "generatedAt": "2026-11-29T00:10:00.000Z",
  "today": "2026-11-29",
  "player": "솜이",
  "child": { "age": 8, "ageBand": 1 },
  "totals": { "days": 7, "watermelonPlays": 3, "watermelonBest": 1240, "matchPlays": 2, "matchBest": 2000, "quizAsked": 10, "quizCorrect": 9, "quizAccuracy": 90, "quizBonuses": 2 },
  "rankings": {
    "watermelon": [{ "rank": 1, "name": "쭈니", "score": 1240, "date": "2026-11-29" }],
    "match": []
  },
  "days": [
    {
      "date": "2026-11-29",
      "watermelon": { "plays": 1, "bestScore": 1240, "merges": 22 },
      "match": { "plays": 1, "bestScore": 2000, "clears": 3 },
      "quiz": {
        "english": { "asked": 3, "correct": 3, "accuracy": 100 },
        "math": { "asked": 2, "correct": 2, "accuracy": 100 },
        "asked": 5, "correct": 5, "accuracy": 100, "bonuses": 1
      }
    }
  ]
}
```

기록이 갱신될 때마다 `window`에 `coa:stats-updated`, `coa:ranking-updated` 이벤트가 발생합니다.
관리자 리포트의 **JSON 복사 / JSON 저장** 버튼으로도 같은 내용을 내보낼 수 있습니다.

## 저장 키 (localStorage)
| 키 | 내용 |
| --- | --- |
| `coa-arcade-v1` | 오늘 사용 횟수·충전, 설정(하루 횟수·나이·PIN·음소거·플레이어), 최고 점수 |
| `coa-arcade-stats-v1` | 날짜별 활동 기록 (최근 60일 유지) |
| `coa-arcade-rankings-v1` | 게임별 랭킹 (최고 점수 순, Top 10 표시) |

## 개발
정적 파일만으로 동작합니다. 로컬 확인:

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Playwright 검증 (모바일 390×844 · 태블릿 · 데스크톱 1280×900, 콘솔 에러 0건):

```bash
python3 tests/test_arcade.py
```

> 기본 PIN은 관리자 화면에서 바꿀 수 있습니다. 공개 페이지에는 실명·연락처 등 개인정보를 두지 않습니다.
