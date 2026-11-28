/* ============================================================
   🃏 그림·영단어 짝 맞추기
   - 라운드마다 카드 증가 (3×4 → 4×4 → 4×5)
   - 카드를 뒤집으면 영어 단어를 원어민 발음으로 읽어 줌
   - 콤보 점수 · 제한 시간 · 별점 · 최고 기록
   ============================================================ */
(function () {
  'use strict';

  var ROUNDS = [
    { cols: 3, rows: 4, time: 70 },
    { cols: 4, rows: 4, time: 85 },
    { cols: 4, rows: 5, time: 100 }
  ];

  var grid, elRound, elScore, elCombo, elTime, elFill, elHud;
  var state = 'idle';               // idle | playing | check | clear | over
  var round = 0;
  var score = 0;
  var combo = 1;
  var maxCombo = 1;
  var deck = [];
  var flipped = [];
  var lock = false;
  var misses = 0;
  var matches = 0;
  var timeLeft = 0;
  var roundTime = 0;
  var timer = null;
  var lastTickSec = -1;
  var cardsEls = [];
  var best = 0;
  var starting = false;
  var registered = false;

  function $(id) { return document.getElementById(id); }
  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function init() {
    grid = $('mtGrid');
    elRound = $('mtRound');
    elScore = $('mtScore');
    elCombo = $('mtCombo');
    elTime = $('mtTime');
    elFill = $('mtTimeFill');
    elHud = document.querySelector('.hud-mt');
    best = window.Store ? Store.best('match') : 0;
    window.addEventListener('resize', layoutCards);
    updateIdleNote();
  }

  function band() {
    return window.Store ? Store.ageBand(Store.settings().age) : 0;
  }

  /* ---------------- 시작 ---------------- */
  function start() {
    if (starting) return;
    starting = true;
    state = 'playing';
    round = 0;
    score = 0;
    maxCombo = 1;
    registered = false;
    hideOverlays();
    if (window.GameStats) GameStats.recordPlay('match');
    buildRound(0);
    if (window.Sfx) Sfx.start();
    starting = false;
  }

  function buildRound(idx) {
    round = idx;
    var cfg = ROUNDS[idx];
    var pairs = (cfg.cols * cfg.rows) / 2;
    var words = window.Words.pickPairs(band(), pairs);

    deck = [];
    words.forEach(function (w, i) {
      deck.push({ pair: i, type: 'pic', word: w, matched: false, flipped: false });
      deck.push({ pair: i, type: 'word', word: w, matched: false, flipped: false });
    });
    deck = window.Words.shuffle(deck);

    flipped = [];
    lock = false;
    misses = 0;
    matches = 0;
    combo = 1;
    roundTime = cfg.time;
    timeLeft = cfg.time;
    lastTickSec = -1;

    renderGrid(cfg);
    updateScore();
    updateTime();
    var ov = $('mtOverlay');
    if (ov) ov.hidden = false;
    var rc = $('mtRoundClear');
    if (rc) rc.hidden = true;
    var go = $('mtGameover');
    if (go) go.hidden = true;
    // 시작 카운트다운 느낌
    setTimeout(function () {
      var o = $('mtOverlay');
      if (o) o.hidden = true;
      startTimer();
    }, 520);
  }

  function renderGrid(cfg) {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(' + cfg.cols + ', minmax(0, 1fr))';
    grid.style.gridTemplateRows = 'repeat(' + cfg.rows + ', minmax(0, 1fr))';
    cardsEls = [];

    deck.forEach(function (card, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card';
      btn.dataset.idx = String(i);
      btn.setAttribute('aria-label', '카드 ' + (i + 1));
      var inner = document.createElement('div');
      inner.className = 'card-inner';

      var back = document.createElement('div');
      back.className = 'card-face card-back';
      back.textContent = '?';

      var front = document.createElement('div');
      front.className = 'card-face card-front ' + (card.type === 'pic' ? 'pic' : 'word');
      if (card.type === 'pic') {
        var em = document.createElement('span');
        em.className = 'emoji';
        em.textContent = card.word.emoji;
        var ko = document.createElement('span');
        ko.className = 'ko';
        ko.textContent = card.word.ko;
        front.appendChild(em);
        front.appendChild(ko);
      } else {
        var en = document.createElement('span');
        en.className = 'en';
        en.textContent = card.word.en;
        en.dataset.len = String(card.word.en.length);
        front.appendChild(en);
      }

      inner.appendChild(back);
      inner.appendChild(front);
      btn.appendChild(inner);
      btn.addEventListener('click', function () { onCard(i); });
      grid.appendChild(btn);
      cardsEls.push(btn);
    });

    layoutCards();
  }

  function layoutCards() {
    if (!grid || !cardsEls.length) return;
    var cols = ROUNDS[round] ? ROUNDS[round].cols : 3;
    var cardW = (grid.clientWidth - (cols - 1) * 6) / cols;
    cardsEls.forEach(function (el) {
      var en = el.querySelector('.en');
      if (!en) return;
      var len = Number(en.dataset.len) || 5;
      var size = Math.max(8.5, Math.min(19, (cardW - 8) / (len * 0.56)));
      en.style.fontSize = size.toFixed(1) + 'px';
      var em = el.querySelector('.emoji');
      if (em) em.style.fontSize = Math.max(18, Math.min(46, cardW * 0.5)) + 'px';
    });
  }

  /* ---------------- 카드 뒤집기 ---------------- */
  function onCard(i) {
    if (state !== 'playing' || lock) return;
    var card = deck[i];
    if (!card || card.matched || card.flipped) return;

    card.flipped = true;
    var el = cardsEls[i];
    el.classList.add('is-flipped');
    if (window.Sfx) Sfx.flip();

    // 영어 단어를 들려준다 (음소거가 아니면)
    if (window.Speech) Speech.auto(card.word.en);

    flipped.push(i);
    if (flipped.length === 2) {
      lock = true;
      state = 'check';
      setTimeout(checkPair, 480);
    }
  }

  function checkPair() {
    var i = flipped[0];
    var j = flipped[1];
    var a = deck[i];
    var b = deck[j];
    if (!a || !b) { resetFlip(); return; }

    if (a.pair === b.pair) {
      a.matched = b.matched = true;
      cardsEls[i].classList.add('is-matched');
      cardsEls[j].classList.add('is-matched');
      cardsEls[i].classList.add('is-locked');
      cardsEls[j].classList.add('is-locked');
      matches += 1;

      var gain = 100 * Math.min(5, combo);
      score += gain;
      maxCombo = Math.max(maxCombo, combo);
      combo += 1;

      // 매치 보너스 시간
      timeLeft = Math.min(roundTime, timeLeft + 2);

      if (window.Sfx) Sfx.match(combo - 1);
      if (window.Speech) Speech.auto(a.word.en);
      showFloat(cardsEls[j], '+' + gain);

      updateScore();
      updateTime();
      syncLiveScore();
      flipped = [];
      lock = false;
      state = 'playing';

      if (matches === deck.length / 2) clearRound();
    } else {
      misses += 1;
      combo = 1;
      cardsEls[i].classList.add('is-wrong');
      cardsEls[j].classList.add('is-wrong');
      if (window.Sfx) Sfx.wrong();
      setTimeout(function () {
        cardsEls[i].classList.remove('is-wrong');
        cardsEls[j].classList.remove('is-wrong');
        resetFlip();
      }, 520);
      updateScore();
    }
  }

  function resetFlip() {
    flipped.forEach(function (idx) {
      deck[idx].flipped = false;
      cardsEls[idx].classList.remove('is-flipped');
    });
    flipped = [];
    lock = false;
    state = 'playing';
  }

  function showFloat(el, text) {
    if (!el) return;
    var r = el.getBoundingClientRect();
    var f = document.createElement('div');
    f.className = 'float-gain';
    f.textContent = text;
    f.style.left = (r.right - 18) + 'px';
    f.style.top = (r.top + 18) + 'px';
    document.body.appendChild(f);
    setTimeout(function () { f.remove(); }, 800);
  }

  /** 판이 끝나기 전에도 최고 점수를 바로 반영 */
  function syncLiveScore() {
    if (score > best) {
      best = score;
      if (window.Store) Store.setBest('match', score);
    }
    if (window.GameStats) GameStats.recordScore('match', score);
  }

  /* ---------------- 시간 ---------------- */
  function startTimer() {
    stopTimer();
    timer = setInterval(function () {
      if (state !== 'playing' && state !== 'check') return;
      timeLeft = Math.max(0, timeLeft - 0.2);
      updateTime();
      var sec = Math.ceil(timeLeft);
      if (sec <= 5 && sec > 0 && sec !== lastTickSec) {
        lastTickSec = sec;
        if (window.Sfx) Sfx.tick();
      }
      if (timeLeft <= 0) gameOver();
    }, 200);
  }
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function updateTime() {
    if (elTime) elTime.textContent = String(Math.ceil(timeLeft));
    if (elFill) elFill.style.width = Math.max(0, Math.min(100, (timeLeft / roundTime) * 100)) + '%';
    var bar = elFill ? elFill.parentElement : null;
    if (bar) bar.classList.toggle('is-low', timeLeft <= Math.min(12, roundTime * 0.25));
    if (elHud) elHud.classList.toggle('is-low', timeLeft <= 10);
  }

  function updateScore() {
    if (elRound) elRound.textContent = String(round + 1);
    if (elScore) elScore.textContent = score.toLocaleString('ko-KR');
    if (elCombo) elCombo.textContent = 'x' + Math.min(5, combo);
  }

  /* ---------------- 라운드 클리어 / 종료 ---------------- */
  function clearRound() {
    state = 'clear';
    stopTimer();
    if (window.Sfx) Sfx.win();
    if (window.GameStats) GameStats.recordMatchClear();
    var stars = misses === 0 ? 3 : (misses <= 2 ? 2 : 1);
    var starEl = $('mtStars');
    if (starEl) {
      starEl.innerHTML = '';
      for (var i = 0; i < 3; i++) {
        var s = document.createElement('span');
        s.textContent = '★';
        if (i >= stars) s.className = 'off';
        starEl.appendChild(s);
      }
    }
    var isLast = round >= ROUNDS.length - 1;
    finish('clear');
    if (isLast) registerScoreOnce();
    var title = $('mtClearTitle');
    var note = $('mtClearNote');
    var nextBtn = $('mtNextBtn');
    var homeBtn = $('mtClearHomeBtn');
    if (isLast) {
      if (title) title.textContent = '모두 클리어! 🏆';
      if (note) note.textContent = '3라운드를 모두 깼어요 · 점수 ' + score.toLocaleString('ko-KR') + '점';
      if (nextBtn) nextBtn.textContent = '한 번 더 놀기';
      if (homeBtn) homeBtn.hidden = false;
      finish('clear');
    } else {
      if (title) title.textContent = (round + 1) + '라운드 클리어!';
      if (note) note.textContent = '다음 라운드는 카드가 더 많아져요';
      if (nextBtn) nextBtn.textContent = '다음 라운드';
      if (homeBtn) homeBtn.hidden = true;
      if (window.Confetti) window.Confetti(18);
    }
    var rc = $('mtRoundClear');
    if (rc) rc.hidden = false;
  }

  function nextRound() {
    if (state !== 'clear') return;
    if (round >= ROUNDS.length - 1) {
      // 이미 끝난 판 → 앱에 새 판 요청 (거절되면 클리어 화면 유지)
      if (window.App && App.requestStart) App.requestStart('matching');
      return;
    }
    var rc = $('mtRoundClear');
    if (rc) rc.hidden = true;
    state = 'playing';
    buildRound(round + 1);
  }

  function gameOver() {
    if (state === 'over') return;
    state = 'over';
    stopTimer();
    if (window.Sfx) Sfx.over();
    finish('timeout');
    registerScoreOnce();
    var fs = $('mtFinalScore');
    var bn = $('mtBestNote');
    if (fs) fs.textContent = score.toLocaleString('ko-KR');
    if (bn) bn.textContent = '최고 기록 ' + best.toLocaleString('ko-KR') + '점';
    var go = $('mtGameover');
    if (go) go.hidden = false;
  }

  function finish(kind) {
    best = Math.max(best, score);
    if (window.Store) Store.setBest('match', score);
    if (window.GameStats) GameStats.recordScore('match', score);
  }

  /** 랭킹에는 판당 한 번만 등록 */
  function registerScoreOnce() {
    if (registered) return;
    registered = true;
    if (score > 0 && window.App && App.registerScore) App.registerScore('match', score);
  }

  function stop() { stopTimer(); }
  function resume() {
    if (state === 'playing' || state === 'check') {
      if (!timer) startTimer();
    }
  }

  function toIdle() {
    state = 'idle';
    registerScoreOnce();
    stopTimer();
    var go = $('mtGameover');
    if (go) go.hidden = true;
    var rc = $('mtRoundClear');
    if (rc) rc.hidden = true;
    var ov = $('mtOverlay');
    if (ov) ov.hidden = false;
    if (grid) grid.innerHTML = '';
    cardsEls = [];
    updateIdleNote();
  }

  function updateIdleNote() {
    var left = window.Store ? Store.remaining() : 0;
    var n = $('mtOverlayNote');
    if (n) n.textContent = left > 0 ? ('오늘 남은 횟수 ' + left + '회') : '오늘 횟수를 다 썼어요 · 문제를 풀면 +1회';
    var btn = $('mtStartBtn');
    if (btn) btn.disabled = false;
  }

  function hideOverlays() {
    ['mtOverlay', 'mtRoundClear', 'mtGameover'].forEach(function (id) {
      var el = $(id);
      if (el) el.hidden = true;
    });
  }

  window.Matching = {
    init: init,
    start: start,
    toIdle: toIdle,
    nextRound: nextRound,
    stop: function () { stopTimer(); },
    resume: resume,
    updateIdleNote: updateIdleNote,
    isPlaying: function () { return state !== 'idle'; },
    _state: function () {
      return {
        state: state, round: round, score: score, combo: combo,
        matches: matches, timeLeft: Math.round(timeLeft * 10) / 10,
        cards: deck.length, flipped: flipped.slice()
      };
    },
    _flip: function (i) { onCard(i); },
    _forceTime: function (t) { timeLeft = t; updateTime(); },
    _deck: function () {
      return deck.map(function (c, i) { return { i: i, pair: c.pair, type: c.type, en: c.word.en, ko: c.word.ko, matched: c.matched }; });
    }
  };
})();
