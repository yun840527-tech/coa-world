/* ============================================================
   효과음 — Web Audio API (음소거 토글)
   ============================================================ */
(function () {
  'use strict';

  var ctx = null;
  var master = null;
  var muted = false;

  function ensure() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; return null; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* noop */ } }
    return ctx;
  }

  function tone(freq, dur, opts) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    opts = opts || {};
    var t0 = c.currentTime + (opts.when || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.to), t0 + dur);
    var vol = (opts.gain == null ? 0.16 : opts.gain);
    var attack = opts.attack == null ? 0.012 : opts.attack;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, opts) {
    if (muted) return;
    var c = ensure();
    if (!c) return;
    opts = opts || {};
    var len = Math.max(1, Math.floor(c.sampleRate * dur));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;
    var g = c.createGain();
    g.gain.value = opts.gain == null ? 0.08 : opts.gain;
    var f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = opts.freq || 1200;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
  }

  var Sfx = {
    setMuted: function (m) { muted = !!m; if (!muted) ensure(); },
    isMuted: function () { return muted; },
    unlock: ensure,

    tap: function () { tone(520, 0.08, { type: 'triangle', gain: 0.09 }); },
    drop: function () { tone(320, 0.13, { type: 'sine', gain: 0.14, to: 180 }); },
    flip: function () { tone(660, 0.07, { type: 'triangle', gain: 0.08, to: 880 }); },
    merge: function (tier) {
      var base = 300 + Math.min(10, tier) * 32;
      tone(base, 0.1, { type: 'triangle', gain: 0.13 });
      tone(base * 1.5, 0.16, { type: 'sine', gain: 0.11, when: 0.06 });
      noise(0.12, { gain: 0.05, freq: 2200 });
    },
    pop: function () { tone(880, 0.1, { type: 'sine', gain: 0.1, to: 1200 }); },
    match: function (combo) {
      var step = Math.min(6, Math.max(0, (combo || 1) - 1));
      var notes = [523, 659, 784, 1046];
      notes.forEach(function (n, i) {
        tone(n * Math.pow(1.06, step), 0.16, { type: 'triangle', gain: 0.1, when: i * 0.055 });
      });
    },
    wrong: function () {
      tone(196, 0.16, { type: 'square', gain: 0.07, to: 150 });
      tone(146, 0.2, { type: 'sine', gain: 0.07, when: 0.1 });
    },
    correct: function () {
      tone(784, 0.12, { type: 'triangle', gain: 0.11 });
      tone(1046, 0.18, { type: 'triangle', gain: 0.1, when: 0.08 });
    },
    charge: function () {
      [523, 659, 784, 1046, 1318].forEach(function (n, i) {
        tone(n, 0.24, { type: 'sine', gain: 0.09, when: i * 0.07 });
      });
    },
    win: function () {
      var melody = [523, 659, 784, 1046, 784, 1046, 1318];
      melody.forEach(function (n, i) {
        tone(n, 0.24, { type: 'triangle', gain: 0.1, when: i * 0.1 });
      });
    },
    over: function () {
      [392, 330, 262, 196].forEach(function (n, i) {
        tone(n, 0.3, { type: 'sine', gain: 0.11, when: i * 0.13 });
      });
    },
    tick: function () { tone(1046, 0.05, { type: 'square', gain: 0.04 }); },
    start: function () {
      [523, 659, 784].forEach(function (n, i) {
        tone(n, 0.14, { type: 'triangle', gain: 0.1, when: i * 0.07 });
      });
    }
  };

  window.Sfx = Sfx;
})();
