/* 코아 테트리스 🐶 — 아이템 테트리스 미니게임
 * 10×20 / 7종 테트로미노 / 고스트 / 홀드 / 아이템 6종 / 라운드·방해 줄 / Web Audio
 */
(function () {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const LINES_PER_ROUND = 12;
  const ROUND_MS = 32000;
  const LOCK_DELAY = 470;
  const LINE_SCORE = [0, 100, 300, 500, 800];
  const GARBAGE_COLOR = '#aeb9c4';
  const DEBUG = new URLSearchParams(location.search).has('debug');

  /* ───────────────────────── 데이터 ───────────────────────── */
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };
  const TYPES = Object.keys(SHAPES);
  const COLORS = {
    I: '#8ed0e8', O: '#ffd479', T: '#c9a1e4', S: '#96dba2',
    Z: '#ff9d9d', J: '#9fb2ee', L: '#ffb878', G: GARBAGE_COLOR,
  };
  const ITEMS = {
    bomb: { icon: '💣', name: '폭탄', color: '#ff8b7a' },
    lightning: { icon: '⚡', name: '번개', color: '#ffd05e' },
    slow: { icon: '🐢', name: '슬로우', color: '#7fc8b0' },
    magnet: { icon: '🧲', name: '중력 압축', color: '#e79ad0' },
    fever: { icon: '🌟', name: '2배 피버', color: '#ffb45e' },
    broom: { icon: '🧹', name: '바닥 청소', color: '#9fc9e8' },
  };
  const ITEM_POOL = [
    ['bomb', 22], ['lightning', 18], ['slow', 16],
    ['magnet', 14], ['fever', 14], ['broom', 16],
  ];

  /* ───────────────────────── DOM ───────────────────────── */
  const $ = (s) => document.querySelector(s);
  const boardWrap = $('#board-wrap');
  const frame = $('.board-frame');
  const canvas = $('#board');
  const ctx = canvas.getContext('2d');
  const fxCanvas = $('#fx');
  const fxCtx = fxCanvas.getContext('2d');
  const holdCanvas = $('#hold-canvas');
  const nextCanvas = $('#next-canvas');
  const overlay = $('#overlay');
  const bannerEl = $('#banner');
  const flashEl = $('#flash');
  const effectsEl = $('#effects');
  const elRound = $('#round');
  const elScore = $('#score');
  const elBest = $('#best');
  const elScoreStat = elScore.closest('.stat');
  const btnSound = $('#btn-sound');
  const btnPause = $('#btn-pause');

  const SAVE_BEST = 'coa-tetris-best';
  const SAVE_MUTE = 'coa-tetris-muted';

  /* ───────────────────────── 사운드 ───────────────────────── */
  const Sfx = {
    ctx: null,
    master: null,
    muted: false,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    resume() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    },
    tone(freq, opt) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const o = Object.assign({ type: 'sine', dur: 0.1, gain: 0.5, to: null, delay: 0, attack: 0.006 }, opt || {});
      const t0 = this.ctx.currentTime + o.delay;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = o.type;
      osc.frequency.setValueAtTime(freq, t0);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t0 + o.dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(o.gain, t0 + o.attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + o.dur + 0.02);
    },
    noise(dur, gain, freq) {
      if (this.muted) return;
      this.init();
      if (!this.ctx) return;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = freq || 900;
      const g = this.ctx.createGain(); g.gain.value = gain || 0.18;
      src.connect(f); f.connect(g); g.connect(this.master);
      src.start();
    },
    move() { this.tone(240, { type: 'square', dur: 0.035, gain: 0.16 }); },
    rotate() { this.tone(360, { type: 'triangle', dur: 0.06, gain: 0.22, to: 460 }); },
    hold() { this.tone(420, { type: 'sine', dur: 0.08, gain: 0.24, to: 300 }); },
    lock() { this.tone(150, { type: 'sine', dur: 0.09, gain: 0.4, to: 95 }); this.noise(0.06, 0.1, 700); },
    hard() { this.tone(220, { type: 'sawtooth', dur: 0.13, gain: 0.3, to: 60 }); this.noise(0.08, 0.16, 600); },
    clear(n) {
      const notes = [523, 659, 784, 1046];
      for (let i = 0; i < Math.min(n, 4); i++) this.tone(notes[i], { type: 'triangle', dur: 0.16, gain: 0.3, delay: i * 0.055 });
      this.noise(0.16, 0.12, 2200);
    },
    item(kind) {
      const seq = kind === 'fever' ? [523, 659, 880, 1175]
        : kind === 'slow' ? [440, 392, 349, 294]
        : kind === 'bomb' ? [180, 90]
        : [659, 880, 1046];
      seq.forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.14, gain: 0.28, delay: i * 0.06 }));
      if (kind === 'bomb') this.noise(0.3, 0.22, 500);
    },
    round() { [392, 523, 659, 784].forEach((f, i) => this.tone(f, { type: 'sine', dur: 0.2, gain: 0.3, delay: i * 0.08 })); },
    garbage() { this.tone(110, { type: 'sawtooth', dur: 0.22, gain: 0.24, to: 70 }); this.noise(0.2, 0.1, 400); },
    pause() { this.tone(330, { type: 'sine', dur: 0.1, gain: 0.24, to: 220 }); },
    over() { [440, 392, 330, 262, 196].forEach((f, i) => this.tone(f, { type: 'triangle', dur: 0.28, gain: 0.3, delay: i * 0.12 })); },
  };

  /* ───────────────────────── 상태 ───────────────────────── */
  const G = {
    status: 'ready',
    board: [],
    piece: null,
    hold: null,
    canHold: true,
    bag: [],
    next: [],
    score: 0,
    best: 0,
    lines: 0,
    round: 1,
    linesInRound: 0,
    time: 0,
    roundTimer: 0,
    garbageTimer: 0,
    dropTimer: 0,
    lockTimer: 0,
    lockResets: 0,
    softDropping: false,
    busy: false,
    effects: { slow: 0, fever: 0 },
    clearAnim: null,
    pieces: 0,
    itemsTriggered: 0,
    lastItem: null,
  };

  let cellPx = 24, offX = 0, offY = 0, fw = 0, fh = 0, dpr = 1;
  let particles = [];
  let bannerTimer = 0, shakeUntil = 0;
  let running = false, lastTime = 0;

  /* ───────────────────────── 유틸 ───────────────────────── */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (n) => Math.floor(Math.random() * n);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }
  function fmt(n) { return n.toLocaleString('ko-KR'); }
  function roundMult() { return 1 + (G.round - 1) * 0.08; }

  /* ───────────────────────── 보드 / 피스 ───────────────────────── */
  function rotateMatrix(m, dir) {
    const n = m.length;
    const out = Array.from({ length: n }, () => Array(n).fill(0));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (dir > 0) out[c][n - 1 - r] = m[r][c];
        else out[n - 1 - c][r] = m[r][c];
      }
    }
    return out;
  }

  function collides(shape, px, py) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const x = px + c, y = py + r;
        if (x < 0 || x >= COLS || y >= ROWS) return true;
        if (y >= 0 && G.board[y][x]) return true;
      }
    }
    return false;
  }

  function refillBag() {
    const bag = TYPES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    G.bag.push(...bag);
  }

  function pickType() {
    if (G.bag.length === 0) refillBag();
    return G.bag.shift();
  }

  function pickItem() {
    const total = ITEM_POOL.reduce((s, p) => s + p[1], 0);
    let roll = Math.random() * total;
    for (const [k, w] of ITEM_POOL) {
      roll -= w;
      if (roll <= 0) return k;
    }
    return 'bomb';
  }

  function itemChance() { return Math.min(0.36, 0.20 + (G.round - 1) * 0.015); }

  function makePiece(type) {
    const shape = SHAPES[type].map((row) => row.slice());
    // 아이템 장착
    const cells = [];
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) if (shape[r][c]) cells.push([r, c]);
    }
    const items = {};
    if (cells.length && Math.random() < itemChance()) {
      const [r0, c0] = cells[rand(cells.length)];
      items[r0 + ',' + c0] = pickItem();
      if (Math.random() < 0.12 && cells.length > 1) {
        const [r1, c1] = cells[rand(cells.length)];
        items[r1 + ',' + c1] = pickItem();
      }
    }
    return { type, shape, x: 0, y: 0, items };
  }

  function spawnPiece(type) {
    const p = makePiece(type || pickType());
    const w = p.shape[0].length;
    p.x = Math.floor((COLS - w) / 2);
    // 첫 채워진 줄이 0이 되도록 위로 올림
    let top = 0;
    while (top < p.shape.length && p.shape[top].every((v) => !v)) top++;
    p.y = -top;
    G.piece = p;
    G.dropTimer = 0;
    G.lockTimer = 0;
    G.lockResets = 0;
    if (collides(p.shape, p.x, p.y)) {
      if (!collides(p.shape, p.x, p.y + 1)) p.y += 1;
      else { gameOver(); return false; }
    }
    return true;
  }

  function cellsOf(p) {
    const out = [];
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c]) out.push({ x: p.x + c, y: p.y + r, item: p.items[r + ',' + c] || null });
      }
    }
    return out;
  }

  function refreshNext() {
    while (G.next.length < 3) G.next.push(pickType());
    drawPreview(nextCanvas, G.next.slice(0, 2), 2);
  }

  function spawnNext() {
    if (G.status !== 'playing') return;
    const t = G.next.shift();
    refreshNext();
    spawnPiece(t);
    G.pieces++;
    G.canHold = true;
    drawPreview(holdCanvas, G.hold ? [G.hold] : [], 1);
  }

  /* ───────────────────────── 이동 / 회전 ───────────────────────── */
  function move(dx, dy, silent) {
    const p = G.piece;
    if (!p || G.status !== 'playing' || G.busy) return false;
    if (collides(p.shape, p.x + dx, p.y + dy)) return false;
    p.x += dx; p.y += dy;
    if (dx !== 0 || dy > 0) {
      G.dropTimer = 0;
      if (G.lockTimer > 0 && G.lockResets < 15) { G.lockTimer = 0; G.lockResets++; }
    }
    if (!silent && dx !== 0) Sfx.move();
    return true;
  }

  function rotate(dir) {
    const p = G.piece;
    if (!p || G.status !== 'playing' || G.busy) return false;
    if (p.type === 'O') { Sfx.rotate(); return true; }
    const rotated = rotateMatrix(p.shape, dir);
    const kicks = dir > 0
      ? [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1], [-1, -1], [1, -1]]
      : [[0, 0], [1, 0], [-1, 0], [2, 0], [-2, 0], [0, -1], [1, -1], [-1, -1]];
    for (const [kx, ky] of kicks) {
      if (!collides(rotated, p.x + kx, p.y + ky)) {
        p.shape = rotated; p.x += kx; p.y += ky;
        if (G.lockResets < 15) { G.lockTimer = 0; G.lockResets++; }
        Sfx.rotate();
        return true;
      }
    }
    return false;
  }

  function ghostY() {
    const p = G.piece;
    if (!p) return 0;
    let y = p.y;
    while (!collides(p.shape, p.x, y + 1)) y++;
    return y;
  }

  function hardDrop() {
    const p = G.piece;
    if (!p || G.status !== 'playing' || G.busy) return;
    let steps = 0;
    while (!collides(p.shape, p.x, p.y + 1)) { p.y++; steps++; }
    if (steps > 0) addScore(steps * 2, false);
    Sfx.hard();
    lockPiece();
  }

  function doHold() {
    if (G.status !== 'playing' || G.busy || !G.canHold) return;
    const cur = G.piece ? G.piece.type : null;
    if (!cur) return;
    const swap = G.hold;
    G.hold = cur;
    G.canHold = false;
    Sfx.hold();
    drawPreview(holdCanvas, [G.hold], 1);
    if (swap) spawnPiece(swap);
    else spawnNext();
    G.canHold = false;
  }

  /* ───────────────────────── 락 / 라인 ───────────────────────── */
  function lockPiece() {
    const p = G.piece;
    if (!p) return;
    let toppedOut = false;
    for (const cell of cellsOf(p)) {
      if (cell.y < 0) { toppedOut = true; continue; }
      if (cell.y >= ROWS || cell.x < 0 || cell.x >= COLS) continue;
      G.board[cell.y][cell.x] = { c: p.type, item: cell.item || null };
    }
    G.piece = null;
    G.canHold = true;
    G.lockTimer = 0;
    Sfx.lock();
    if (toppedOut) { gameOver(); return; }
    const rows = fullRows();
    if (rows.length) resolveClear();
    else spawnNext();
  }

  function fullRows() {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
      let full = true;
      for (let c = 0; c < COLS; c++) if (!G.board[r][c]) { full = false; break; }
      if (full) out.push(r);
    }
    return out;
  }

  function removeRows(rows) {
    const set = new Set(rows);
    const kept = G.board.filter((_, r) => !set.has(r));
    const pad = Array.from({ length: ROWS - kept.length }, () => Array(COLS).fill(null));
    G.board = pad.concat(kept);
  }

  async function clearAnim(rows) {
    G.clearAnim = { rows: rows.slice(), t0: performance.now(), dur: 260 };
    Sfx.clear(rows.length);
    await sleep(265);
    G.clearAnim = null;
  }

  async function resolveClear() {
    if (G.busy) return;
    G.busy = true;
    let chain = 0;
    while (chain < 8) {
      const rows = fullRows();
      if (!rows.length) break;
      // 아이템 수집
      const items = [];
      for (const r of rows) {
        for (let c = 0; c < COLS; c++) {
          const cell = G.board[r][c];
          if (cell && cell.item) items.push({ kind: cell.item, r, c });
        }
      }
      // 파티클
      for (const r of rows) for (let c = 0; c < COLS; c++) {
        if (G.board[r][c]) burstCell(c, r, COLORS[G.board[r][c].c] || '#fff', 5);
      }
      await clearAnim(rows);
      removeRows(rows);
      // 좌표 보정(지워진 줄이 아이템 아래에 있었는지)
      const adj = items.map((it) => ({ ...it, r: it.r + rows.filter((r) => r > it.r).length }));

      const gained = Math.round(LINE_SCORE[Math.min(rows.length, 4)] * roundMult() * (G.effects.fever > 0 ? 2 : 1));
      addScore(gained, false);
      G.lines += rows.length;
      G.linesInRound += rows.length;
      if (rows.length >= 3) shake(180);
      if (G.linesInRound >= LINES_PER_ROUND) { G.linesInRound -= LINES_PER_ROUND; advanceRound(); }
      updateHUD();

      if (adj.length) {
        await sleep(150);
        for (const it of adj) activateItem(it.kind, it.r, it.c);
        await sleep(200);
      }
      chain++;
    }
    G.busy = false;
    if (G.status === 'playing') spawnNext();
  }

  /* ───────────────────────── 아이템 ───────────────────────── */
  function lowestFilledRow() {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (G.board[r].some((c) => c)) return r;
    }
    return -1;
  }

  function compactBoard() {
    let moved = 0;
    for (let c = 0; c < COLS; c++) {
      const stack = [];
      for (let r = ROWS - 1; r >= 0; r--) if (G.board[r][c]) stack.push(G.board[r][c]);
      for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) {
        const next = i < stack.length ? stack[i] : null;
        if (G.board[r][c] !== next) moved++;
        G.board[r][c] = next;
      }
    }
    return moved;
  }

  function activateItem(kind, r, c) {
    const def = ITEMS[kind];
    if (!def) return;
    G.lastItem = { kind, at: performance.now() };
    G.itemsTriggered++;
    Sfx.item(kind);
    showBanner(def.icon + ' ' + def.name + ' 발동!', false);
    let removed = 0;
    switch (kind) {
      case 'bomb': {
        const victims = [];
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const rr = r + dr, cc = c + dc;
            if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS) continue;
            if (G.board[rr][cc]) victims.push([rr, cc]);
          }
        }
        for (const [rr, cc] of victims) {
          burstCell(cc, rr, COLORS[G.board[rr][cc].c] || '#fff', 7);
          G.board[rr][cc] = null;
        }
        removed = victims.length;
        shake(320);
        flashScreen();
        break;
      }
      case 'lightning': {
        const row = lowestFilledRow();
        if (row >= 0) {
          for (let cc = 0; cc < COLS; cc++) if (G.board[row][cc]) burstCell(cc, row, '#fff3bf', 5);
          removeRows([row]);
          removed = 1;
          flashScreen();
        }
        break;
      }
      case 'slow': G.effects.slow = 8000; break;
      case 'fever': G.effects.fever = 10000; break;
      case 'magnet': {
        removed = compactBoard();
        for (let cc = 0; cc < COLS; cc++) {
          const rr = lowestFilledRowInCol(cc);
          if (rr >= 0) burstCell(cc, rr, '#f4c9ea', 3);
        }
        break;
      }
      case 'broom': {
        const rows = [ROWS - 1, ROWS - 2];
        const had = rows.filter((rr) => G.board[rr].some((x) => x));
        for (const rr of had) for (let cc = 0; cc < COLS; cc++) if (G.board[rr][cc]) burstCell(cc, rr, '#dff1ff', 5);
        removeRows(rows);
        removed = had.length;
        flashScreen();
        break;
      }
    }
    return removed;
  }

  function lowestFilledRowInCol(c) {
    for (let r = ROWS - 1; r >= 0; r--) if (G.board[r][c]) return r;
    return -1;
  }

  /* ───────────────────────── 라운드 / 방해 줄 ───────────────────────── */
  function gravityInterval() {
    let iv = Math.max(85, 850 * Math.pow(0.74, G.round - 1));
    if (G.effects.slow > 0) iv *= 2;
    return iv;
  }

  function advanceRound() {
    G.round++;
    G.roundTimer = 0;
    G.garbageTimer = 0;
    G.linesInRound = 0;
    showBanner('ROUND ' + G.round, true);
    Sfx.round();
    updateHUD();
  }

  function riseGarbage() {
    if (G.status !== 'playing') return;
    if (G.board[0].some((c) => c)) { gameOver(); return; }
    G.board.shift();
    const hole = rand(COLS);
    const row = Array.from({ length: COLS }, (_, c) => (c === hole ? null : { c: 'G', item: null }));
    G.board.push(row);
    Sfx.garbage();
    shake(200);
    // 피스가 겹치면 위로 밀기
    if (G.piece) {
      let guard = 0;
      while (collides(G.piece.shape, G.piece.x, G.piece.y) && guard < 4) { G.piece.y--; guard++; }
      if (collides(G.piece.shape, G.piece.x, G.piece.y)) { gameOver(); return; }
    }
  }

  /* ───────────────────────── 점수 / HUD ───────────────────────── */
  function addScore(n, bump) {
    if (!n) return;
    G.score += Math.round(n);
    updateHUD(bump !== false);
  }

  function updateHUD(bump) {
    elRound.textContent = String(G.round);
    elScore.textContent = fmt(G.score);
    elBest.textContent = fmt(Math.max(G.best, G.score));
    if (bump && elScoreStat) {
      elScoreStat.classList.remove('bump');
      void elScoreStat.offsetWidth;
      elScoreStat.classList.add('bump');
    }
  }

  function showBanner(text, isRound) {
    bannerEl.textContent = text;
    bannerEl.classList.toggle('round', !!isRound);
    bannerEl.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => bannerEl.classList.remove('show'), isRound ? 1400 : 1150);
  }

  function shake(ms) { shakeUntil = performance.now() + ms; frame.classList.add('shake'); setTimeout(() => frame.classList.remove('shake'), ms); }
  function flashScreen() { flashEl.classList.remove('on'); void flashEl.offsetWidth; flashEl.classList.add('on'); }

  /* ───────────────────────── 파티클 ───────────────────────── */
  function burstCell(c, r, color, n) {
    const cx = offX + (c + 0.5) * cellPx;
    const cy = offY + (r + 0.5) * cellPx;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 190;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
        life: 0, max: 380 + Math.random() * 420,
        size: cellPx * (0.10 + Math.random() * 0.16),
        color, spin: Math.random() * 6,
      });
    }
    if (particles.length > 700) particles = particles.slice(-700);
  }

  function updateFx(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life += dt;
      if (p.life >= p.max) { particles.splice(i, 1); continue; }
      p.vy += 520 * (dt / 1000);
      p.x += p.vx * (dt / 1000);
      p.y += p.vy * (dt / 1000);
      p.spin += dt / 220;
    }
  }

  function drawFx() {
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxCtx.clearRect(0, 0, fw, fh);
    for (const p of particles) {
      const t = 1 - p.life / p.max;
      fxCtx.globalAlpha = Math.max(0, t);
      fxCtx.fillStyle = p.color;
      fxCtx.save();
      fxCtx.translate(p.x, p.y);
      fxCtx.rotate(p.spin);
      fxCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.8);
      fxCtx.restore();
    }
    fxCtx.globalAlpha = 1;
  }

  /* ───────────────────────── 그리기 ───────────────────────── */
  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + rr, y);
    c.arcTo(x + w, y, x + w, y + h, rr);
    c.arcTo(x + w, y + h, x, y + h, rr);
    c.arcTo(x, y + h, x, y, rr);
    c.arcTo(x, y, x + w, y, rr);
    c.closePath();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = clamp(r, 0, 255); g = clamp(g, 0, 255); b = clamp(b, 0, 255);
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  function drawBlock(c, x, y, size, color, opts) {
    const o = opts || {};
    if (size <= 0.5) return;
    const pad = size * 0.055;
    const r = size * 0.24;
    c.save();
    if (o.alpha != null) c.globalAlpha = o.alpha;
    // 그림자
    c.fillStyle = 'rgba(120,90,60,.13)';
    roundRect(c, x + pad, y + pad + size * 0.045, size - pad * 2, size - pad * 2, r);
    c.fill();
    // 본체
    const g = c.createLinearGradient(x, y, x, y + size);
    g.addColorStop(0, shade(color, 26));
    g.addColorStop(0.55, color);
    g.addColorStop(1, shade(color, -14));
    c.fillStyle = g;
    roundRect(c, x + pad, y + pad, size - pad * 2, size - pad * 2, r);
    c.fill();
    // 테두리
    c.strokeStyle = 'rgba(255,255,255,.55)';
    c.lineWidth = Math.max(1, size * 0.035);
    roundRect(c, x + pad + c.lineWidth / 2, y + pad + c.lineWidth / 2, size - pad * 2 - c.lineWidth, size - pad * 2 - c.lineWidth, r * 0.9);
    c.stroke();
    // 하이라이트
    c.fillStyle = 'rgba(255,255,255,.30)';
    roundRect(c, x + pad * 2, y + pad * 2, size - pad * 4, (size - pad * 4) * 0.3, r * 0.6);
    c.fill();
    c.restore();
  }

  function drawItemIcon(c, x, y, size, kind, alpha) {
    const def = ITEMS[kind];
    if (!def) return;
    c.save();
    if (alpha != null) c.globalAlpha = alpha;
    const cx = x + size / 2, cy = y + size / 2;
    const rad = size * 0.42;
    const glow = c.createRadialGradient(cx, cy, 0, cx, cy, rad);
    glow.addColorStop(0, def.color + 'cc');
    glow.addColorStop(1, def.color + '00');
    c.fillStyle = glow;
    c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2); c.fill();
    c.font = `${Math.floor(size * 0.62)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(def.icon, cx, cy + size * 0.03);
    c.restore();
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, fw, fh);

    // 은은한 배경
    const bg = ctx.createLinearGradient(0, 0, 0, fh);
    bg.addColorStop(0, 'rgba(255,253,246,.85)');
    bg.addColorStop(1, 'rgba(250,238,219,.85)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, fw, fh);

    // 그리드
    ctx.strokeStyle = 'rgba(180,145,108,.13)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      const x = Math.round(offX + c * cellPx) + 0.5;
      ctx.moveTo(x, offY); ctx.lineTo(x, offY + ROWS * cellPx);
    }
    for (let r = 1; r < ROWS; r++) {
      const y = Math.round(offY + r * cellPx) + 0.5;
      ctx.moveTo(offX, y); ctx.lineTo(offX + COLS * cellPx, y);
    }
    ctx.stroke();

    const clearing = G.clearAnim ? new Set(G.clearAnim.rows) : null;
    const clearP = G.clearAnim ? clamp((now - G.clearAnim.t0) / G.clearAnim.dur, 0, 1) : 0;

    // 고정 블록
    for (let r = 0; r < ROWS; r++) {
      if (clearing && clearing.has(r)) continue;
      for (let c = 0; c < COLS; c++) {
        const cell = G.board[r][c];
        if (!cell) continue;
        const x = offX + c * cellPx, y = offY + r * cellPx;
        drawBlock(ctx, x, y, cellPx, COLORS[cell.c] || '#ccc');
        if (cell.item) drawItemIcon(ctx, x, y, cellPx, cell.item);
      }
    }

    // 지워지는 줄
    if (clearing) {
      for (const r of clearing) {
        for (let c = 0; c < COLS; c++) {
          const cell = G.board[r][c];
          if (!cell) continue;
          const s = cellPx * (1 - clearP * 0.9);
          const x = offX + c * cellPx + (cellPx - s) / 2;
          const y = offY + r * cellPx + (cellPx - s) / 2;
          drawBlock(ctx, x, y, s, COLORS[cell.c] || '#ccc', { alpha: 1 - clearP * 0.85 });
        }
        ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - clearP)})`;
        ctx.fillRect(offX, offY + r * cellPx, COLS * cellPx, cellPx);
        ctx.fillStyle = `rgba(255,236,190,${0.45 * (1 - clearP)})`;
        ctx.fillRect(offX, offY + r * cellPx + cellPx * 0.35, COLS * cellPx, cellPx * 0.3);
      }
    }

    const p = G.piece;
    if (p && G.status !== 'over') {
      // 고스트
      const gy = ghostY();
      ctx.save();
      ctx.globalAlpha = 0.5;
      for (const cell of cellsOf({ ...p, y: gy })) {
        if (cell.y < 0) continue;
        const x = offX + cell.x * cellPx, y = offY + cell.y * cellPx;
        roundRect(ctx, x + cellPx * 0.1, y + cellPx * 0.1, cellPx * 0.8, cellPx * 0.8, cellPx * 0.2);
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.fill();
        ctx.strokeStyle = (COLORS[p.type] || '#999') + 'bb';
        ctx.lineWidth = Math.max(1.2, cellPx * 0.06);
        ctx.setLineDash([cellPx * 0.16, cellPx * 0.13]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      // 현재 피스
      for (const cell of cellsOf(p)) {
        if (cell.y < 0) continue;
        const x = offX + cell.x * cellPx, y = offY + cell.y * cellPx;
        drawBlock(ctx, x, y, cellPx, COLORS[p.type] || '#ccc');
        if (cell.item) drawItemIcon(ctx, x, y, cellPx, cell.item);
      }
    }

    drawFx();
  }

  function drawPreview(cv, types, slots) {
    const c = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    if (!types.length) return;
    const slotW = W / slots;
    types.forEach((type, i) => {
      if (!type) return;
      const shape = SHAPES[type];
      // 바운딩 박스
      let minR = 99, maxR = -1, minC = 99, maxC = -1;
      for (let r = 0; r < shape.length; r++) {
        for (let cc = 0; cc < shape[r].length; cc++) {
          if (shape[r][cc]) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, cc); maxC = Math.max(maxC, cc); }
        }
      }
      const w = maxC - minC + 1, h = maxR - minR + 1;
      const s = Math.min(slotW * 0.72 / w, H * 0.62 / h, 22);
      const ox = i * slotW + (slotW - w * s) / 2;
      const oy = (H - h * s) / 2;
      for (let r = minR; r <= maxR; r++) {
        for (let cc = minC; cc <= maxC; cc++) {
          if (!shape[r][cc]) continue;
          drawBlock(c, ox + (cc - minC) * s, oy + (r - minR) * s, s, COLORS[type] || '#ccc');
        }
      }
    });
  }

  /* ───────────────────────── 효과 HUD ───────────────────────── */
  let chipSlow = null, chipFever = null;
  function ensureChips() {
    if (!chipSlow) {
      chipSlow = document.createElement('span');
      chipSlow.className = 'chip slow';
      chipSlow.innerHTML = '🐢 슬로우 <b>0.0s</b>';
      effectsEl.appendChild(chipSlow);
    }
    if (!chipFever) {
      chipFever = document.createElement('span');
      chipFever.className = 'chip fever';
      chipFever.innerHTML = '🌟 2배 <b>0.0s</b>';
      effectsEl.appendChild(chipFever);
    }
  }
  function updateChips() {
    ensureChips();
    const s = G.effects.slow, f = G.effects.fever;
    chipSlow.style.display = s > 0 ? '' : 'none';
    chipFever.style.display = f > 0 ? '' : 'none';
    if (s > 0) chipSlow.querySelector('b').textContent = (s / 1000).toFixed(1) + 's';
    if (f > 0) chipFever.querySelector('b').textContent = (f / 1000).toFixed(1) + 's';
  }

  /* ───────────────────────── 게임 흐름 ───────────────────────── */
  function resetGame() {
    G.board = emptyBoard();
    G.piece = null;
    G.hold = null;
    G.canHold = true;
    G.bag = [];
    G.next = [];
    G.score = 0;
    G.lines = 0;
    G.round = 1;
    G.linesInRound = 0;
    G.time = 0;
    G.roundTimer = 0;
    G.garbageTimer = 0;
    G.dropTimer = 0;
    G.lockTimer = 0;
    G.lockResets = 0;
    G.softDropping = false;
    G.busy = false;
    G.effects = { slow: 0, fever: 0 };
    G.clearAnim = null;
    G.pieces = 0;
    G.itemsTriggered = 0;
    particles = [];
    drawPreview(holdCanvas, [], 1);
    refreshNext();
    updateHUD(false);
    updateChips();
  }

  function startGame() {
    if (window.CoaMeta && !window.CoaMeta.consumePlay()) {
      window.CoaMeta.promptCharge();
      return;
    }
    Sfx.resume();
    resetGame();
    G.status = 'playing';
    hideOverlay();
    spawnNext();
    showBanner('ROUND 1', true);
    btnPause.textContent = '⏸';
    btnPause.setAttribute('aria-label', '일시정지');
    if (window.CoaMeta) window.CoaMeta.refresh();
  }

  function pauseGame() {
    if (G.status !== 'playing' || G.busy) return;
    G.status = 'paused';
    G.softDropping = false;
    Sfx.pause();
    overlay.dataset.screen = 'pause';
    overlay.classList.add('show');
    btnPause.textContent = '▶';
    btnPause.setAttribute('aria-label', '계속하기');
  }

  function resumeGame() {
    if (G.status !== 'paused') return;
    Sfx.resume();
    G.status = 'playing';
    hideOverlay();
    btnPause.textContent = '⏸';
    btnPause.setAttribute('aria-label', '일시정지');
  }

  function togglePause() {
    if (G.status === 'playing') pauseGame();
    else if (G.status === 'paused') resumeGame();
    else if (G.status === 'ready' || G.status === 'over') startGame();
  }

  function gameOver() {
    if (G.status === 'over') return;
    G.status = 'over';
    G.softDropping = false;
    Sfx.over();
    if (G.score > G.best) {
      G.best = G.score;
      try { localStorage.setItem(SAVE_BEST, String(G.best)); } catch (e) {}
    }
    updateHUD(false);
    $('#over-score').textContent = fmt(G.score);
    $('#over-round').textContent = String(G.round);
    $('#over-lines').textContent = String(G.lines);
    const msg = G.score >= G.best && G.score > 0 ? '최고 기록이에요! 🎉' : '수고했어요! 다시 도전해 봐요 🐾';
    $('#over-msg').textContent = msg;
    overlay.dataset.screen = 'over';
    overlay.classList.add('show');
    btnPause.textContent = '⏸';
    if (window.CoaMeta) {
      if (window.CoaMeta.recordGame) window.CoaMeta.recordGame(G.score, G.round);
      window.CoaMeta.refresh();
    }
  }

  function hideOverlay() { overlay.classList.remove('show'); }

  /* ───────────────────────── 루프 ───────────────────────── */
  function update(dt) {
    if (G.status !== 'playing' || G.busy) return;
    G.time += dt;
    if (G.effects.slow > 0) G.effects.slow = Math.max(0, G.effects.slow - dt);
    if (G.effects.fever > 0) G.effects.fever = Math.max(0, G.effects.fever - dt);

    G.roundTimer += dt;
    if (G.roundTimer >= ROUND_MS) advanceRound();

    if (G.round >= 3) {
      G.garbageTimer += dt;
      const iv = Math.max(7000, 15000 - (G.round - 3) * 2000);
      if (G.garbageTimer >= iv) { G.garbageTimer = 0; riseGarbage(); }
    }

    const p = G.piece;
    if (p) {
      const interval = gravityInterval();
      const step = G.softDropping ? Math.min(interval, 46) : interval;
      G.dropTimer += dt;
      if (G.dropTimer >= step) {
        G.dropTimer = 0;
        if (!collides(p.shape, p.x, p.y + 1)) {
          p.y++;
          if (G.softDropping) addScore(1, false);
        }
      }
      if (collides(p.shape, p.x, p.y + 1)) {
        G.lockTimer += dt;
        if (G.lockTimer >= LOCK_DELAY) lockPiece();
      } else {
        G.lockTimer = 0;
      }
    }
  }

  function loop(now) {
    const dt = lastTime ? Math.min(70, now - lastTime) : 16;
    lastTime = now;
    update(dt);
    updateFx(dt);
    draw(now);
    updateChips();
    requestAnimationFrame(loop);
  }

  /* ───────────────────────── 리사이즈 ───────────────────────── */
  function resize() {
    const rect = frame.getBoundingClientRect();
    fw = Math.max(1, Math.round(rect.width));
    fh = Math.max(1, Math.round(rect.height));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    cellPx = Math.min(fw / COLS, fh / ROWS);
    offX = (fw - cellPx * COLS) / 2;
    offY = (fh - cellPx * ROWS) / 2;
    for (const cv of [canvas, fxCanvas]) {
      cv.width = Math.round(fw * dpr);
      cv.height = Math.round(fh * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(performance.now());
  }

  /* ───────────────────────── 입력 ───────────────────────── */
  function doAction(act) {
    if (G.status === 'ready') { if (act === 'pause' || act === 'hard') return; startGame(); return; }
    if (G.status === 'over') return;
    if (G.status === 'paused') { if (act === 'pause') resumeGame(); return; }
    switch (act) {
      case 'left': move(-1, 0); break;
      case 'right': move(1, 0); break;
      case 'down':
        if (move(0, 1)) addScore(1, false);
        break;
      case 'rotate': rotate(1); break;
      case 'hard': hardDrop(); break;
      case 'hold': doHold(); break;
      case 'pause': pauseGame(); break;
    }
  }

  document.querySelectorAll('.pad').forEach((btn) => {
    const act = btn.dataset.act;
    let holdTimer = null, repeatTimer = null;
    const fire = () => doAction(act);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      btn.classList.add('pressed');
      if (btn.setPointerCapture) { try { btn.setPointerCapture(e.pointerId); } catch (err) {} }
      fire();
      if (act === 'left' || act === 'right' || act === 'down') {
        holdTimer = setTimeout(() => {
          repeatTimer = setInterval(fire, act === 'down' ? 55 : 75);
        }, 170);
      }
    });
    const stop = () => {
      clearTimeout(holdTimer); clearInterval(repeatTimer);
      holdTimer = repeatTimer = null;
      btn.classList.remove('pressed');
    };
    ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture'].forEach((ev) => btn.addEventListener(ev, stop));
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  });

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Spacebar'].includes(k)) e.preventDefault();
    if (G.status === 'ready') {
      if (k === ' ' || k === 'Spacebar' || k === 'Enter') { e.preventDefault(); startGame(); return; }
    }
    if (G.status === 'over') {
      if (k === ' ' || k === 'Spacebar' || k === 'Enter' || k === 'r') { e.preventDefault(); startGame(); return; }
      return;
    }
    if (k === 'p' || k === 'P' || k === 'Escape') { e.preventDefault(); togglePause(); return; }
    if (k === 'm' || k === 'M') { toggleMute(); return; }
    if (G.status !== 'playing') return;
    switch (k) {
      case 'ArrowLeft': doAction('left'); break;
      case 'ArrowRight': doAction('right'); break;
      case 'ArrowDown': G.softDropping = true; doAction('down'); break;
      case 'ArrowUp': case 'x': case 'X': doAction('rotate'); break;
      case 'z': case 'Z': if (!G.busy) rotate(-1); break;
      case ' ': case 'Spacebar': doAction('hard'); break;
      case 'c': case 'C': case 'Shift': doAction('hold'); break;
    }
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowDown') G.softDropping = false;
  });

  window.addEventListener('blur', () => { G.softDropping = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.status === 'playing') pauseGame();
  });

  function toggleMute() {
    Sfx.muted = !Sfx.muted;
    btnSound.textContent = Sfx.muted ? '🔇' : '🔊';
    btnSound.classList.toggle('off', Sfx.muted);
    btnSound.setAttribute('aria-label', Sfx.muted ? '소리 켜기' : '소리 끄기');
    try { localStorage.setItem(SAVE_MUTE, Sfx.muted ? '1' : '0'); } catch (e) {}
    if (!Sfx.muted) { Sfx.resume(); Sfx.tone(660, { type: 'sine', dur: 0.09, gain: 0.24 }); }
  }

  btnSound.addEventListener('click', () => toggleMute());
  btnPause.addEventListener('click', () => {
    if (G.status === 'ready' || G.status === 'over') startGame();
    else togglePause();
  });
  $('#btn-start').addEventListener('click', startGame);
  $('#btn-resume').addEventListener('click', resumeGame);
  $('#btn-restart').addEventListener('click', startGame);
  $('#btn-restart-pause').addEventListener('click', startGame);

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 220));

  /* ───────────────────────── 디버그 API (테스트용) ───────────────────────── */
  if (DEBUG) {
    window.__coaTetris = {
      version: '1.0.0',
      state() {
        return {
          status: G.status,
          round: G.round,
          score: G.score,
          best: G.best,
          lines: G.lines,
          pieces: G.pieces,
          busy: G.busy,
          hold: G.hold,
          next: G.next.slice(),
          effects: { ...G.effects },
          itemsTriggered: G.itemsTriggered,
          lastItem: G.lastItem ? G.lastItem.kind : null,
          piece: G.piece ? { type: G.piece.type, x: G.piece.x, y: G.piece.y, shape: JSON.stringify(G.piece.shape), items: G.piece.items } : null,
          filled: G.board.reduce((s, row) => s + row.filter(Boolean).length, 0),
        };
      },
      board() {
        return G.board.map((row) => row.map((c) => (c ? { c: c.c, item: c.item } : null)));
      },
      setBoard(rows, items) {
        G.board = emptyBoard();
        rows.forEach((line, r) => {
          for (let c = 0; c < COLS; c++) {
            const ch = line[c];
            if (!ch || ch === '.' || ch === ' ') continue;
            const type = COLORS[ch] ? ch : 'G';
            G.board[r][c] = { c: type, item: null };
          }
        });
        if (items) {
          for (const key of Object.keys(items)) {
            const [r, c] = key.split(',').map(Number);
            if (G.board[r] && G.board[r][c]) G.board[r][c].item = items[key];
          }
        }
        return this.board();
      },
      setPiece(type) { G.piece = null; spawnPiece(type); return this.state(); },
      setItem(r, c, kind) { if (G.board[r] && G.board[r][c]) G.board[r][c].item = kind; },
      trigger(kind, r, c) { const n = activateItem(kind, r || 0, c || 0); return { removed: n, state: this.state(), board: this.board() }; },
      clearLines() { G.piece = null; return resolveClear().then(() => this.state()); },
      fullRows() { return fullRows(); },
      setRound(n) { G.round = n; G.roundTimer = 0; G.garbageTimer = 0; updateHUD(false); return G.round; },
      setScore(n) { G.score = n; updateHUD(false); return G.score; },
      riseGarbage() { riseGarbage(); return this.board(); },
      garbageTimer(ms) { G.garbageTimer = ms; },
      addEffect(kind, ms) { G.effects[kind] = ms; },
      gravityInterval() { return gravityInterval(); },
      start() { startGame(); return this.state(); },
      pause() { pauseGame(); return this.state(); },
      resume() { resumeGame(); return this.state(); },
      over() { gameOver(); return this.state(); },
      drop() { hardDrop(); return this.state(); },
      holdPiece() { doHold(); return this.state(); },
      rotate(dir) { rotate(dir || 1); return this.state(); },
      move(dx) { move(dx, 0); return this.state(); },
      ghostY() { return ghostY(); },
      setStatus(s) { G.status = s; },
      tickGravity(ms) { update(ms); return this.state(); },
    };
  }

  /* ───────────────────────── 시작 ───────────────────────── */
  window.CoaGame = {
    status: () => G.status,
    start: startGame,
    pause: pauseGame,
    resume: resumeGame,
    over: gameOver,
  };
  window.__coaStart = startGame;

  function boot() {
    try {
      const b = parseInt(localStorage.getItem(SAVE_BEST) || '0', 10);
      G.best = Number.isFinite(b) ? b : 0;
    } catch (e) { G.best = 0; }
    let muted = false;
    try { muted = localStorage.getItem(SAVE_MUTE) === '1'; } catch (e) {}
    Sfx.muted = muted;
    btnSound.textContent = muted ? '🔇' : '🔊';
    btnSound.classList.toggle('off', muted);

    G.board = emptyBoard();
    refreshNext();
    updateHUD(false);
    updateChips();
    overlay.dataset.screen = 'start';
    overlay.classList.add('show');
    if (window.CoaMeta) window.CoaMeta.refresh();
    resize();
    window.addEventListener('load', resize);
    setTimeout(resize, 120);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize).catch(() => {});
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  boot();
})();
