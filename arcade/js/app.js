/* ============================================================
   앱 부트스트랩 — 탭·횟수·관리자·퀴즈·토스트·컨페티
   ============================================================ */
(function () {
  'use strict';

  var currentTab = 'watermelon';
  var adminUnlocked = false;
  var pinBuf = '';
  var newPinBuf = '';
  var pinStep = 1;
  var toastTimer = null;
  var lastEntry = { watermelon: null, match: null };
  var rankGame = 'watermelon';

  function $(id) { return document.getElementById(id); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  var App = {};

  /* ---------------- 플레이어 & 랭킹 ---------------- */
  function playerNames() {
    var cur = window.Store ? Store.player() : '솜이';
    var names = (window.Ranking ? Ranking.players : ['솜이', '쭈니', '엄마', '아빠']).slice();
    if (names.indexOf(cur) < 0) names.push(cur);
    return { names: names, current: cur };
  }

  function renderPlayers() {
    if (!window.Store) return;
    var p = playerNames();
    Array.prototype.forEach.call(document.querySelectorAll('[data-picker]'), function (box) {
      box.innerHTML = '';
      p.names.forEach(function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.dataset.name = n;
        b.textContent = n;
        if (n === p.current) b.className = 'is-on';
        b.addEventListener('click', function () { selectPlayer(n); });
        box.appendChild(b);
      });
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'chip-add';
      add.textContent = '✏️ 직접';
      add.addEventListener('click', openPlayerSheet);
      box.appendChild(add);
    });
    ['wmResultPlayer', 'mtResultPlayer'].forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = p.current;
    });
    renderPlayerSheet();
  }

  function renderPlayerSheet() {
    var box = $('playerSheetChips');
    if (!box || !window.Store) return;
    var p = playerNames();
    box.innerHTML = '';
    p.names.forEach(function (n) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.name = n;
      b.textContent = n;
      if (n === p.current) b.className = 'is-on';
      b.addEventListener('click', function () {
        selectPlayer(n);
        hideSheet('playerSheet');
      });
      box.appendChild(b);
    });
  }

  function selectPlayer(name) {
    if (!window.Store) return;
    var nm = Store.setPlayer(name);
    renderPlayers();
    if (window.Sfx) Sfx.tap();
    // 결과 화면에서 바꿨다면 방금 기록의 이름도 바꿔 준다
    ['watermelon', 'match'].forEach(function (g) {
      if (lastEntry[g] && window.Ranking) {
        Ranking.rename(g, lastEntry[g].id, nm);
      }
    });
    var input = $('playerInput');
    if (input) input.value = '';
    Toast('이번엔 ' + nm + '!');
  }

  function openPlayerSheet() {
    hideSheet('limitSheet');
    renderPlayerSheet();
    var s = $('playerSheet');
    if (s) s.hidden = false;
    var input = $('playerInput');
    if (input) setTimeout(function () { input.focus(); }, 120);
  }

  function openRank(game) {
    rankGame = (game === 'match') ? 'match' : 'watermelon';
    hideSheet('limitSheet');
    hideSheet('playerSheet');
    renderRank();
    var s = $('rankSheet');
    if (s) s.hidden = false;
    if (window.Sfx) Sfx.tap();
  }

  function renderRank() {
    var listEl = $('rankList');
    var emptyEl = $('rankEmpty');
    if (!listEl || !window.Ranking) return;
    Array.prototype.forEach.call(document.querySelectorAll('.rank-tab'), function (t) {
      t.classList.toggle('is-on', t.dataset.rank === rankGame);
    });
    var rows = Ranking.top(rankGame, 10);
    listEl.innerHTML = '';
    if (!rows.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;
    var medals = ['🥇', '🥈', '🥉'];
    rows.forEach(function (r) {
      var li = document.createElement('li');
      li.className = 'rank-item r' + r.rank;
      var p = r.date.split('-');
      li.innerHTML =
        '<span class="rank-no">' + (medals[r.rank - 1] || r.rank) + '</span>' +
        '<span class="rank-body"><span class="rank-name">' + escapeHTML(r.name) + '</span>' +
          '<span class="rank-date">' + (p[1] || '') + '/' + (p[2] || '') + ' 기록</span></span>' +
        '<span class="rank-score">' + r.score.toLocaleString('ko-KR') + '<small>점</small></span>';
      listEl.appendChild(li);
    });
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 게임이 끝났을 때 랭킹에 등록 (모듈에서 호출) */
  function registerScore(game, score) {
    if (!window.Ranking || !window.Store) return null;
    var e = Ranking.add(game, Store.player(), score);
    if (e) lastEntry[game] = e;
    return e;
  }
  App.registerScore = registerScore;

  /* ---------------- 토스트 / 컨페티 ---------------- */
  function Toast(msg, ms) {
    var el = $('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('is-on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('is-on'); }, ms || 1900);
  }
  window.Toast = Toast;

  function Confetti(n) {
    var layer = $('confetti');
    if (!layer) return;
    var colors = ['#ffd166', '#ff8fa3', '#6ecf9b', '#7cb8e8', '#ffa23a', '#c9a7f0', '#f2703c'];
    n = n || 26;
    for (var i = 0; i < n; i++) {
      var piece = document.createElement('i');
      piece.className = 'confetti';
      piece.style.left = (Math.random() * 100) + '%';
      piece.style.top = '0';
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.setProperty('--dur', (1.1 + Math.random() * 1.2).toFixed(2) + 's');
      piece.style.setProperty('--delay', (Math.random() * 0.25).toFixed(2) + 's');
      piece.style.setProperty('--drift', (Math.random() * 120 - 60).toFixed(0) + 'px');
      piece.style.setProperty('--spin', (Math.random() * 900 - 200).toFixed(0) + 'deg');
      piece.style.width = (6 + Math.random() * 6).toFixed(0) + 'px';
      piece.style.height = (9 + Math.random() * 8).toFixed(0) + 'px';
      layer.appendChild(piece);
      (function (p) { setTimeout(function () { p.remove(); }, 2800); })(piece);
    }
  }
  window.Confetti = Confetti;

  /* ---------------- 탭 ---------------- */
  function switchTab(name, silent) {
    if (name !== 'watermelon' && name !== 'matching') name = 'watermelon';
    if (!silent && currentTab === name) return;

    // 다른 탭으로 갈 때 진행 중인 게임은 잠시 멈춘다
    if (name !== 'watermelon' && window.Watermelon) Watermelon.pause();
    if (name !== 'matching' && window.Matching) Matching.stop();

    currentTab = name;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      var on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var wm = $('view-watermelon');
    var mt = $('view-matching');
    if (wm) { wm.classList.toggle('is-active', name === 'watermelon'); wm.hidden = name !== 'watermelon'; }
    if (mt) { mt.classList.toggle('is-active', name === 'matching'); mt.hidden = name !== 'matching'; }

    if (name === 'watermelon') {
      if (window.Watermelon) Watermelon.resume();
    } else if (window.Matching) {
      Matching.resume();
    }
    refresh();
  }

  /* ---------------- 횟수 갱신 ---------------- */
  function refresh() {
    var left = window.Store ? Store.remaining() : 0;
    var daily = window.Store ? Store.daily() : 3;
    var pl = $('playsLeft');
    var po = $('playsOf');
    var chip = $('playsChip');
    if (pl) pl.textContent = String(left);
    if (po) po.textContent = '/ ' + daily;
    if (chip) chip.classList.toggle('is-empty', left <= 0);

    if (window.Watermelon) Watermelon.updateIdleNote();
    if (window.Matching) Matching.updateIdleNote();

    var statUsed = $('statUsed');
    var statLeft = $('statLeft');
    if (statUsed) statUsed.textContent = (window.Store ? Store.used() : 0) + '회';
    if (statLeft) statLeft.textContent = left + '회';

    if (adminUnlocked && window.Report) Report.render();
  }
  App.refresh = refresh;

  function updateMuteBtn() {
    var btn = $('btnMute');
    if (!btn) return;
    var muted = window.Store ? Store.settings().muted : false;
    btn.textContent = muted ? '🔇' : '🔊';
    btn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
    btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  /* ---------------- 게임 시작 ---------------- */
  function requestStart(game) {
    if (!window.Store) return false;
    if (Store.remaining() <= 0) { showLimit(); return false; }
    if (!Store.consume()) { showLimit(); return false; }
    hideSheet('limitSheet');
    switchTab(game === 'matching' ? 'matching' : 'watermelon');
    if (game === 'matching') {
      if (window.Matching) Matching.start();
    } else if (window.Watermelon) {
      Watermelon.start();
    }
    refresh();
    return true;
  }
  App.requestStart = requestStart;

  function showLimit() {
    var s = $('limitSheet');
    if (!s) return;
    if (window.Sfx) Sfx.wrong();
    var d = $('limitDesc');
    if (d) {
      d.textContent = Store.remaining() > 0
        ? '한 번 더 놀 수 있어요!'
        : '문제를 풀면 한 번 더 놀 수 있어요!';
    }
    s.hidden = false;
  }

  /* ---------------- 시트 ---------------- */
  function hideSheet(id) {
    var el = $(id);
    if (el) el.hidden = true;
  }
  function closeAllSheets() {
    ['quizSheet', 'adminSheet', 'limitSheet', 'pinSheet', 'rankSheet', 'playerSheet'].forEach(hideSheet);
    if (window.Quiz && Quiz.isOpen()) Quiz.close();
    adminUnlocked = false;
  }

  /* ---------------- 관리자 ---------------- */
  function openAdmin() {
    adminUnlocked = false;
    pinBuf = '';
    var pinPad = $('adminPinPad');
    var body = $('adminBody');
    if (pinPad) pinPad.hidden = false;
    if (body) body.hidden = true;
    paintPinDots('adminPinDots', 0);
    var msg = $('adminPinMsg');
    if (msg) { msg.textContent = 'PIN 4자리를 눌러 주세요'; msg.className = 'pin-msg'; }
    var sheet = $('adminSheet');
    if (sheet) sheet.hidden = false;
    hideSheet('limitSheet');
  }

  function paintPinDots(id, n) {
    var dots = $(id);
    if (!dots) return;
    Array.prototype.forEach.call(dots.children, function (d, i) {
      d.classList.toggle('on', i < n);
    });
  }

  function pressAdminKey(key) {
    var msg = $('adminPinMsg');
    if (key === 'clear') { pinBuf = ''; paintPinDots('adminPinDots', 0); return; }
    if (key === 'back') { pinBuf = pinBuf.slice(0, -1); paintPinDots('adminPinDots', pinBuf.length); return; }
    if (!/^\d$/.test(key)) return;
    if (pinBuf.length >= 4) return;
    pinBuf += key;
    paintPinDots('adminPinDots', pinBuf.length);
    if (pinBuf.length === 4) {
      setTimeout(function () {
        if (window.Store && Store.checkPin(pinBuf)) {
          if (window.Sfx) Sfx.correct();
          adminUnlocked = true;
          pinBuf = '';
          var pad = $('adminPinPad');
          var body = $('adminBody');
          if (pad) pad.hidden = true;
          if (body) body.hidden = false;
          syncAdmin();
          if (window.Report) Report.render();
        } else {
          if (window.Sfx) Sfx.wrong();
          if (msg) { msg.textContent = 'PIN이 맞지 않아요. 다시 눌러 주세요'; msg.className = 'pin-msg bad'; }
          pinBuf = '';
          paintPinDots('adminPinDots', 0);
        }
      }, 120);
    }
  }

  function syncAdmin() {
    if (!window.Store) return;
    var s = Store.settings();
    var d = $('setDaily');
    var a = $('setAge');
    var hint = $('ageHint');
    var used = $('statUsed');
    var left = $('statLeft');
    if (d) d.textContent = String(s.daily);
    if (a) a.textContent = String(s.age);
    if (hint) hint.textContent = Store.ageBandLabel(s.age) + ' · 영어·수학 난이도';
    if (used) used.textContent = Store.used() + '회';
    if (left) left.textContent = Store.remaining() + '회';
    refresh();
  }

  function bumpSetting(kind, delta) {
    if (!window.Store) return;
    var s = Store.settings();
    if (kind === 'daily') {
      var v = clamp(s.daily + delta, 1, 20);
      if (v === s.daily) return;
      Store.setDaily(v);
    } else {
      var age = clamp(s.age + delta, 5, 13);
      if (age === s.age) return;
      Store.setAge(age);
    }
    if (window.Sfx) Sfx.tap();
    syncAdmin();
  }

  /* ---------------- PIN 변경 ---------------- */
  function openPinChange() {
    pinStep = 1;
    newPinBuf = '';
    paintPinDots('pinDots', 0);
    var msg = $('pinMsg');
    if (msg) { msg.textContent = '새 PIN 4자리를 입력해 주세요'; msg.className = 'pin-msg'; }
    var s = $('pinSheet');
    if (s) s.hidden = false;
  }

  function pressPinChangeKey(key) {
    var msg = $('pinMsg');
    if (key === 'clear') { newPinBuf = ''; paintPinDots('pinDots', 0); return; }
    if (key === 'back') { newPinBuf = newPinBuf.slice(0, -1); paintPinDots('pinDots', newPinBuf.length); return; }
    if (!/^\d$/.test(key)) return;
    if (newPinBuf.length >= 4) return;
    newPinBuf += key;
    paintPinDots('pinDots', newPinBuf.length);
    if (newPinBuf.length === 4) {
      setTimeout(function () {
        if (pinStep === 1) {
          pinStep = 2;
          var first = newPinBuf;
          window.__newPinFirst = first;
          newPinBuf = '';
          paintPinDots('pinDots', 0);
          if (msg) { msg.textContent = '확인을 위해 한 번 더 입력해 주세요'; msg.className = 'pin-msg'; }
        } else {
          if (window.__newPinFirst === newPinBuf) {
            Store.setPin(newPinBuf);
            if (window.Sfx) Sfx.correct();
            hideSheet('pinSheet');
            Toast('PIN을 바꿨어요');
          } else {
            if (window.Sfx) Sfx.wrong();
            if (msg) { msg.textContent = 'PIN이 서로 달라요. 처음부터 다시!'; msg.className = 'pin-msg bad'; }
            pinStep = 1;
            newPinBuf = '';
            window.__newPinFirst = '';
            paintPinDots('pinDots', 0);
          }
        }
      }, 120);
    }
  }

  /* ---------------- 이벤트 연결 ---------------- */
  function wire() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.addEventListener('click', function () {
        if (window.Sfx) Sfx.tap();
        switchTab(t.dataset.tab);
      });
    });

    var btnQuiz = $('btnQuiz');
    if (btnQuiz) btnQuiz.addEventListener('click', function () {
      if (window.Sfx) Sfx.tap();
      if (window.Quiz) Quiz.open();
    });

    var btnAdmin = $('btnAdmin');
    if (btnAdmin) btnAdmin.addEventListener('click', function () {
      if (window.Sfx) Sfx.tap();
      openAdmin();
    });

    var btnRank = $('btnRank');
    if (btnRank) btnRank.addEventListener('click', function () {
      openRank(currentTab === 'matching' ? 'match' : 'watermelon');
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-open-rank]'), function (b) {
      b.addEventListener('click', function () {
        if (window.Sfx) Sfx.tap();
        openRank(b.dataset.openRank);
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('.rank-tab'), function (t) {
      t.addEventListener('click', function () {
        rankGame = t.dataset.rank === 'match' ? 'match' : 'watermelon';
        if (window.Sfx) Sfx.tap();
        renderRank();
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-change-player]'), function (b) {
      b.addEventListener('click', function () { openPlayerSheet(); });
    });

    var playerSave = $('playerSaveBtn');
    if (playerSave) playerSave.addEventListener('click', function () {
      var input = $('playerInput');
      var v = input ? input.value.trim() : '';
      if (!v) { if (input) input.focus(); return; }
      selectPlayer(v);
      hideSheet('playerSheet');
    });
    var playerInput = $('playerInput');
    if (playerInput) {
      playerInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (playerSave) playerSave.click(); }
      });
    }

    var btnMute = $('btnMute');
    if (btnMute) btnMute.addEventListener('click', function () {
      var muted = !Store.settings().muted;
      Store.setMuted(muted);
      if (window.Sfx) Sfx.setMuted(muted);
      if (muted && window.Speech) Speech.cancel();
      updateMuteBtn();
      if (!muted && window.Sfx) Sfx.pop();
      Toast(muted ? '소리를 껐어요' : '소리를 켰어요', 1200);
    });

    var map = {
      wmStartBtn: function () { requestStart('watermelon'); },
      wmRetryBtn: function () { requestStart('watermelon'); },
      wmHomeBtn: function () { if (window.Watermelon) Watermelon.toIdle(); refresh(); },
      mtStartBtn: function () { requestStart('matching'); },
      mtRetryBtn: function () { requestStart('matching'); },
      mtHomeBtn: function () { if (window.Matching) Matching.toIdle(); refresh(); },
      mtNextBtn: function () { if (window.Matching) Matching.nextRound(); },
      mtClearHomeBtn: function () { if (window.Matching) Matching.toIdle(); refresh(); },
      adminDoneBtn: function () { hideSheet('adminSheet'); adminUnlocked = false; },
      adminResetBtn: function () {
        Store.resetToday();
        if (window.Sfx) Sfx.pop();
        Toast('오늘 횟수를 초기화했어요');
        syncAdmin();
      },
      adminChargeBtn: function () {
        Store.addBonus(1);
        if (window.Sfx) Sfx.charge();
        Toast('1회 충전! 🎉');
        syncAdmin();
      },
      adminPinChangeBtn: openPinChange,
      limitQuizBtn: function () { hideSheet('limitSheet'); if (window.Quiz) Quiz.open(); },
      limitAdminBtn: function () { hideSheet('limitSheet'); openAdmin(); },
      quizDoneBtn: function () { if (window.Quiz) Quiz.close(); refresh(); }
    };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('click', function () { if (window.Sfx) Sfx.tap(); map[id](); });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-close]'), function (el) {
      el.addEventListener('click', function () {
        var which = el.dataset.close;
        if (which === 'quiz') { if (window.Quiz) Quiz.close(); }
        else if (which === 'admin') { hideSheet('adminSheet'); adminUnlocked = false; pinBuf = ''; }
        else if (which === 'limit') hideSheet('limitSheet');
        else if (which === 'pin') hideSheet('pinSheet');
        else if (which === 'rank') hideSheet('rankSheet');
        else if (which === 'player') hideSheet('playerSheet');
      });
    });

    var keys = $('adminKeys');
    if (keys) {
      Array.prototype.forEach.call(keys.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          if (window.Sfx) Sfx.tap();
          pressAdminKey(b.dataset.key);
        });
      });
    }
    var pinKeys = $('pinKeys');
    if (pinKeys) {
      Array.prototype.forEach.call(pinKeys.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function () {
          if (window.Sfx) Sfx.tap();
          pressPinChangeKey(b.dataset.key);
        });
      });
    }

    Array.prototype.forEach.call(document.querySelectorAll('[data-stepper] button'), function (b) {
      b.addEventListener('click', function () {
        bumpSetting(b.closest('[data-stepper]').dataset.stepper, Number(b.dataset.step));
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeAllSheets();
      }
    });

    // 첫 터치에 오디오 잠금 해제
    document.addEventListener('pointerdown', function once() {
      if (window.Sfx) { Sfx.setMuted(Store.settings().muted); Sfx.unlock(); }
      document.removeEventListener('pointerdown', once);
    });

    window.addEventListener('coa:state-updated', function () { refresh(); });
    window.addEventListener('coa:stats-updated', function () { if (adminUnlocked && window.Report) Report.render(); });
    window.addEventListener('coa:ranking-updated', function () {
      var s = $('rankSheet');
      if (s && !s.hidden) renderRank();
    });

    // 날짜가 바뀌었을 때
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && window.Store) {
        if (Store.checkDate()) Toast('새로운 하루! 놀이 횟수가 채워졌어요');
        refresh();
      }
    });
  }

  /* ---------------- 부트 ---------------- */
  function boot() {
    if (window.Sfx) Sfx.setMuted(Store.settings().muted);
    updateMuteBtn();
    if (window.Watermelon) Watermelon.init();
    if (window.Matching) Matching.init();
    if (window.Quiz) Quiz.init();
    if (window.Report) Report.init();
    wire();
    renderPlayers();
    switchTab('watermelon', true);
    refresh();
  }

  window.App = App;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
