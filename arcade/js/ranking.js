/* ============================================================
   🏆 가족 랭킹 — 게임별 Top 10 (localStorage)
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'coa-arcade-rankings-v1';
  var KEEP = 20;
  var DEFAULT_PLAYERS = ['솜이', '쭈니', '엄마', '아빠'];

  function pad(n) { return String(n).padStart(2, '0'); }
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function clean(name) {
    return String(name || '').replace(/[<>&"]/g, '').trim().slice(0, 8);
  }

  var data = load();

  function load() {
    var raw = null;
    try { raw = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { raw = null; }
    var d = { watermelon: [], match: [] };
    if (raw && typeof raw === 'object') {
      ['watermelon', 'match'].forEach(function (g) {
        if (Array.isArray(raw[g])) {
          d[g] = raw[g]
            .filter(function (e) { return e && Number.isFinite(+e.score); })
            .map(function (e) {
              return {
                id: String(e.id || (Math.random().toString(36).slice(2) + Date.now())),
                name: clean(e.name) || '이름없음',
                score: Math.max(0, Math.round(+e.score)),
                date: typeof e.date === 'string' ? e.date : todayKey(),
                ts: Number(e.ts) || Date.now()
              };
            });
        }
      });
    }
    return d;
  }

  function save() {
    ['watermelon', 'match'].forEach(function (g) {
      data[g].sort(function (a, b) {
        return b.score - a.score || a.ts - b.ts;
      });
      if (data[g].length > KEEP) data[g] = data[g].slice(0, KEEP);
    });
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* noop */ }
    try {
      window.dispatchEvent(new CustomEvent('coa:ranking-updated'));
    } catch (e) { /* noop */ }
  }

  function add(game, name, score) {
    if (game !== 'watermelon' && game !== 'match') return null;
    var s = Math.max(0, Math.round(score || 0));
    if (s <= 0) return null;
    var entry = {
      id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      name: clean(name) || '이름없음',
      score: s,
      date: todayKey(),
      ts: Date.now()
    };
    data[game].push(entry);
    save();
    return entry;
  }

  function rename(game, id, name) {
    if (!data[game]) return false;
    var e = data[game].filter(function (x) { return x.id === id; })[0];
    if (!e) return false;
    e.name = clean(name) || e.name;
    save();
    return true;
  }

  function top(game, n) {
    return (data[game] || []).slice().sort(function (a, b) {
      return b.score - a.score || a.ts - b.ts;
    }).slice(0, n || 10).map(function (e, i) {
      return { rank: i + 1, name: e.name, score: e.score, date: e.date };
    });
  }

  function hasAny(game) {
    return !!(data[game] && data[game].length);
  }

  window.Ranking = {
    KEY: KEY,
    players: DEFAULT_PLAYERS,
    add: add,
    rename: rename,
    top: top,
    hasAny: hasAny,
    all: function () {
      return { watermelon: top('watermelon', 10), match: top('match', 10) };
    },
    clear: function (game) {
      if (game) data[game] = [];
      else { data.watermelon = []; data.match = []; }
      save();
    }
  };
})();
