/* ============================================================
   📚 문제 풀고 +1회 — 영어·수학 5문제
   ============================================================ */
(function () {
  'use strict';

  var sheet, elDots, elCorrect, elBody, elDone, elPrompt, elChoices, elBadge, elFeedback, elSpeak, elSpeakLabel;
  var questions = [];
  var qi = 0;
  var correctCount = 0;
  var lock = false;
  var openState = false;
  var askedRecorded = false;
  var band = 0;
  var speakTimer = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    sheet = $('quizSheet');
    elDots = $('quizDots');
    elCorrect = $('quizCorrectCount');
    elBody = $('quizBody');
    elDone = $('quizDone');
    elPrompt = $('quizPrompt');
    elChoices = $('quizChoices');
    elBadge = $('quizBadge');
    elFeedback = $('quizFeedback');
    elSpeak = $('quizSpeakBtn');
    elSpeakLabel = elSpeak;

    if (elSpeak) {
      elSpeak.addEventListener('click', function () {
        var q = questions[qi];
        if (!q || !q.speakText || !window.Speech) return;
        Speech.say(q.speakText, {
          onstart: function () { elSpeak.classList.add('is-playing'); },
          onend: function () { elSpeak.classList.remove('is-playing'); },
          onerror: function () { elSpeak.classList.remove('is-playing'); }
        });
      });
    }
  }

  function open() {
    if (openState) return;
    closeSheetsExcept('quiz');
    var panel = document.querySelector('.quiz-panel');
    if (panel) panel.classList.remove('is-done');
    band = window.Store ? Store.ageBand(Store.settings().age) : 0;
    questions = window.QuizData.makeSet(band, 5);
    qi = 0;
    correctCount = 0;
    lock = false;
    openState = true;
    askedRecorded = false;
    if (sheet) sheet.hidden = false;
    if (elDone) elDone.hidden = true;
    if (elBody) elBody.hidden = false;
    renderDots();
    renderQuestion();
  }

  function close() {
    openState = false;
    if (sheet) sheet.hidden = true;
    if (window.Speech) Speech.cancel();
    if (speakTimer) { clearTimeout(speakTimer); speakTimer = null; }
  }

  function closeSheetsExcept(keep) {
    ['quizSheet', 'adminSheet', 'limitSheet', 'pinSheet'].forEach(function (id) {
      if (id === keep) return;
      var el = $(id);
      if (el && !el.hidden && (id === 'limitSheet' || id === 'adminSheet' || id === 'pinSheet')) {
        el.hidden = true;
      }
    });
  }

  function renderDots() {
    if (!elDots) return;
    elDots.innerHTML = '';
    for (var i = 0; i < 5; i++) {
      var d = document.createElement('i');
      if (i < correctCount) d.className = 'on';
      else if (i === correctCount) d.className = 'now';
      elDots.appendChild(d);
    }
    if (elCorrect) elCorrect.textContent = String(correctCount);
  }

  function renderQuestion() {
    var q = questions[qi];
    if (!q) return;
    askedRecorded = false;
    renderDots();

    if (elBadge) {
      elBadge.textContent = q.kind === 'en' ? '영어' : '수학';
      elBadge.className = 'quiz-badge' + (q.kind === 'ma' ? ' math' : '');
    }
    if (elPrompt) elPrompt.innerHTML = q.promptHTML;
    if (elFeedback) { elFeedback.textContent = ''; elFeedback.className = 'quiz-feedback'; }

    if (elSpeak) {
      elSpeak.hidden = !q.speakText || !(window.Speech && Speech.supported);
    }

    if (!q._asked && window.GameStats) {
      GameStats.recordQuizAsk(q.kind);
      q._asked = true;
    }

    if (elChoices) {
      elChoices.innerHTML = '';
      elChoices.classList.toggle('one-col', q.choices.some(function (c) { return c.text.length > 9; }));
      q.choices.forEach(function (c, idx) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice';
        b.dataset.correct = c.correct ? '1' : '0';
        var num = document.createElement('span');
        num.className = 'num';
        num.textContent = String(idx + 1);
        var txt = document.createElement('span');
        txt.className = 'txt';
        txt.textContent = c.text;
        b.appendChild(num);
        b.appendChild(txt);
        b.addEventListener('click', function () { choose(c, b); });
        elChoices.appendChild(b);
      });
    }
    lock = false;

    // 자동 발음 (음소거가 아니면)
    if (q.speakText && window.Speech) {
      if (speakTimer) clearTimeout(speakTimer);
      speakTimer = setTimeout(function () {
        if (openState && questions[qi] === q) Speech.auto(q.speakText);
      }, 380);
    }
  }

  function choose(c, btn) {
    if (lock) return;
    var q = questions[qi];
    if (!q) return;

    if (c.correct) {
      lock = true;
      btn.classList.add('is-correct');
      if (window.Sfx) Sfx.correct();
      if (elFeedback) {
        elFeedback.textContent = '정답이에요! 👏 ' + (q.explain || '');
        elFeedback.className = 'quiz-feedback';
      }
      if (window.GameStats) GameStats.recordQuizCorrect(q.kind);
      correctCount += 1;
      renderDots();
      disableChoices();
      setTimeout(function () {
        if (!openState) return;
        if (correctCount >= 5) finish();
        else { qi += 1; renderQuestion(); }
      }, 780);
    } else {
      btn.classList.add('is-wrong');
      if (window.Sfx) Sfx.wrong();
      if (window.Speech && q.speakText) Speech.say(q.speakText);
      if (elFeedback) {
        elFeedback.textContent = '아쉬워요! 정답은 “' + q.answerText + '”예요. 한 번 더!';
        elFeedback.className = 'quiz-feedback bad';
      }
      // 정답 보여 주기
      Array.prototype.forEach.call(elChoices.children, function (b) {
        if (b.dataset.correct === '1') b.classList.add('is-correct');
        else b.classList.add('is-dim');
        b.disabled = true;
      });
      setTimeout(function () {
        if (!openState) return;
        // 같은 문제를 다시 (보기 순서만 섞기)
        q.choices = window.Words.shuffle(q.choices);
        if (elFeedback) { elFeedback.textContent = ''; elFeedback.className = 'quiz-feedback'; }
        renderQuestion();
      }, 1400);
    }
  }

  function disableChoices() {
    if (!elChoices) return;
    Array.prototype.forEach.call(elChoices.children, function (b) {
      b.disabled = true;
      if (b.dataset.correct !== '1') b.classList.add('is-dim');
    });
  }

  function finish() {
    var panel = document.querySelector('.quiz-panel');
    if (panel) panel.classList.add('is-done');
    if (window.GameStats) GameStats.recordQuizBonus();
    if (window.Store) Store.addBonus(1);
    if (window.Sfx) Sfx.charge();
    if (window.Confetti) window.Confetti(34);
    if (elBody) elBody.hidden = true;
    if (elDone) elDone.hidden = false;
    var n = $('quizDoneNote');
    if (n && window.Store) n.textContent = '오늘 남은 횟수 ' + Store.remaining() + '회';
    if (window.App && App.refresh) App.refresh();
  }

  window.Quiz = {
    init: init,
    open: open,
    close: close,
    isOpen: function () { return openState; },
    _state: function () { return { open: openState, qi: qi, correct: correctCount, band: band, questions: questions.length }; }
  };
})();
