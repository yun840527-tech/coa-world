/* ============================================================
   🍉 과일 합치기 (수박 게임)
   - 원형 물리(중력·충돌·마찰) + 같은 과일 합체
   - 터치/드래그로 낙하, 위험선 경고, 최고 기록 저장
   ============================================================ */
(function () {
  'use strict';

  var canvas, ctx, wrap, elScore, elBest, elNext;
  var W = 360, H = 560, dpr = 1, U = 1;
  var MAX_TIER = 10;

  var G = 2300;
  var STEP = 1 / 120;
  var SOLVER_ITER = 6;

  var fruits = [];
  var particles = [];
  var floats = [];
  var merges = [];
  var state = 'idle';           // idle | playing | paused | over
  var score = 0;
  var best = 0;
  var pending = null;           // { tier, x }
  var nextTier = 0;
  var cooldown = 0;
  var dangerTime = 0;
  var accum = 0;
  var lastT = 0;
  var raf = null;
  var uid = 1;
  var shake = 0;
  var aimActive = false;
  var hintShown = true;
  var registered = false;

  var SPAWN_W = [30, 26, 20, 14, 10];

  function $(id) { return document.getElementById(id); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pickTier() {
    var total = SPAWN_W.reduce(function (a, b) { return a + b; }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < SPAWN_W.length; i++) {
      r -= SPAWN_W[i];
      if (r <= 0) return i;
    }
    return 0;
  }
  function radius(tier) { return FruitArt.radius(tier) * U; }
  function dangerY() { return Math.max(54 * U, H * 0.14); }
  function spawnY() { return 40 * U; }

  /* ---------------- 초기화 ---------------- */
  function init() {
    canvas = $('wmCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    wrap = $('wmWrap');
    elScore = $('wmScore');
    elBest = $('wmBest');
    elNext = $('wmNext');

    best = window.Store ? Store.best('watermelon') : 0;
    if (elBest) elBest.textContent = best;
    nextTier = pickTier();
    if (elNext) FruitArt.drawIcon(elNext, nextTier);

    resize();
    if (window.ResizeObserver) {
      new ResizeObserver(function () { resize(); }).observe(wrap);
    } else {
      window.addEventListener('resize', resize);
    }

    bindInput();
    updateIdleNote();
    render();

    window.addEventListener('visibilitychange', function () {
      if (document.hidden) pause();
      else if (state === 'paused') resume();
    });
  }

  function resize() {
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    var oldW = W, oldH = H;
    W = Math.max(220, Math.round(rect.width));
    H = Math.max(280, Math.round(rect.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    U = W / 280;

    // 진행 중이면 위치·크기를 비율로 맞춘다
    if (oldW !== W || oldH !== H) {
      var sx = W / oldW, sy = H / oldH;
      fruits.forEach(function (f) {
        f.x *= sx; f.y *= sy;
        f.r = radius(f.tier);
        f.m = f.r * f.r;
      });
      if (pending) pending.x = clampX(pending.x, pending.tier);
    }
    if (state !== 'playing') render();
  }

  function clampX(x, tier) {
    var r = radius(tier);
    return Math.max(r + 2, Math.min(W - r - 2, x));
  }

  /* ---------------- 입력 ---------------- */
  function bindInput() {
    canvas.addEventListener('pointerdown', function (e) {
      if (state !== 'playing' || !pending) return;
      aimActive = true;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      moveAim(e);
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!aimActive || state !== 'playing' || !pending) return;
      moveAim(e);
    });
    function finish(e) {
      if (!aimActive) return;
      aimActive = false;
      if (state === 'playing' && pending) drop();
    }
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', function () { aimActive = false; });
    canvas.addEventListener('pointerleave', function () { /* 드래그 유지 */ });

    window.addEventListener('keydown', function (e) {
      if (state !== 'playing') return;
      var tab = document.querySelector('.tab.is-active');
      if (!tab || tab.dataset.tab !== 'watermelon') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!pending) return;
        e.preventDefault();
        pending.x = clampX(pending.x + (e.key === 'ArrowLeft' ? -14 : 14) * U, pending.tier);
      } else if (e.key === ' ' || e.key === 'ArrowDown') {
        if (!pending) return;
        e.preventDefault();
        drop();
      }
    });
  }

  function moveAim(e) {
    var rect = canvas.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width * W;
    pending.x = clampX(x, pending.tier);
  }

  /* ---------------- 게임 진행 ---------------- */
  function start() {
    fruits = [];
    particles = [];
    floats = [];
    merges = [];
    score = 0;
    dangerTime = 0;
    cooldown = 0;
    accum = 0;
    lastT = 0;
    shake = 0;
    registered = false;
    state = 'playing';
    nextTier = pickTier();
    pending = { tier: nextTier, x: W / 2 };
    nextTier = pickTier();
    updateHud();
    hideOverlays();
    if (window.Sfx) Sfx.start();
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    hideHintSoon();
    GamestatsPlay();
  }

  function GamestatsPlay() {
    try {
      if (window.GameStats) GameStats.recordPlay('watermelon');
    } catch (e) { /* noop */ }
  }

  function hideHintSoon() {
    var hint = $('wmHint');
    if (hint && hintShown) {
      setTimeout(function () { hint.classList.add('is-hidden'); }, 2600);
      hintShown = false;
    }
  }

  function pause() {
    if (state !== 'playing') return;
    state = 'paused';
    if (raf) { cancelAnimationFrame(raf); raf = null; }
  }
  function resume() {
    if (state !== 'paused') return;
    state = 'playing';
    lastT = 0;
    raf = requestAnimationFrame(loop);
  }

  function end() {
    state = 'over';
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (window.Sfx) Sfx.over();
    best = Math.max(best, score);
    if (window.Store) Store.setBest('watermelon', score);
    if (window.GameStats) GameStats.recordScore('watermelon', score);
    registerScoreOnce();
    if (elBest) elBest.textContent = best;
    var fs = $('wmFinalScore');
    var bn = $('wmBestNote');
    if (fs) fs.textContent = score.toLocaleString('ko-KR');
    if (bn) bn.textContent = '최고 기록 ' + best.toLocaleString('ko-KR') + '점';
    var go = $('wmGameover');
    if (go) go.hidden = false;
    pending = null;
    render();
  }

  function toIdle() {
    state = 'idle';
    registerScoreOnce();
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    fruits = []; particles = []; floats = []; merges = [];
    var go = $('wmGameover');
    if (go) go.hidden = true;
    var ov = $('wmOverlay');
    if (ov) ov.hidden = false;
    pending = null;
    updateIdleNote();
    render();
  }

  function drop() {
    if (cooldown > 0 || !pending) return;
    var tier = pending.tier;
    var r = radius(tier);
    var f = makeFruit(clampX(pending.x, tier), spawnY(), tier);
    f.vy = 60;
    fruits.push(f);
    if (window.Sfx) Sfx.drop();
    pending = null;
    cooldown = 0.36;
    setTimeout(function () {
      if (state === 'playing' || state === 'paused') {
        pending = { tier: nextTier, x: clampX(W / 2, nextTier) };
        nextTier = pickTier();
        updateHud();
        render();
      }
    }, 330);
  }

  function makeFruit(x, y, tier, vel) {
    var r = radius(tier);
    return {
      id: uid++,
      x: x, y: y, tier: tier,
      r: r, m: r * r, inv: 1 / (r * r),
      vx: (vel && vel.vx) || rnd(-8, 8),
      vy: (vel && vel.vy) || 0,
      rot: rnd(-0.1, 0.1),
      spin: rnd(-0.6, 0.6),
      born: performance.now(),
      dead: false,
      pop: 0
    };
  }

  /* ---------------- 물리 ---------------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function physics(dt) {
    var i, j, f;
    var G2 = G * U;

    for (i = 0; i < fruits.length; i++) {
      f = fruits[i];
      if (f.dead) continue;
      f.vy += G2 * dt;
      f.vx *= (1 - 1.2 * dt);
      f.vy *= (1 - 0.35 * dt);
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.spin * dt * 0.35;
      if (f.pop > 0) f.pop = Math.max(0, f.pop - dt * 4);
    }

    for (var it = 0; it < SOLVER_ITER; it++) {
      // 벽
      for (i = 0; i < fruits.length; i++) {
        f = fruits[i];
        if (f.dead) continue;
        if (f.x - f.r < 0) {
          f.x = f.r;
          if (f.vx < 0) f.vx = -f.vx * 0.2;
        } else if (f.x + f.r > W) {
          f.x = W - f.r;
          if (f.vx > 0) f.vx = -f.vx * 0.2;
        }
        if (f.y + f.r > H) {
          f.y = H - f.r;
          if (f.vy > 0) f.vy = -f.vy * 0.12;
          f.vx *= 0.9;
          f.spin *= 0.9;
        }
        if (f.y - f.r < -H) { f.y = -H + f.r; f.vy = Math.abs(f.vy) * 0.2; }
      }

      // 과일끼리
      for (i = 0; i < fruits.length; i++) {
        var a = fruits[i];
        if (a.dead) continue;
        for (j = i + 1; j < fruits.length; j++) {
          var b = fruits[j];
          if (b.dead) continue;
          var dx = b.x - a.x;
          var dy = b.y - a.y;
          var minD = a.r + b.r;
          var d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD || d2 === 0) continue;

          // 같은 과일 → 합체 예약
          if (a.tier === b.tier) {
            a.dead = true; b.dead = true;
            merges.push([a, b]);
            break;
          }

          var d = Math.sqrt(d2);
          var nx = dx / d, ny = dy / d;
          var overlap = minD - d;
          var totalInv = a.inv + b.inv;
          var corr = Math.max(0, overlap - 0.25) * 0.85 / totalInv;
          a.x -= nx * corr * a.inv;
          a.y -= ny * corr * a.inv;
          b.x += nx * corr * b.inv;
          b.y += ny * corr * b.inv;

          var rvx = b.vx - a.vx;
          var rvy = b.vy - a.vy;
          var vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            var e = 0.06;
            var jimp = -(1 + e) * vn / totalInv;
            a.vx -= jimp * nx * a.inv;
            a.vy -= jimp * ny * a.inv;
            b.vx += jimp * nx * b.inv;
            b.vy += jimp * ny * b.inv;

            // 접선 마찰
            var tx = -ny, ty = nx;
            var vt = rvx * tx + rvy * ty;
            var jt = -vt / totalInv * 0.45;
            a.vx -= jt * tx * a.inv;
            a.vy -= jt * ty * a.inv;
            b.vx += jt * tx * b.inv;
            b.vy += jt * ty * b.inv;
          }
        }
      }
    }

    // 합체 처리
    if (merges.length) {
      merges.forEach(function (pair) {
        doMerge(pair[0], pair[1]);
      });
      merges.length = 0;
      fruits = fruits.filter(function (f) { return !f.dead; });
      updateHud();
    }

    // 위험선
    var dz = dangerY();
    var danger = false;
    var now = performance.now();
    for (i = 0; i < fruits.length; i++) {
      f = fruits[i];
      if (now - f.born < 1100) continue;
      if (f.y - f.r < dz && Math.abs(f.vy) < 90 * U) { danger = true; break; }
    }
    if (danger) dangerTime += dt; else dangerTime = Math.max(0, dangerTime - dt * 2.2);
    if (dangerTime > 2.0) end();

    // 파티클
    for (i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.vy += 1400 * U * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (i = floats.length - 1; i >= 0; i--) {
      floats[i].life -= dt;
      floats[i].y -= 34 * U * dt;
      if (floats[i].life <= 0) floats.splice(i, 1);
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 5);
  }

  function doMerge(a, b) {
    var tier = a.tier + 1;
    var x = (a.x + b.x) / 2;
    var y = (a.y + b.y) / 2;

    if (a.tier === MAX_TIER) {
      // 수박 + 수박 → 시원하게 터짐
      score += 500;
      burst(x, y, '#ff6b81', 26, 1.6);
      burst(x, y, '#3fa35f', 18, 1.4);
      addFloat(x, y, '+500');
      if (window.Sfx) Sfx.merge(11);
      shake = 0.6;
      if (window.GameStats) GameStats.recordMerge(1);
      syncLiveScore();
      return;
    }

    var nf = makeFruit(x, y, tier, {
      vx: (a.vx + b.vx) * 0.25,
      vy: Math.min((a.vy + b.vy) * 0.2, -90 * U)
    });
    nf.pop = 1;
    nf.born = performance.now();
    fruits.push(nf);

    var gain = FruitArt.scoreFor(tier);
    score += gain;
    burst(x, y, FruitArt.defs[tier].base, 10 + tier, 1);
    burst(x, y, FruitArt.defs[tier].light, 5, 0.8);
    addFloat(x, y, '+' + gain);
    if (window.Sfx) Sfx.merge(tier);
    if (tier >= 8) shake = Math.min(0.8, 0.25 + tier * 0.05);
    if (window.GameStats) GameStats.recordMerge(1);
    syncLiveScore();
  }

  /** 판이 끝나지 않아도 최고 점수를 바로 반영 */
  function syncLiveScore() {
    if (score > best) {
      best = score;
      if (window.Store) Store.setBest('watermelon', score);
      if (elBest) elBest.textContent = best.toLocaleString('ko-KR');
    }
    if (window.GameStats) GameStats.recordScore('watermelon', score);
  }

  function burst(x, y, color, n, power) {
    for (var i = 0; i < n; i++) {
      var a = rnd(0, Math.PI * 2);
      var sp = rnd(40, 260) * U * (power || 1);
      particles.push({
        x: x, y: y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60 * U,
        r: rnd(1.6, 4.6) * U,
        color: color,
        life: rnd(0.35, 0.8),
        max: 0.8
      });
    }
  }

  function addFloat(x, y, text) {
    floats.push({ x: x, y: y, text: text, life: 0.9, max: 0.9 });
  }

  /* ---------------- 렌더 ---------------- */
  function render() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (shake > 0) {
      ctx.translate(rnd(-1, 1) * shake * 4, rnd(-1, 1) * shake * 4);
    }

    // 바닥
    var fg = ctx.createLinearGradient(0, H - 90 * U, 0, H);
    fg.addColorStop(0, 'rgba(255,238,208,0)');
    fg.addColorStop(1, 'rgba(244,214,169,.55)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, H - 90 * U, W, 90 * U);

    // 은은한 종이 패턴
    ctx.save();
    ctx.fillStyle = 'rgba(196,160,116,.13)';
    var gap = 34 * U;
    for (var py = gap; py < H; py += gap) {
      for (var px = gap; px < W; px += gap) {
        ctx.beginPath();
        ctx.arc(px + (Math.round(py / gap) % 2 ? gap / 2 : 0), py, 1.1 * U, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // 위험선
    var dz = dangerY();
    var warn = Math.min(1, dangerTime / 1.6);
    ctx.save();
    ctx.setLineDash([7 * U, 6 * U]);
    ctx.lineWidth = Math.max(1.4, 2 * U);
    ctx.strokeStyle = dangerTime > 0.05
      ? 'rgba(226,80,60,' + (0.45 + 0.5 * Math.abs(Math.sin(performance.now() / 180))) + ')'
      : 'rgba(210,150,110,.38)';
    ctx.beginPath();
    ctx.moveTo(8 * U, dz);
    ctx.lineTo(W - 8 * U, dz);
    ctx.stroke();
    ctx.restore();
    if (warn > 0.02) {
      var vg = ctx.createLinearGradient(0, 0, 0, dz + 40 * U);
      vg.addColorStop(0, 'rgba(235,90,70,' + (0.18 * warn) + ')');
      vg.addColorStop(1, 'rgba(235,90,70,0)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, dz + 40 * U);
    }

    // 낙하 안내선
    if (pending && state === 'playing') {
      ctx.save();
      ctx.setLineDash([4 * U, 8 * U]);
      ctx.lineWidth = 1.6 * U;
      ctx.strokeStyle = 'rgba(160,120,80,.28)';
      ctx.beginPath();
      ctx.moveTo(pending.x, spawnY() + radius(pending.tier));
      ctx.lineTo(pending.x, H - 6 * U);
      ctx.stroke();
      ctx.restore();
    }

    // 과일
    fruits.forEach(function (f) {
      if (f.dead) return;
      var scale = f.pop > 0 ? 1 + 0.22 * f.pop : 1;
      FruitArt.draw(ctx, f.x, f.y, f.r, f.tier, { rot: f.rot, scale: scale });
    });

    // 떨어뜨릴 과일(대기)
    if (pending) {
      var bob = Math.sin(performance.now() / 320) * 2 * U;
      FruitArt.draw(ctx, pending.x, spawnY() + bob, radius(pending.tier), pending.tier, {
        scale: aimActive ? 1.04 : 1
      });
    }

    // 파티클
    particles.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // 점수 팝업
    floats.forEach(function (fl) {
      ctx.globalAlpha = Math.max(0, fl.life / fl.max);
      ctx.fillStyle = '#2c7c55';
      ctx.font = '700 ' + Math.round(15 * U) + 'px "Jua", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fl.text, fl.x, fl.y);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function loop(t) {
    if (state !== 'playing') return;
    raf = requestAnimationFrame(loop);
    if (!lastT) lastT = t;
    var dtReal = Math.min(0.06, (t - lastT) / 1000) || 0;
    lastT = t;
    if (cooldown > 0) cooldown = Math.max(0, cooldown - dtReal);
    accum += dtReal;
    var guard = 0;
    while (accum >= STEP && guard++ < 8) {
      physics(STEP);
      accum -= STEP;
    }
    render();
  }

  /** 랭킹에는 판당 한 번만 등록 */
  function registerScoreOnce() {
    if (registered) return;
    registered = true;
    if (score > 0 && window.App && App.registerScore) App.registerScore('watermelon', score);
  }

  /* ---------------- HUD ---------------- */
  function updateHud() {
    updateScoreOnly();
    if (elBest) elBest.textContent = Math.max(best, score);
    if (elNext) FruitArt.drawIcon(elNext, nextTier);
  }

  function updateScoreOnly() {
    if (elScore) elScore.textContent = score.toLocaleString('ko-KR');
  }

  function updateIdleNote() {
    var left = window.Store ? Store.remaining() : 0;
    var n1 = $('wmOverlayNote');
    if (n1) n1.textContent = left > 0 ? ('오늘 남은 횟수 ' + left + '회') : '오늘 횟수를 다 썼어요 · 문제를 풀면 +1회';
    var btn = $('wmStartBtn');
    if (btn) btn.disabled = false;
    var note2 = $('mtOverlayNote');
    if (note2) note2.textContent = n1 ? n1.textContent : '';
    var btn2 = $('mtStartBtn');
    if (btn2) btn2.disabled = left <= 0;
    var rb = $('wmRetryBtn');
    if (rb) rb.disabled = false;
    var rb2 = $('mtRetryBtn');
    if (rb2) rb2.disabled = false;
  }

  function hideOverlays() {
    var ov = $('wmOverlay');
    if (ov) ov.hidden = true;
    var go = $('wmGameover');
    if (go) go.hidden = true;
  }

  window.Watermelon = {
    init: init,
    start: start,
    end: end,
    toIdle: toIdle,
    pause: pause,
    resume: resume,
    updateIdleNote: updateIdleNote,
    isPlaying: function () { return state === 'playing' || state === 'paused'; },
    /** 테스트/디버그용 */
    _state: function () {
      return { state: state, score: score, fruits: fruits.length, pending: pending ? pending.tier : null, danger: dangerTime };
    },
    _dropAt: function (x) { if (pending) { pending.x = clampX(x, pending.tier); drop(); } }
  };
})();
