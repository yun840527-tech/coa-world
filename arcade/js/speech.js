/* ============================================================
   영어 발음 — Web Speech API (en-US, rate 0.88)
   미지원 브라우저에서는 조용히 아무 것도 하지 않는다.
   ============================================================ */
(function () {
  'use strict';

  var synth = window.speechSynthesis || null;
  var supported = !!(synth && window.SpeechSynthesisUtterance);
  var voices = [];
  var preferred = null;

  function rank(v) {
    var name = (v.name || '').toLowerCase();
    var lang = (v.lang || '').toLowerCase();
    var score = 0;
    if (lang === 'en-us') score += 10;
    else if (lang.indexOf('en') === 0) score += 5;
    if (name.indexOf('samantha') >= 0) score += 6;
    if (name.indexOf('google us english') >= 0) score += 6;
    if (name.indexOf('aria') >= 0 || name.indexOf('jenny') >= 0) score += 4;
    if (name.indexOf('natural') >= 0 || name.indexOf('neural') >= 0) score += 3;
    if (v.localService) score += 1;
    return score;
  }

  function loadVoices() {
    if (!supported) return;
    try { voices = synth.getVoices() || []; } catch (e) { voices = []; }
    if (voices.length) {
      preferred = voices.slice().sort(function (a, b) { return rank(b) - rank(a); })[0] || null;
    }
  }

  loadVoices();
  if (supported && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', loadVoices);
  } else if (supported) {
    synth.onvoiceschanged = loadVoices;
  }

  function speak(text, opts) {
    if (!supported || !text) return false;
    opts = opts || {};
    try {
      synth.cancel();
      var u = new SpeechSynthesisUtterance(String(text));
      u.lang = 'en-US';
      u.rate = opts.rate == null ? 0.88 : opts.rate;
      u.pitch = opts.pitch == null ? 1.05 : opts.pitch;
      u.volume = opts.volume == null ? 1 : opts.volume;
      if (preferred) u.voice = preferred;
      if (typeof opts.onstart === 'function') u.onstart = opts.onstart;
      if (typeof opts.onend === 'function') u.onend = opts.onend;
      if (typeof opts.onerror === 'function') u.onerror = opts.onerror;
      synth.speak(u);
      return true;
    } catch (e) {
      return false;
    }
  }

  window.Speech = {
    supported: supported,
    /** 사용자가 🔊 버튼을 눌렀을 때: 음소거와 무관하게 발음 */
    say: function (text, opts) { return speak(text, opts); },
    /** 자동 발음: 음소거 상태면 하지 않음 */
    auto: function (text) {
      if (!supported) return false;
      var muted = false;
      try { muted = !!(window.Store && window.Store.settings().muted); } catch (e) { /* noop */ }
      if (muted) return false;
      return speak(text, { rate: 0.88 });
    },
    cancel: function () { if (supported) { try { synth.cancel(); } catch (e) { /* noop */ } } }
  };
})();
