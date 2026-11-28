/* ============================================================
   하루 놀이 횟수 / 설정 저장소 (localStorage)
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'coa-arcade-v1';
  var DEFAULT_PIN = '5927';

  function pad(n) { return String(n).padStart(2, '0'); }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var DEFAULTS = {
    date: todayKey(),
    used: 0,
    bonus: 0,
    settings: { daily: 3, age: 8, pin: DEFAULT_PIN, muted: false, player: '솜이' },
    best: { watermelon: 0, match: 0 }
  };

  var state = load();
  rollover(true);

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* noop */ }
    var parsed = null;
    if (raw) { try { parsed = JSON.parse(raw); } catch (e) { parsed = null; } }
    if (!parsed || typeof parsed !== 'object') return clone(DEFAULTS);
    var s = clone(DEFAULTS);
    if (typeof parsed.date === 'string') s.date = parsed.date;
    if (Number.isFinite(+parsed.used)) s.used = Math.max(0, Math.round(+parsed.used));
    if (Number.isFinite(+parsed.bonus)) s.bonus = Math.max(0, Math.round(+parsed.bonus));
    if (parsed.settings) {
      if (Number.isFinite(+parsed.settings.daily)) s.settings.daily = clamp(+parsed.settings.daily, 1, 20);
      if (Number.isFinite(+parsed.settings.age)) s.settings.age = clamp(+parsed.settings.age, 5, 13);
      if (typeof parsed.settings.pin === 'string' && /^\d{4}$/.test(parsed.settings.pin)) s.settings.pin = parsed.settings.pin;
      s.settings.muted = !!parsed.settings.muted;
      if (typeof parsed.settings.player === 'string') {
        var name = parsed.settings.player.replace(/[<>&"]/g, '').trim().slice(0, 8);
        if (name) s.settings.player = name;
      }
    }
    if (parsed.best) {
      if (Number.isFinite(+parsed.best.watermelon)) s.best.watermelon = Math.max(0, Math.round(+parsed.best.watermelon));
      if (Number.isFinite(+parsed.best.match)) s.best.match = Math.max(0, Math.round(+parsed.best.match));
    }
    return s;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* noop */ }
    try {
      window.dispatchEvent(new CustomEvent('coa:state-updated', { detail: { remaining: remaining() } }));
    } catch (e) { /* noop */ }
  }

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  /** 날짜가 바뀌면 오늘 사용량/충전을 0으로 */
  function rollover(quiet) {
    var t = todayKey();
    if (state.date !== t) {
      state.date = t;
      state.used = 0;
      state.bonus = 0;
      save();
      return true;
    }
    return false;
  }

  function remaining() {
    return Math.max(0, state.settings.daily + state.bonus - state.used);
  }

  var Store = {
    KEY: KEY,
    DEFAULT_PIN: DEFAULT_PIN,

    checkDate: function () { return rollover(); },
    todayKey: todayKey,

    settings: function () { return clone(state.settings); },
    updateSettings: function (patch) {
      Object.keys(patch || {}).forEach(function (k) {
        if (k === 'daily') state.settings.daily = clamp(Math.round(patch.daily), 1, 20);
        else if (k === 'age') state.settings.age = clamp(Math.round(patch.age), 5, 13);
        else if (k === 'muted') state.settings.muted = !!patch.muted;
        else if (k === 'player') {
          var nm = String(patch.player || '').replace(/[<>&"]/g, '').trim().slice(0, 8);
          if (nm) state.settings.player = nm;
        }
        else if (k === 'pin' && /^\d{4}$/.test(patch.pin)) state.settings.pin = patch.pin;
      });
      save();
      return clone(state.settings);
    },
    setDaily: function (n) { state.settings.daily = clamp(Math.round(n), 1, 20); save(); return state.settings.daily; },
    setAge: function (n) { state.settings.age = clamp(Math.round(n), 5, 13); save(); return state.settings.age; },
    setMuted: function (m) { state.settings.muted = !!m; save(); return state.settings.muted; },
    player: function () { return state.settings.player; },
    setPlayer: function (name) {
      var nm = String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 8);
      if (!nm) return state.settings.player;
      state.settings.player = nm;
      save();
      return nm;
    },

    remaining: remaining,
    daily: function () { return state.settings.daily; },
    used: function () { return state.used; },
    bonus: function () { return state.bonus; },

    /** 놀이 시작 시 1회 차감. 남은 횟수가 없으면 false */
    consume: function () {
      rollover();
      if (remaining() <= 0) return false;
      state.used += 1;
      save();
      return true;
    },
    addBonus: function (n) {
      rollover();
      state.bonus += Math.max(1, Math.round(n || 1));
      save();
      return remaining();
    },
    resetToday: function () {
      rollover();
      state.used = 0;
      state.bonus = 0;
      save();
      return remaining();
    },

    checkPin: function (pin) { return String(pin) === state.settings.pin; },
    setPin: function (pin) {
      if (!/^\d{4}$/.test(String(pin))) return false;
      state.settings.pin = String(pin);
      save();
      return true;
    },

    best: function (game) { return state.best[game] || 0; },
    setBest: function (game, score) {
      var s = Math.max(0, Math.round(score || 0));
      if (!state.best[game] || s > state.best[game]) {
        state.best[game] = s;
        save();
        return true;
      }
      return false;
    },

    /** 나이 → 4단계 (5~7 / 8~9 / 10~11 / 12~13) */
    ageBand: function (age) {
      age = Number(age || state.settings.age);
      if (age <= 7) return 0;
      if (age <= 9) return 1;
      if (age <= 11) return 2;
      return 3;
    },
    ageBandLabel: function (age) {
      return ['5~7세', '8~9세', '10~11세', '12~13세'][Store.ageBand(age)];
    },

    /** 디버그·초기화용 */
    _resetAll: function () {
      state = clone(DEFAULTS);
      state.date = todayKey();
      save();
    }
  };

  window.Store = Store;

  // 다른 탭에서 바뀌면 동기화
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) {
      state = load();
      rollover(true);
      try { window.dispatchEvent(new CustomEvent('coa:state-updated', { detail: { remaining: remaining(), external: true } })); } catch (err) { /* noop */ }
    }
  });

  // 앱으로 돌아올 때 날짜 확인
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) Store.checkDate();
  });
})();
