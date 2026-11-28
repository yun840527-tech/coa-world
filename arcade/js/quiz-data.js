/* ============================================================
   문제 출제 — 나이대(4단계)에 맞춘 영어·수학
   ============================================================ */
(function () {
  'use strict';

  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function numChoices(answer, spread) {
    var set = new Set([answer]);
    var guard = 0;
    var deltas = [1, -1, 2, -2, 3, -3, 10, -10, 5, -5];
    while (set.size < 4 && guard++ < 80) {
      var d = pick(deltas) * (Math.random() < 0.5 ? 1 : 1);
      var v = answer + d;
      if (v >= 0 && v !== answer) set.add(v);
      if (guard > 40) set.add(answer + set.size * 2);
    }
    var arr = [];
    set.forEach(function (v) { arr.push(v); });
    arr = shuffle(arr).slice(0, 4);
    if (arr.indexOf(answer) < 0) arr[0] = answer;
    return shuffle(arr).map(function (v) {
      return { text: String(v), correct: v === answer };
    });
  }

  /* ---------- 영어 ---------- */
  var VOWELS = ['a', 'e', 'i', 'o', 'u'];

  function misspell(word) {
    var out = new Set();
    var tries = 0;
    while (out.size < 3 && tries++ < 60) {
      var w = word.split('');
      var kind = rnd(0, 3);
      if (kind === 0 && w.length > 2) {
        var i = rnd(1, w.length - 2);
        var t = w[i]; w[i] = w[i + 1]; w[i + 1] = t;
      } else if (kind === 1 && w.length > 3) {
        w.splice(rnd(1, w.length - 2), 1);
      } else if (kind === 2 && w.length < 14) {
        var j = rnd(1, w.length - 2);
        w.splice(j, 0, w[j]);
      } else {
        var vi = -1;
        for (var k = 1; k < w.length; k++) {
          if (VOWELS.indexOf(w[k]) >= 0) { vi = k; break; }
        }
        if (vi < 0) continue;
        var nv = pick(VOWELS.filter(function (v) { return v !== w[vi]; }));
        w[vi] = nv;
      }
      var s = w.join('');
      if (s !== word) out.add(s);
    }
    return Array.from(out).slice(0, 3);
  }

  function englishQuestion(band) {
    var pool = window.Words.band(band);
    var answer = pick(pool);
    var type;
    if (band >= 2) type = pick(['pic2en', 'en2ko', 'spell', 'pic2en']);
    else type = pick(['pic2en', 'en2ko']);

    if (type === 'pic2en') {
      var othersEn = window.Words.distractors(band, answer, 3, 'en');
      var choicesEn = shuffle([{ text: answer.en, correct: true }].concat(
        othersEn.map(function (w) { return { text: w.en, correct: false }; })
      ));
      return {
        kind: 'en',
        band: band,
        type: type,
        promptHTML: '<span class="q-emoji">' + answer.emoji + '</span>' + answer.ko +
          '<span class="q-small">이것은 영어로 무엇일까요?</span>',
        speakText: answer.en,
        speakLabel: '영어로 듣기',
        choices: choicesEn,
        answerText: answer.en,
        explain: answer.ko + ' = ' + answer.en
      };
    }

    if (type === 'en2ko') {
      var othersKo = window.Words.distractors(band, answer, 3, 'ko');
      var choicesKo = shuffle([{ text: answer.ko, correct: true }].concat(
        othersKo.map(function (w) { return { text: w.ko, correct: false }; })
      ));
      return {
        kind: 'en',
        band: band,
        type: type,
        promptHTML: '<span class="q-en">' + answer.en + '</span>' +
          '<span class="q-small">이 단어의 뜻은 무엇일까요?</span>',
        speakText: answer.en,
        speakLabel: '발음 듣기',
        choices: choicesKo,
        answerText: answer.ko,
        explain: answer.en + ' = ' + answer.ko
      };
    }

    // 철자 고르기
    var wrong = misspell(answer.en);
    var choicesSp = shuffle([{ text: answer.en, correct: true }].concat(
      wrong.map(function (s) { return { text: s, correct: false }; })
    ));
    return {
      kind: 'en',
      band: band,
      type: 'spell',
      promptHTML: '<span class="q-emoji">' + answer.emoji + '</span>' + answer.ko +
        '<span class="q-small">영어 철자로 알맞은 것은?</span>',
      speakText: null,
      choices: choicesSp,
      answerText: answer.en,
      explain: answer.ko + ' = ' + answer.en
    };
  }

  /* ---------- 수학 ---------- */
  function mathQuestion(band) {
    var q;

    if (band === 0) {
      var kind = pick(['add', 'sub', 'story']);
      if (kind === 'add') {
        var a = rnd(1, 5), b = rnd(1, 5);
        q = { text: a + ' + ' + b + ' = ?', answer: a + b };
      } else if (kind === 'sub') {
        var c = rnd(3, 9), d = rnd(1, c - 1);
        q = { text: c + ' − ' + d + ' = ?', answer: c - d };
      } else {
        var e = rnd(2, 5), f = rnd(1, 4);
        q = { text: '🍎 ' + e + '개가 있어요.<br />' + f + '개를 더 받으면 모두 몇 개?', answer: e + f };
      }
      return { kind: 'ma', band: band, type: 'math', promptHTML: q.text, choices: numChoices(q.answer, 4), answerText: String(q.answer), speakText: null, explain: '정답은 ' + q.answer + '이에요' };
    }

    if (band === 1) {
      var k2 = pick(['add', 'sub', 'mul']);
      if (k2 === 'add') {
        var g = rnd(11, 39), h = rnd(5, 19);
        q = { text: g + ' + ' + h + ' = ?', answer: g + h };
      } else if (k2 === 'sub') {
        var i2 = rnd(25, 60), j2 = rnd(6, 19);
        q = { text: i2 + ' − ' + j2 + ' = ?', answer: i2 - j2 };
      } else {
        var m = rnd(2, 9), n = rnd(2, 5);
        q = { text: m + ' × ' + n + ' = ?', answer: m * n };
      }
      return { kind: 'ma', band: band, type: 'math', promptHTML: q.text, choices: numChoices(q.answer, 6), answerText: String(q.answer), speakText: null, explain: '정답은 ' + q.answer + '이에요' };
    }

    if (band === 2) {
      var k3 = pick(['mul', 'div', 'mix', 'blank']);
      if (k3 === 'mul') {
        var p1 = rnd(6, 9), p2 = rnd(4, 9);
        q = { text: p1 + ' × ' + p2 + ' = ?', answer: p1 * p2 };
      } else if (k3 === 'div') {
        var dv = rnd(3, 9), qt = rnd(4, 9);
        q = { text: (dv * qt) + ' ÷ ' + dv + ' = ?', answer: qt };
      } else if (k3 === 'mix') {
        var r1 = rnd(20, 40), r2 = rnd(5, 20), r3 = rnd(3, 15);
        q = { text: r1 + ' + ' + r2 + ' − ' + r3 + ' = ?', answer: r1 + r2 - r3 };
      } else {
        var s1 = rnd(3, 9), s2 = rnd(3, 9);
        q = { text: s1 + ' × ? = ' + (s1 * s2) + '<br />? 에 들어갈 수는?', answer: s2 };
      }
      return { kind: 'ma', band: band, type: 'math', promptHTML: q.text, choices: numChoices(q.answer, 8), answerText: String(q.answer), speakText: null, explain: '정답은 ' + q.answer + '이에요' };
    }

    // band 3
    var k4 = pick(['bigmul', 'div', 'percent', 'paren']);
    if (k4 === 'bigmul') {
      var b1 = rnd(12, 29), b2 = rnd(3, 9);
      q = { text: b1 + ' × ' + b2 + ' = ?', answer: b1 * b2 };
    } else if (k4 === 'div') {
      var dv2 = rnd(4, 9), qt2 = rnd(12, 25);
      q = { text: (dv2 * qt2) + ' ÷ ' + dv2 + ' = ?', answer: qt2 };
    } else if (k4 === 'percent') {
      var base = pick([20, 40, 50, 60, 80, 100, 120]);
      var pct = pick([10, 20, 25, 50]);
      q = { text: base + '의 ' + pct + '%는?', answer: (base * pct) / 100 };
    } else {
      var q1 = rnd(3, 9), q2 = rnd(2, 9), q3 = rnd(2, 6);
      q = { text: '(' + q1 + ' + ' + q2 + ') × ' + q3 + ' = ?', answer: (q1 + q2) * q3 };
    }
    return { kind: 'ma', band: band, type: 'math', promptHTML: q.text, choices: numChoices(q.answer, Math.max(5, Math.round(q.answer * 0.15))), answerText: String(q.answer), speakText: null, explain: '정답은 ' + q.answer + '이에요' };
  }

  window.QuizData = {
    /** kind 를 번갈아 섞어 5문제 만들기 */
    makeSet: function (band, count) {
      band = Math.max(0, Math.min(3, Number(band) || 0));
      count = count || 5;
      var out = [];
      for (var i = 0; i < count; i++) {
        var kind = (i % 2 === 0) ? 'en' : 'ma';
        if (Math.random() < 0.25) kind = kind === 'en' ? 'ma' : 'en';
        out.push(kind === 'en' ? englishQuestion(band) : mathQuestion(band));
      }
      // 최소 2개는 영어, 2개는 수학이 되도록 보정
      var en = out.filter(function (q) { return q.kind === 'en'; }).length;
      if (en < 2) return this.makeSet(band, count);
      if (en > count - 2) return this.makeSet(band, count);
      return out;
    },
    english: englishQuestion,
    math: mathQuestion
  };
})();
