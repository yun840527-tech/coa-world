/* ============================================================
   활동 기록 (localStorage)
   - 게임별 하루 플레이 횟수 · 최고 점수
   - 영어/수학 문제 푼 수 · 정답 수
   - 퀴즈로 충전한 횟수
   가족 앱(솜이쭈니)에서 읽어 갈 수 있도록 window.CoaGameStats 제공
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'coa-arcade-stats-v1';
  var MAX_DAYS = 60;
  var VERSION = 1;

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function addDays(key, delta) {
    var p = key.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    d.setDate(d.getDate() + delta);
    return dateKey(d);
  }
  function emptyDay() {
    return {
      wm: { plays: 0, best: 0, merges: 0 },
      mt: { plays: 0, best: 0, clears: 0 },
      quiz: { en: { ask: 0, ok: 0 }, ma: { ask: 0, ok: 0 }, bonus: 0 }
    };
  }
  function normalizeDay(raw) {
    var d = emptyDay();
    if (!raw || typeof raw !== 'object') return d;
    ['plays', 'best', 'merges'].forEach(function (k) {
      if (raw.wm && Number.isFinite(+raw.wm[k])) d.wm[k] = +raw.wm[k];
    });
    ['plays', 'best', 'clears'].forEach(function (k) {
      if (raw.mt && Number.isFinite(+raw.mt[k])) d.mt[k] = +raw.mt[k];
    });
    ['en', 'ma'].forEach(function (k) {
      if (raw.quiz && raw.quiz[k]) {
        if (Number.isFinite(+raw.quiz[k].ask)) d.quiz[k].ask = +raw.quiz[k].ask;
        if (Number.isFinite(+raw.quiz[k].ok)) d.quiz[k].ok = +raw.quiz[k].ok;
      }
    });
    if (raw.quiz && Number.isFinite(+raw.quiz.bonus)) d.quiz.bonus = +raw.quiz.bonus;
    return d;
  }

  var data;
  try {
    data = JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch (e) { data = null; }
  if (!data || typeof data !== 'object' || !data.days) data = { v: VERSION, days: {} };
  if (!data.days || typeof data.days !== 'object') data.days = {};

  function save() {
    // 최근 MAX_DAYS일만 남긴다
    var keys = Object.keys(data.days).sort();
    while (keys.length > MAX_DAYS) {
      delete data.days[keys.shift()];
    }
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 저장 공간 부족 등은 조용히 무시 */ }
  }

  function day(key, create) {
    key = key || dateKey();
    if (!data.days[key] && create) data.days[key] = emptyDay();
    return data.days[key] ? normalizeDay(data.days[key]) : emptyDay();
  }
  function mutate(key, fn) {
    key = key || dateKey();
    if (!data.days[key]) data.days[key] = emptyDay();
    var d = normalizeDay(data.days[key]);
    fn(d);
    data.days[key] = d;
    data.updatedAt = new Date().toISOString();
    save();
    try {
      window.dispatchEvent(new CustomEvent('coa:stats-updated', { detail: { date: key } }));
    } catch (e) { /* 구형 브라우저 무시 */ }
    return d;
  }

  function rate(ok, ask) {
    return ask > 0 ? Math.round((ok / ask) * 1000) / 10 : 0;
  }

  var api = {
    KEY: KEY,
    VERSION: VERSION,

    todayKey: function () { return dateKey(); },

    /** 게임을 실제로 시작했을 때(횟수 차감 후) 호출 */
    recordPlay: function (game) {
      return mutate(null, function (d) {
        if (game === 'watermelon') d.wm.plays += 1;
        else if (game === 'match') d.mt.plays += 1;
      });
    },

    /** 게임이 끝났을 때 점수 기록 (최고 점수 갱신) */
    recordScore: function (game, score) {
      var s = Math.max(0, Math.round(score || 0));
      return mutate(null, function (d) {
        if (game === 'watermelon') d.wm.best = Math.max(d.wm.best, s);
        else if (game === 'match') d.mt.best = Math.max(d.mt.best, s);
      });
    },

    recordMerge: function (count) {
      return mutate(null, function (d) { d.wm.merges += Math.max(0, count || 1); });
    },

    recordMatchClear: function () {
      return mutate(null, function (d) { d.mt.clears += 1; });
    },

    /** kind: 'en' | 'ma' */
    recordQuizAsk: function (kind) {
      return mutate(null, function (d) {
        if (d.quiz[kind]) d.quiz[kind].ask += 1;
      });
    },
    recordQuizCorrect: function (kind) {
      return mutate(null, function (d) {
        if (d.quiz[kind]) d.quiz[kind].ok += 1;
      });
    },
    recordQuizBonus: function () {
      return mutate(null, function (d) { d.quiz.bonus += 1; });
    },

    getDay: function (key) {
      var d = day(key || dateKey(), false);
      return {
        date: key || dateKey(),
        watermelon: { plays: d.wm.plays, bestScore: d.wm.best, merges: d.wm.merges },
        match: { plays: d.mt.plays, bestScore: d.mt.best, clears: d.mt.clears },
        quiz: {
          english: { asked: d.quiz.en.ask, correct: d.quiz.en.ok, accuracy: rate(d.quiz.en.ok, d.quiz.en.ask) },
          math: { asked: d.quiz.ma.ask, correct: d.quiz.ma.ok, accuracy: rate(d.quiz.ma.ok, d.quiz.ma.ask) },
          asked: d.quiz.en.ask + d.quiz.ma.ask,
          correct: d.quiz.en.ok + d.quiz.ma.ok,
          accuracy: rate(d.quiz.en.ok + d.quiz.ma.ok, d.quiz.en.ask + d.quiz.ma.ask),
          bonuses: d.quiz.bonus
        }
      };
    },

    /** 최근 n일(오늘 포함) 요약 */
    summary: function (n) {
      n = n || 7;
      var today = dateKey();
      var days = [];
      for (var i = 0; i < n; i++) days.push(api.getDay(addDays(today, -i)));
      var t = {
        days: n,
        watermelonPlays: 0, watermelonBest: 0,
        matchPlays: 0, matchBest: 0,
        quizAsked: 0, quizCorrect: 0, quizAccuracy: 0,
        quizEnglishAsked: 0, quizEnglishCorrect: 0,
        quizMathAsked: 0, quizMathCorrect: 0,
        quizBonuses: 0
      };
      days.forEach(function (d) {
        t.watermelonPlays += d.watermelon.plays;
        t.watermelonBest = Math.max(t.watermelonBest, d.watermelon.bestScore);
        t.matchPlays += d.match.plays;
        t.matchBest = Math.max(t.matchBest, d.match.bestScore);
        t.quizAsked += d.quiz.asked;
        t.quizCorrect += d.quiz.correct;
        t.quizEnglishAsked += d.quiz.english.asked;
        t.quizEnglishCorrect += d.quiz.english.correct;
        t.quizMathAsked += d.quiz.math.asked;
        t.quizMathCorrect += d.quiz.math.correct;
        t.quizBonuses += d.quiz.bonuses;
      });
      t.quizAccuracy = rate(t.quizCorrect, t.quizAsked);
      return { days: days, totals: t };
    },

    /** 가족 앱 연동용 깔끔한 JSON */
    exportObject: function (opts) {
      opts = opts || {};
      var n = opts.days || 7;
      var sum = api.summary(n);
      var today = api.getDay();
      var child = opts.child || null;
      var rankings = { watermelon: [], match: [] };
      try {
        if (window.Ranking) rankings = window.Ranking.all();
      } catch (e) { /* noop */ }
      return {
        app: 'coa-arcade',
        version: VERSION,
        generatedAt: new Date().toISOString(),
        timezone: 'Asia/Seoul',
        today: today.date,
        child: child,
        totals: sum.totals,
        todaySummary: {
          watermelonPlays: today.watermelon.plays,
          watermelonBestScore: today.watermelon.bestScore,
          matchPlays: today.match.plays,
          matchBestScore: today.match.bestScore,
          quizAsked: today.quiz.asked,
          quizCorrect: today.quiz.correct,
          quizAccuracy: today.quiz.accuracy,
          quizBonuses: today.quiz.bonuses
        },
        rankings: rankings,
        days: sum.days
      };
    },

    exportJSON: function (opts) {
      return JSON.stringify(api.exportObject(opts), null, 2);
    },

    clearAll: function () {
      data = { v: VERSION, days: {} };
      save();
      try {
        window.dispatchEvent(new CustomEvent('coa:stats-updated', { detail: { date: dateKey(), cleared: true } }));
      } catch (e) { /* noop */ }
    }
  };

  window.GameStats = api;

  /* ---- 가족 앱(솜이쭈니) 연동용 공개 API ---- */
  window.CoaGameStats = Object.freeze({
    app: 'coa-arcade',
    version: VERSION,
    /** 전체 활동 기록(일별 원본 + 7일 합계) */
    get: function (opts) {
      var child = null;
      try {
        if (window.Store && window.Store.settings) {
          var age = window.Store.settings().age;
          child = { age: age, ageBand: window.Store.ageBand ? window.Store.ageBand(age) : null };
        }
      } catch (e) { /* noop */ }
      var o = api.exportObject({ days: (opts && opts.days) || 7, child: child });
      try { o.player = window.Store ? window.Store.player() : null; } catch (e) { o.player = null; }
      return o;
    },
    /** JSON 문자열 */
    toJSON: function (opts) { return JSON.stringify(window.CoaGameStats.get(opts), null, 2); },
    /** 파일로 저장 */
    download: function (opts) { return downloadJSON(opts); },
    /** 현재 화면의 설정·상태 요약(읽기 전용) */
    snapshot: function () {
      var left = null, daily = null;
      try {
        if (window.Store) { left = window.Store.remaining(); daily = window.Store.settings().daily; }
      } catch (e) { /* noop */ }
      return { remainingPlays: left, dailyPlays: daily, player: window.Store ? window.Store.player() : null, stats: window.CoaGameStats.get() };
    }
  });

  function downloadJSON(opts) {
    var text = api.exportJSON({
      days: (opts && opts.days) || 30,
      child: (function () {
        try {
          var age = window.Store.settings().age;
          return { age: age, ageBand: window.Store.ageBand(age) };
        } catch (e) { return null; }
      })()
    });
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'coa-arcade-stats-' + dateKey() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    return text;
  }
  window.CoaGameStatsDownload = downloadJSON;

  window.CoaGameStatsDateKey = dateKey;
})();
