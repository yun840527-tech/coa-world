/* 코아 테트리스 — 메타 기능: 하루 플레이 횟수 · 관리자 모드 · 영어/수학 퀴즈 충전 · 영어 발음
 * game.js 보다 먼저 로드되어 window.CoaMeta 를 제공한다.
 */
(function () {
  'use strict';

  const KEY_PLAYS = 'coa-tetris-plays';
  const KEY_ADMIN = 'coa-tetris-admin';
  const KEY_MUTE = 'coa-tetris-muted';
  const KEY_STATS = 'coa-tetris-stats';
  const STATS_KEEP_DAYS = 30;
  const DEBUG = new URLSearchParams(location.search).has('debug');
  const QUIZ_N = 5;
  const AGE_MIN = 5;
  const AGE_MAX = 13;
  const DEFAULT_ADMIN = { pin: '5927', base: 3, age: 10 };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /* ───────────── 저장 ───────────── */
  function todayStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  const Meta = {
    admin: { ...DEFAULT_ADMIN },
    plays: { date: todayStr(), used: 0, bonus: 0 },

    load() {
      try {
        const a = JSON.parse(localStorage.getItem(KEY_ADMIN) || 'null');
        if (a && typeof a === 'object') {
          this.admin = {
            pin: /^\d{4}$/.test(a.pin || '') ? a.pin : DEFAULT_ADMIN.pin,
            base: clampInt(a.base, 1, 20, DEFAULT_ADMIN.base),
            age: clampInt(a.age, AGE_MIN, AGE_MAX, DEFAULT_ADMIN.age),
          };
        }
      } catch (e) {}
      try {
        const p = JSON.parse(localStorage.getItem(KEY_PLAYS) || 'null');
        if (p && p.date === todayStr()) {
          this.plays = {
            date: p.date,
            used: clampInt(p.used, 0, 999, 0),
            bonus: clampInt(p.bonus, 0, 999, 0),
          };
        } else {
          this.plays = { date: todayStr(), used: 0, bonus: 0 };
          this.savePlays();
        }
      } catch (e) {
        this.plays = { date: todayStr(), used: 0, bonus: 0 };
      }
    },
    savePlays() {
      try { localStorage.setItem(KEY_PLAYS, JSON.stringify(this.plays)); } catch (e) {}
    },
    saveAdmin() {
      try { localStorage.setItem(KEY_ADMIN, JSON.stringify(this.admin)); } catch (e) {}
    },
    /** 날짜가 바뀌었으면 자동 초기화 (자정 넘김 대응) */
    rollover() {
      if (this.plays.date !== todayStr()) {
        this.plays = { date: todayStr(), used: 0, bonus: 0 };
        this.savePlays();
        return true;
      }
      return false;
    },
    total() { return this.admin.base + this.plays.bonus; },
    remaining() { this.rollover(); return Math.max(0, this.total() - this.plays.used); },
    consumePlay() {
      this.rollover();
      if (this.remaining() <= 0) { this.refresh(); return false; }
      this.plays.used += 1;
      this.savePlays();
      Stats.addPlay();
      this.refresh();
      return true;
    },
    addPlay(n) {
      this.rollover();
      this.plays.bonus += (n || 1);
      this.savePlays();
      this.refresh();
    },
    resetToday() {
      this.plays.date = todayStr();
      this.plays.used = 0;
      this.savePlays();
      this.refresh();
    },
    level() { return ageLevel(this.admin.age); },
    refresh() {
      this.rollover();
      const left = this.remaining();
      const total = this.total();
      const chip = $('#btn-plays');
      $('#plays-left').textContent = String(left);
      $('#plays-max').textContent = String(total);
      chip.classList.toggle('empty', left <= 0);
      chip.title = left > 0 ? `오늘 남은 플레이 ${left}회` : '오늘 횟수를 다 썼어요 — 퀴즈로 +1회';

      const start = $('#btn-start');
      const quizStart = $('#btn-quiz-start');
      if (start) {
        start.disabled = left <= 0;
        start.textContent = left <= 0 ? '오늘 횟수를 다 썼어요' : '시작하기';
      }
      if (quizStart) quizStart.hidden = left > 0;
      const restart = $('#btn-restart');
      const quizOver = $('#btn-quiz-over');
      if (restart) {
        restart.disabled = left <= 0;
        restart.textContent = left <= 0 ? '오늘 횟수를 다 썼어요' : '다시 도전';
      }
      if (quizOver) quizOver.hidden = left > 0;
      const overMsg = $('#over-msg');
      if (overMsg && left <= 0 && $('#overlay') && $('#overlay').dataset.screen === 'over') {
        overMsg.textContent = '오늘 횟수를 다 썼어요. 문제를 풀고 +1회 받아요 📚';
      }

      const sp = $('#start-plays'), spm = $('#start-plays-max');
      if (sp) sp.textContent = String(left);
      if (spm) spm.textContent = String(total);
      const op = $('#over-plays'), opm = $('#over-plays-max');
      if (op) op.textContent = String(left);
      if (opm) opm.textContent = String(total);

      const qa = $('#quiz-age');
      if (qa) qa.textContent = this.admin.age + '세';
      const ad = $('#adm-age');
      if (ad) ad.textContent = this.admin.age + '세';
    },
  };


  /* ───────────── 활동 통계 ───────────── */
  const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
  function dateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return `${m}/${d} ${WEEKDAY[dt.getDay()]}`;
  }
  function fmtNum(n) {
    try { return Number(n).toLocaleString('ko-KR'); } catch (e) { return String(n); }
  }

  const Stats = {
    days: {},
    load() {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY_STATS) || 'null');
        this.days = {};
        if (raw && raw.days && typeof raw.days === 'object') {
          for (const k of Object.keys(raw.days)) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) continue;
            this.days[k] = this.norm(raw.days[k]);
          }
        }
      } catch (e) { this.days = {}; }
      this.prune();
    },
    norm(d) {
      const o = d && typeof d === 'object' ? d : {};
      return {
        plays: clampInt(o.plays, 0, 99999, 0),
        bestScore: clampInt(o.bestScore, 0, 99999999, 0),
        bestRound: clampInt(o.bestRound, 0, 999, 0),
        quizSolved: clampInt(o.quizSolved, 0, 99999, 0),
        quizCorrect: clampInt(o.quizCorrect, 0, 99999, 0),
        charges: clampInt(o.charges, 0, 99999, 0),
      };
    },
    save() {
      try { localStorage.setItem(KEY_STATS, JSON.stringify({ version: 1, days: this.days })); } catch (e) {}
    },
    prune() {
      const keys = Object.keys(this.days).sort();
      const drop = keys.slice(0, Math.max(0, keys.length - STATS_KEEP_DAYS));
      drop.forEach((k) => delete this.days[k]);
    },
    entry(dateStr) {
      const k = dateStr || todayStr();
      if (!this.days[k]) this.days[k] = this.norm({});
      return this.days[k];
    },
    addPlay() { this.entry().plays += 1; this.save(); },
    recordGame(score, round) {
      const d = this.entry();
      if (score > d.bestScore) d.bestScore = score;
      if (round > d.bestRound) d.bestRound = round;
      this.save();
    },
    addQuiz(correct) {
      const d = this.entry();
      d.quizSolved += 1;
      if (correct) d.quizCorrect += 1;
      this.save();
    },
    addCharge() { this.entry().charges += 1; this.save(); },
    view(dateStr) {
      const k = dateStr || todayStr();
      const d = this.days[k] || this.norm({});
      return {
        date: k,
        plays: d.plays,
        bestScore: d.bestScore,
        bestRound: d.bestRound,
        quiz: {
          solved: d.quizSolved,
          correct: d.quizCorrect,
          accuracy: d.quizSolved ? Math.round((d.quizCorrect / d.quizSolved) * 100) : 0,
        },
        charges: d.charges,
      };
    },
    week(n) {
      const out = [];
      const days = n || 7;
      const now = new Date();
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const p = (x) => String(x).padStart(2, '0');
        out.push(this.view(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`));
      }
      return out;
    },
    all() { return Object.keys(this.days).sort().map((k) => this.view(k)); },
    totals() {
      const t = { plays: 0, bestScore: 0, bestRound: 0, quizSolved: 0, quizCorrect: 0, charges: 0, days: 0 };
      for (const k of Object.keys(this.days)) {
        const d = this.days[k];
        if (!d.plays && !d.quizSolved && !d.charges) continue;
        t.days += 1;
        t.plays += d.plays;
        t.bestScore = Math.max(t.bestScore, d.bestScore);
        t.bestRound = Math.max(t.bestRound, d.bestRound);
        t.quizSolved += d.quizSolved;
        t.quizCorrect += d.quizCorrect;
        t.charges += d.charges;
      }
      t.quizAccuracy = t.quizSolved ? Math.round((t.quizCorrect / t.quizSolved) * 100) : 0;
      return t;
    },
  };

  function clampInt(v, min, max, dflt) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return dflt;
    return Math.max(min, Math.min(max, n));
  }

  /* ───────────── 나이 → 난이도 ───────────── */
  const AGE_BANDS = [
    { min: 5, max: 7, level: 1, label: '유치·초1 입문', desc: '한 자리 덧셈·뺄셈, 알파벳과 기초 동물·과일·색깔 영단어' },
    { min: 8, max: 9, level: 2, label: '초1~2', desc: '받아올림 두 자리 덧셈·뺄셈, 쉬운 구구단, 숫자·인사·생활 영단어' },
    { min: 10, max: 11, level: 3, label: '초3~4', desc: '구구단 전체, 두 자리 곱셈·나눗셈, 동사·형용사·문장 빈칸' },
    { min: 12, max: 13, level: 4, label: '초5~6', desc: '혼합 계산, 두 자리 곱셈·나눗셈, 분수·비율, 중등 기초 영단어·문법' },
  ];
  function ageBand(age) {
    for (const b of AGE_BANDS) if (age >= b.min && age <= b.max) return b;
    return AGE_BANDS[2];
  }
  function ageLevel(age) { return ageBand(age).level; }

  /* ───────────── 문제 생성: 수학 ───────────── */
  function numQ(text, answer, spread) {
    const set = new Set([String(answer)]);
    let guard = 0;
    while (set.size < 4 && guard++ < 80) {
      const off = rnd(1, spread) * (Math.random() < 0.5 ? -1 : 1);
      let v = answer + off;
      if (v < 0) v = Math.abs(v) + 1;
      if (v === answer) continue;
      set.add(String(v));
    }
    while (set.size < 4) set.add(String(answer + set.size * 3));
    const choices = shuffle(Array.from(set));
    return { q: text, choices, answer: choices.indexOf(String(answer)) };
  }

  function mathQ(level) {
    if (level === 1) {
      const k = pick(['add', 'sub', 'word', 'word']);
      if (k === 'add') { const a = rnd(1, 9), b = rnd(1, 10 - a); return numQ(`${a} + ${b} = ?`, a + b, 5); }
      if (k === 'sub') { const a = rnd(2, 10), b = rnd(1, a); return numQ(`${a} − ${b} = ?`, a - b, 4); }
      const a = rnd(2, 7), b = rnd(1, 9 - a);
      return numQ(`사탕 ${a}개와 ${b}개를 합치면 모두 몇 개일까요?`, a + b, 5);
    }
    if (level === 2) {
      const k = pick(['add', 'sub', 'mul', 'word']);
      if (k === 'add') {
        let a, b, guard = 0;
        do { a = rnd(12, 78); b = rnd(12, 78); } while ((a % 10) + (b % 10) < 10 && guard++ < 60);
        return numQ(`${a} + ${b} = ?`, a + b, 12);
      }
      if (k === 'sub') { const a = rnd(31, 98); const b = rnd(12, a - 10); return numQ(`${a} − ${b} = ?`, a - b, 12); }
      if (k === 'mul') { const a = rnd(2, 5), b = rnd(2, 9); return numQ(`${a} × ${b} = ?`, a * b, 9); }
      const a = rnd(13, 45), b = rnd(11, 30);
      return numQ(`연필 ${a}자루와 ${b}자루가 있습니다. 모두 몇 자루일까요?`, a + b, 12);
    }
    if (level === 3) {
      const k = pick(['mul', 'mul2', 'div', 'word']);
      if (k === 'mul') { const a = rnd(2, 9), b = rnd(2, 9); return numQ(`${a} × ${b} = ?`, a * b, 12); }
      if (k === 'mul2') { const a = rnd(12, 29), b = rnd(2, 9); return numQ(`${a} × ${b} = ?`, a * b, Math.max(9, Math.round(a * b * 0.12))); }
      if (k === 'div') { const b = rnd(3, 9), q = rnd(3, 12); return numQ(`${b * q} ÷ ${b} = ?`, q, 6); }
      const b = rnd(3, 8), q = rnd(4, 12);
      return numQ(`사탕 ${b * q}개를 ${b}명이 똑같이 나누면 한 명당 몇 개일까요?`, q, 6);
    }
    const k = pick(['mixed', 'mulBig', 'divBig', 'fraction', 'ratio', 'fracAdd']);
    if (k === 'mixed') { const a = rnd(12, 29), b = rnd(11, 29), c = rnd(2, 9); return numQ(`(${a} + ${b}) × ${c} = ?`, (a + b) * c, Math.max(15, Math.round((a + b) * c * 0.12))); }
    if (k === 'mulBig') { const a = rnd(12, 29), b = rnd(11, 29); return numQ(`${a} × ${b} = ?`, a * b, Math.max(20, Math.round(a * b * 0.1))); }
    if (k === 'divBig') { const b = rnd(4, 9), q = rnd(4, 15); return numQ(`${b * q} ÷ ${b} = ?`, q, 8); }
    if (k === 'fraction') {
      const d = pick([2, 3, 4, 5, 6]);
      const n = rnd(2, 6);
      return numQ(`전체 ${d * n}개 중 1/${d}은 몇 개일까요?`, n, 6);
    }
    if (k === 'ratio') {
      const a = rnd(2, 5), b = rnd(2, 6), m = rnd(2, 6);
      return numQ(`사탕과 초콜릿의 비가 ${a} : ${b}입니다. 사탕이 ${a * m}개일 때 초콜릿은 몇 개일까요?`, b * m, Math.max(4, b * m));
    }
    // 같은 분모 분수 덧셈
    const d = rnd(3, 9), a = rnd(1, d - 2), b = rnd(1, d - 1 - a);
    const ans = `${a + b}/${d}`;
    const raw = [
      `${a + b}/${d * 2}`, `${a + b + 1}/${d}`, `${Math.max(1, a + b - 1)}/${d}`,
    ];
    const choices = shuffle([ans, ...raw.slice(0, 3)]);
    return { q: `${a}/${d} + ${b}/${d} = ?`, choices, answer: choices.indexOf(ans) };
  }

  /* ───────────── 문제 생성: 영어 ───────────── */
  const EN = {
    1: [
      ['apple', '사과'], ['banana', '바나나'], ['cat', '고양이'], ['dog', '개'], ['red', '빨강'],
      ['blue', '파랑'], ['milk', '우유'], ['water', '물'], ['book', '책'], ['sun', '해'],
      ['moon', '달'], ['star', '별'], ['bird', '새'], ['fish', '물고기'], ['bear', '곰'],
      ['car', '자동차'], ['ball', '공'], ['hat', '모자'], ['egg', '달걀'], ['cake', '케이크'],
    ],
    2: [
      ['one', '하나'], ['two', '둘'], ['three', '셋'], ['four', '넷'], ['five', '다섯'],
      ['six', '여섯'], ['seven', '일곱'], ['eight', '여덟'], ['nine', '아홉'], ['ten', '열'],
      ['hello', '안녕'], ['goodbye', '안녕히 가세요'], ['thank you', '고마워요'], ['sorry', '미안해요'],
      ['good morning', '좋은 아침'], ['pencil', '연필'], ['eraser', '지우개'], ['desk', '책상'],
      ['chair', '의자'], ['bag', '가방'], ['teacher', '선생님'], ['student', '학생'],
      ['mother', '어머니'], ['father', '아버지'], ['sister', '언니·누나'], ['brother', '형·오빠'],
      ['school', '학교'], ['friend', '친구'], ['family', '가족'], ['door', '문'],
    ],
    3: [
      ['run', '달리다'], ['eat', '먹다'], ['drink', '마시다'], ['sleep', '자다'], ['study', '공부하다'],
      ['walk', '걷다'], ['jump', '뛰어오르다'], ['swim', '수영하다'], ['write', '쓰다'], ['read', '읽다'],
      ['happy', '행복한'], ['sad', '슬픈'], ['big', '큰'], ['small', '작은'], ['fast', '빠른'],
      ['slow', '느린'], ['hot', '더운'], ['cold', '추운'], ['new', '새로운'], ['old', '오래된'],
      ['hungry', '배고픈'], ['tired', '피곤한'], ['clean', '깨끗한'], ['dirty', '더러운'], ['quiet', '조용한'],
    ],
    4: [
      ['borrow', '빌리다'], ['lend', '빌려주다'], ['arrive', '도착하다'], ['leave', '떠나다'],
      ['choose', '고르다'], ['explain', '설명하다'], ['remember', '기억하다'], ['forget', '잊다'],
      ['promise', '약속하다'], ['decide', '결정하다'], ['improve', '향상시키다'], ['avoid', '피하다'],
      ['refuse', '거절하다'], ['suggest', '제안하다'], ['celebrate', '축하하다'], ['ancient', '고대의'],
      ['curious', '호기심 많은'], ['generous', '관대한'], ['serious', '진지한'], ['confident', '자신감 있는'],
    ],
  };
  const GRAMMAR = {
    3: [
      { s: 'I ___ an apple.', a: 'eat', w: ['eats', 'eating', 'ate'] },
      { s: 'She ___ happy.', a: 'is', w: ['are', 'am', 'be'] },
      { s: 'They ___ soccer now.', a: 'are playing', w: ['play', 'plays', 'played'] },
      { s: 'He ___ to school every day.', a: 'goes', w: ['go', 'going', 'went'] },
      { s: 'We ___ a book yesterday.', a: 'read', w: ['reads', 'reading', 'readed'] },
      { s: 'My sister ___ milk.', a: 'drinks', w: ['drink', 'drinking', 'drank'] },
    ],
    4: [
      { s: 'She ___ a book every night.', a: 'reads', w: ['read', 'reading', 'readed'] },
      { s: 'He ___ busy yesterday.', a: 'was', w: ['were', 'is', 'be'] },
      { s: '___ you like apples?', a: 'Do', w: ['Does', 'Are', 'Is'] },
      { s: 'If it ___ tomorrow, we will stay home.', a: 'rains', w: ['rain', 'rained', 'raining'] },
      { s: 'I have ___ my homework already.', a: 'finished', w: ['finish', 'finishing', 'finishes'] },
      { s: 'This book is ___ than that one.', a: 'more interesting', w: ['interesting', 'most interesting', 'interested'] },
    ],
  };
  const OPPOSITES = [
    ['happy', 'sad'], ['big', 'small'], ['fast', 'slow'], ['hot', 'cold'], ['new', 'old'],
    ['easy', 'difficult'], ['early', 'late'], ['strong', 'weak'], ['clean', 'dirty'], ['open', 'close'],
  ];
  const SYNONYMS = [
    ['big', 'large'], ['happy', 'glad'], ['fast', 'quick'], ['begin', 'start'], ['small', 'little'], ['smart', 'clever'],
  ];

  function enChoices(item, bankWords) {
    const set = new Set([item[0]]);
    let guard = 0;
    while (set.size < 4 && guard++ < 100) set.add(pick(bankWords)[0]);
    const choices = shuffle(Array.from(set));
    return { choices, answer: choices.indexOf(item[0]) };
  }

  function enWordQ(level) {
    const bank = EN[level];
    const item = pick(bank);
    const toEn = Math.random() < 0.55;
    const { choices, answer } = enChoices(item, bank);
    if (toEn) {
      return { q: `‘${item[1]}’를 영어로 하면?`, choices, answer, speak: item[0], subject: 'english' };
    }
    const set = new Set([item[1]]);
    let guard = 0;
    while (set.size < 4 && guard++ < 100) set.add(pick(bank)[1]);
    const ks = shuffle(Array.from(set));
    return { q: `‘${item[0]}’의 뜻은?`, choices: ks, answer: ks.indexOf(item[1]), speak: item[0], subject: 'english' };
  }

  function enGrammarQ(level) {
    const g = pick(GRAMMAR[level]);
    const choices = shuffle([g.a, ...g.w]);
    return {
      q: g.s,
      choices,
      answer: choices.indexOf(g.a),
      speak: g.s.replace('___', g.a),
      subject: 'english',
    };
  }

  function enRelationQ(level) {
    const isOpp = level >= 4 && Math.random() < 0.5;
    const pair = pick(isOpp ? OPPOSITES : SYNONYMS);
    const bank = EN[level] || EN[4];
    const set = new Set([pair[1]]);
    let guard = 0;
    while (set.size < 4 && guard++ < 100) set.add(pick(bank)[0]);
    const choices = shuffle(Array.from(set));
    return {
      q: isOpp ? `‘${pair[0]}’의 반대말은?` : `‘${pair[0]}’와 뜻이 같은 말은?`,
      choices,
      answer: choices.indexOf(pair[1]),
      speak: pair[0],
      subject: 'english',
    };
  }

  function englishQ(level) {
    if (level === 1) {
      if (Math.random() < 0.3) {
        const i = rnd(0, 22);
        const letter = String.fromCharCode(65 + i);
        const next = String.fromCharCode(66 + i);
        const set = new Set([next]);
        let guard = 0;
        while (set.size < 4 && guard++ < 60) set.add(String.fromCharCode(65 + rnd(0, 25)));
        const choices = shuffle(Array.from(set));
        return {
          q: `알파벳에서 ‘${letter}’ 다음 글자는?`,
          choices, answer: choices.indexOf(next), speak: next, subject: 'english',
        };
      }
      return enWordQ(1);
    }
    if (level === 2) return enWordQ(2);
    if (level === 3) {
      const k = pick(['word', 'word', 'grammar']);
      return k === 'grammar' ? enGrammarQ(3) : enWordQ(3);
    }
    const k = pick(['word', 'grammar', 'relation', 'relation']);
    if (k === 'grammar') return enGrammarQ(4);
    if (k === 'relation') return enRelationQ(4);
    return enWordQ(4);
  }

  function makeQuestions(subject, level) {
    const out = [];
    const seen = new Set();
    let guard = 0;
    while (out.length < QUIZ_N && guard++ < 300) {
      const s = subject === 'mixed' ? (Math.random() < 0.5 ? 'math' : 'english') : subject;
      const q = s === 'math' ? mathQ(level) : englishQ(level);
      q.subject = s;
      if (seen.has(q.q)) continue;
      seen.add(q.q);
      out.push(q);
    }
    return out;
  }

  /* ───────────── 영어 발음 (Web Speech API) ───────────── */
  const Speech = {
    supported: typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function',
    muted() {
      try { return localStorage.getItem(KEY_MUTE) === '1'; } catch (e) { return false; }
    },
    speak(text) {
      if (!this.supported || !text) return false;
      try {
        const u = new SpeechSynthesisUtterance(String(text));
        u.lang = 'en-US';
        u.rate = 0.88;
        u.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
        const en = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('en'));
        if (en) u.voice = en;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
        return true;
      } catch (e) {
        return false;
      }
    },
  };

  /* ───────────── 모달 ───────────── */
  let autoPaused = false;
  function openModal(id) {
    const m = document.getElementById(id);
    if (!m) return;
    if (!autoPaused && window.CoaGame && window.CoaGame.status() === 'playing') {
      window.CoaGame.pause();
      autoPaused = true;
    }
    m.hidden = false;
    document.body.classList.add('modal-open');
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.hidden = true;
    if (!$$('.modal').some((el) => !el.hidden)) {
      document.body.classList.remove('modal-open');
      if (autoPaused) {
        autoPaused = false;
        if (window.CoaGame && window.CoaGame.status() === 'paused') window.CoaGame.resume();
      }
    }
    if (id === 'modal-quiz') { try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {} }
  }
  function closeAllModals() {
    $$('.modal').forEach((m) => { m.hidden = true; });
    document.body.classList.remove('modal-open');
    if (autoPaused) {
      autoPaused = false;
      if (window.CoaGame && window.CoaGame.status() === 'paused') window.CoaGame.resume();
    }
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
  }

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  /* ───────────── 관리자 ───────────── */
  function renderAdmin() {
    $('#adm-base').textContent = String(Meta.admin.base);
    $('#adm-age').textContent = Meta.admin.age + '세';
    const band = ageBand(Meta.admin.age);
    $('#adm-age-hint').innerHTML = `<b>${band.label}</b> 수준 · ${band.desc}`;
    const left = Meta.remaining(), total = Meta.total();
    $('#adm-today').textContent = `남은 ${left} / 전체 ${total}`;
    $$('#adm-age-picks button').forEach((b) => {
      b.classList.toggle('on', parseInt(b.dataset.age, 10) === Meta.admin.age);
    });
    renderStats();
  }

  function renderStats() {
    const t = Stats.view(todayStr());
    const el = $('#sr-today');
    if (!el) return;
    el.innerHTML =
      `<span>🎮 플레이 <b>${t.plays}회</b></span>` +
      `<span>🏆 최고 <b>${t.bestScore ? fmtNum(t.bestScore) : '–'}${t.bestRound ? ' · R' + t.bestRound : ''}</b></span>` +
      `<span>📚 퀴즈 <b>${t.quiz.solved}문제 · ${t.quiz.correct}정답</b></span>` +
      `<span>🎯 정답률 <b>${t.quiz.solved ? t.quiz.accuracy + '%' : '–'}</b></span>` +
      `<span>✨ 충전 <b>+${t.charges}회</b></span>`;
    const today = todayStr();
    const rows = Stats.week(7).reverse();
    $('#sr-rows').innerHTML = rows.map((v) => {
      const cls = v.date === today ? ' class="today"' : '';
      return `<tr${cls}><td>${dateLabel(v.date)}</td><td>${v.plays}</td>` +
        `<td>${v.bestScore ? fmtNum(v.bestScore) : '–'}</td>` +
        `<td>${v.quiz.solved ? v.quiz.correct + '/' + v.quiz.solved + ' · ' + v.quiz.accuracy + '%' : '–'}</td>` +
        `<td>${v.charges ? '+' + v.charges : '–'}</td></tr>`;
    }).join('');
  }

  function buildAgePicks() {
    const wrap = $('#adm-age-picks');
    if (!wrap || wrap.childElementCount) return;
    for (let a = AGE_MIN; a <= AGE_MAX; a++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.age = String(a);
      b.textContent = String(a);
      b.addEventListener('click', () => {
        Meta.admin.age = a;
        Meta.saveAdmin();
        renderAdmin();
        Meta.refresh();
        toast(`${a}세 · ${ageBand(a).label} 수준으로 저장했어요`);
      });
      wrap.appendChild(b);
    }
  }

  function openPin() {
    const err = $('#pin-err');
    err.textContent = '';
    $('#pin-input').value = '';
    openModal('modal-pin');
    setTimeout(() => { try { $('#pin-input').focus({ preventScroll: true }); } catch (e) {} }, 120);
  }

  function tryPin() {
    const val = $('#pin-input').value.trim();
    if (val.length !== 4) { $('#pin-err').textContent = 'PIN 4자리를 입력해 주세요.'; return; }
    if (val !== Meta.admin.pin) { $('#pin-err').textContent = 'PIN이 맞지 않아요.'; return; }
    closeModal('modal-pin');
    openAdmin();
  }

  function openAdmin() {
    renderAdmin();
    buildAgePicks();
    $('#adm-pin').value = '';
    $('#adm-err').textContent = '';
    openModal('modal-admin');
  }

  function saveAdmin() {
    const pin = $('#adm-pin').value.trim();
    if (pin && !/^\d{4}$/.test(pin)) {
      $('#adm-err').textContent = 'PIN은 숫자 4자리로 입력해 주세요.';
      return false;
    }
    if (pin && pin !== Meta.admin.pin) {
      Meta.admin.pin = pin;
      toast('관리자 PIN을 바꿨어요');
    }
    Meta.saveAdmin();
    Meta.refresh();
    return true;
  }

  /* ───────────── 퀴즈 ───────────── */
  const Quiz = {
    subject: 'mixed',
    qs: [],
    idx: 0,
    correct: 0,
    locked: false,
    speakToken: 0,

    open() {
      $('#quiz-setup').hidden = false;
      $('#quiz-play').hidden = true;
      $('#quiz-result').hidden = true;
      $('#quiz-age').textContent = Meta.admin.age + '세';
      openModal('modal-quiz');
    },
    start(subject) {
      this.subject = subject;
      this.qs = makeQuestions(subject, Meta.level());
      this.idx = 0;
      this.correct = 0;
      this.locked = false;
      $('#quiz-setup').hidden = true;
      $('#quiz-result').hidden = true;
      $('#quiz-play').hidden = false;
      this.render();
    },
    render() {
      const q = this.qs[this.idx];
      if (!q) return;
      $('#quiz-prog').textContent = `${this.idx + 1} / ${QUIZ_N}`;
      const dots = $('#quiz-dots');
      dots.innerHTML = '';
      for (let i = 0; i < QUIZ_N; i++) {
        const i2 = document.createElement('i');
        if (i < this.idx) i2.className = this.results && this.results[i] ? 'on' : 'bad';
        else if (i === this.idx) i2.className = 'on';
        dots.appendChild(i2);
      }
      $('#quiz-q').textContent = q.q;
      const speakBtn = $('#quiz-speak');
      speakBtn.hidden = !q.speak;
      const box = $('#quiz-choices');
      box.innerHTML = '';
      q.choices.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = c;
        b.dataset.idx = String(i);
        b.addEventListener('click', () => this.choose(i));
        box.appendChild(b);
      });
      $('#quiz-fb').textContent = '';
      $('#quiz-fb').classList.remove('bad');
      this.locked = false;
      // 새 영어 문제는 자동으로 한 번 읽어 줌
      const token = ++this.speakToken;
      if (q.speak && !Speech.muted()) {
        setTimeout(() => { if (token === this.speakToken) Speech.speak(q.speak); }, 320);
      }
    },
    choose(i) {
      if (this.locked) return;
      const q = this.qs[this.idx];
      if (!q) return;
      this.locked = true;
      if (!this.results) this.results = [];
      const buttons = $$('#quiz-choices button');
      const ok = i === q.answer;
      buttons.forEach((b, bi) => {
        if (bi === q.answer) b.classList.add('ok');
        else if (bi === i && !ok) b.classList.add('no');
        b.disabled = true;
      });
      this.results[this.idx] = ok;
      Stats.addQuiz(ok);
      if (ok) {
        this.correct++;
        $('#quiz-fb').textContent = '정답이에요! 👏';
        $('#quiz-fb').classList.remove('bad');
        if (q.speak && !Speech.muted()) {
          this.speakToken++;
          setTimeout(() => Speech.speak(q.speak), 160);
        }
      } else {
        $('#quiz-fb').textContent = '아쉬워요, 다시 기억해 봐요';
        $('#quiz-fb').classList.add('bad');
      }
      setTimeout(() => {
        this.idx++;
        if (this.idx >= QUIZ_N) this.finish();
        else this.render();
      }, ok ? 760 : 1100);
    },
    finish() {
      $('#quiz-play').hidden = true;
      $('#quiz-result').hidden = false;
      const all = this.correct === QUIZ_N;
      $('#quiz-emoji').textContent = all ? '🎉' : '😢';
      $('#quiz-result-title').textContent = all ? '5문제 모두 정답!' : `${QUIZ_N}문제 중 ${this.correct}문제 정답`;
      const msg = $('#quiz-result-msg');
      const doneBtn = $('#btn-quiz-done');
      const retryBtn = $('#btn-quiz-retry');
      if (all) {
        Meta.addPlay(1);
        Stats.addCharge();
        const left = Meta.remaining();
        msg.innerHTML = `<b>오늘 플레이 +1회 충전!</b><br>이제 ${left}회 남았어요.`;
        doneBtn.hidden = false;
        retryBtn.hidden = true;
        toast('📚 5문제 정답! 플레이 +1회 충전됐어요');
      } else {
        msg.innerHTML = '5문제를 <b>모두</b> 맞혀야 1회가 충전돼요.<br>다시 도전해 볼까요?';
        doneBtn.hidden = true;
        retryBtn.hidden = false;
      }
      this.results = [];
    },
    retry() {
      $('#quiz-result').hidden = true;
      this.start(this.subject);
    },
  };

  /* ───────────── 이벤트 연결 ───────────── */
  function wire() {
    Meta.load();
    Stats.load();
    Meta.refresh();

    $('#btn-plays').addEventListener('click', () => {
      const left = Meta.remaining();
      if (left > 0) toast(`오늘 ${left}회 남았어요 🎮`);
      else promptCharge();
    });
    $('#btn-admin').addEventListener('click', () => openPin());

    $$('[data-close]').forEach((b) => b.addEventListener('click', () => closeModal('modal-' + b.dataset.close)));
    $$('.modal').forEach((m) => {
      m.addEventListener('click', (e) => { if (e.target === m) closeModal(m.id); });
    });

    // PIN
    $('#btn-pin-ok').addEventListener('click', tryPin);
    $('#pin-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tryPin(); } });

    // 관리자 설정
    $$('[data-step]').forEach((b) => b.addEventListener('click', () => {
      Meta.admin.base = clampInt(Meta.admin.base + parseInt(b.dataset.step, 10), 1, 20, 3);
      Meta.saveAdmin();
      renderAdmin();
      Meta.refresh();
    }));
    $$('[data-age]').forEach((b) => b.addEventListener('click', () => {
      Meta.admin.age = clampInt(Meta.admin.age + parseInt(b.dataset.age, 10), AGE_MIN, AGE_MAX, 10);
      Meta.saveAdmin();
      renderAdmin();
      Meta.refresh();
    }));
    $('#adm-reset').addEventListener('click', () => {
      Meta.resetToday();
      renderAdmin();
      toast('오늘 횟수를 초기화했어요');
    });
    $('#adm-plus').addEventListener('click', () => {
      Meta.addPlay(1);
      renderAdmin();
      toast('오늘 플레이 +1회 추가!');
    });
    $('#adm-stats-export').addEventListener('click', async () => {
      const json = window.CoaGameStats.export();
      let ok = false;
      try { await navigator.clipboard.writeText(json); ok = true; } catch (e) {}
      if (!ok) {
        try {
          const ta = document.createElement('textarea');
          ta.value = json;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          ok = true;
        } catch (e) {}
      }
      toast(ok ? '활동 기록 JSON을 복사했어요 📋' : '복사가 막혔어요 · CoaGameStats.export() 로 꺼낼 수 있어요');
    });
    $('#adm-save').addEventListener('click', () => {
      if (saveAdmin()) { closeModal('modal-admin'); toast('관리자 설정을 저장했어요'); }
    });

    // 퀴즈
    $$('[data-subject]').forEach((b) => b.addEventListener('click', () => Quiz.start(b.dataset.subject)));
    $('#btn-quiz-start').addEventListener('click', () => Quiz.open());
    $('#btn-quiz-over').addEventListener('click', () => Quiz.open());
    $('#btn-quiz-retry').addEventListener('click', () => Quiz.retry());
    $('#btn-quiz-done').addEventListener('click', () => {
      closeModal('modal-quiz');
      if (typeof window.__coaStart === 'function') window.__coaStart();
    });
    $('#quiz-speak').addEventListener('click', () => {
      const q = Quiz.qs[Quiz.idx];
      if (!q || !q.speak) return;
      if (!Speech.supported) { toast('이 브라우저는 발음 듣기를 지원하지 않아요'); return; }
      const played = Speech.speak(q.speak);
      if (!played) toast('발음을 재생할 수 없어요');
    });

    window.addEventListener('storage', (e) => { if (e.key === KEY_PLAYS || e.key === KEY_ADMIN) { Meta.load(); Meta.refresh(); } });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $$('.modal').some((m) => !m.hidden)) {
        e.stopPropagation();
        closeAllModals();
      }
    }, true);
  }

  function promptCharge() {
    toast('오늘 횟수를 다 썼어요! 문제를 풀고 +1회 받아요 📚');
    Quiz.open();
  }

  /* ───────────── 공개 API ───────────── */
  window.CoaMeta = {
    ready: true,
    state() {
      return {
        date: Meta.plays.date,
        used: Meta.plays.used,
        bonus: Meta.plays.bonus,
        base: Meta.admin.base,
        remaining: Meta.remaining(),
        total: Meta.total(),
        age: Meta.admin.age,
        level: Meta.level(),
        pin: Meta.admin.pin,
      };
    },
    remaining: () => Meta.remaining(),
    total: () => Meta.total(),
    consumePlay: () => Meta.consumePlay(),
    addPlay: (n) => Meta.addPlay(n),
    resetToday: () => Meta.resetToday(),
    refresh: () => Meta.refresh(),
    promptCharge,
    openQuiz: () => Quiz.open(),
    recordGame: (score, round) => { Stats.recordGame(score, round); if ($('#modal-admin') && !$('#modal-admin').hidden) renderStats(); },
    stats: () => window.CoaGameStats.get(),
    openAdmin: () => openAdmin(),
    openPin: () => openPin(),
    closeModals: closeAllModals,
    toast,
    quiz() {
      const q = Quiz.qs[Quiz.idx];
      return {
        active: !$('#modal-quiz').hidden,
        idx: Quiz.idx,
        correct: Quiz.correct,
        question: q ? { q: q.q, choices: q.choices.slice(), answer: q.answer, speak: q.speak || null, subject: q.subject } : null,
      };
    },
    speech: {
      supported: Speech.supported,
      speak: (t) => Speech.speak(t),
    },
  };

  window.CoaGameStats = {
    app: 'coa-tetris',
    version: 1,
    today: () => Stats.view(todayStr()),
    week: (n) => Stats.week(n || 7),
    all: () => Stats.all(),
    totals: () => Stats.totals(),
    day: (dateStr) => Stats.view(dateStr || todayStr()),
    get() {
      return {
        app: 'coa-tetris',
        version: 1,
        updatedAt: new Date().toISOString(),
        child: { age: Meta.admin.age, level: Meta.level() },
        today: this.today(),
        week: this.week(7),
        totals: this.totals(),
      };
    },
    export() { return JSON.stringify(this.get(), null, 2); },
    reload() { Stats.load(); return this.get(); },
  };

  if (DEBUG) {
    window.CoaMeta._debug = {
      setPlays(obj) {
        if (obj.date) Meta.plays.date = obj.date;
        if (typeof obj.used === 'number') Meta.plays.used = obj.used;
        if (typeof obj.bonus === 'number') Meta.plays.bonus = obj.bonus;
        Meta.savePlays();
        Meta.refresh();
        return window.CoaMeta.state();
      },
      setAdmin(obj) {
        Object.assign(Meta.admin, obj);
        Meta.saveAdmin();
        Meta.refresh();
        return window.CoaMeta.state();
      },
      setStats(days) {
        Stats.days = {};
        Object.keys(days || {}).forEach((k) => { Stats.days[k] = Stats.norm(days[k]); });
        Stats.save();
        renderStats();
        return window.CoaGameStats.get();
      },
      makeQuestions: (subject, level) => makeQuestions(subject, level),
      quiz: () => window.CoaMeta.quiz(),
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wire);
  } else {
    wire();
  }
})();
