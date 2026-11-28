/* ============================================================
   📊 관리자용 아이들 활동 리포트
   ============================================================ */
(function () {
  'use strict';

  var elToday, elList, elToggle, elAge, elTotal, collapsed = true;

  function $(id) { return document.getElementById(id); }

  function num(n) { return (Number(n) || 0).toLocaleString('ko-KR'); }

  function init() {
    elToday = $('reportToday');
    elList = $('reportList');
    elToggle = $('reportToggle');
    elAge = $('reportAge');
    elTotal = $('reportTotal');

    if (elToggle) {
      elToggle.addEventListener('click', function () {
        collapsed = !collapsed;
        if (elList) elList.classList.toggle('is-collapsed', collapsed);
        elToggle.textContent = collapsed ? '자세히' : '접기';
      });
    }
    var copy = $('reportCopyBtn');
    if (copy) copy.addEventListener('click', copyJSON);
    var dl = $('reportDownloadBtn');
    if (dl) dl.addEventListener('click', function () {
      if (window.CoaGameStatsDownload) window.CoaGameStatsDownload({ days: 30 });
      if (window.Toast) window.Toast('활동 기록 JSON을 저장했어요');
    });

    window.addEventListener('coa:stats-updated', render);
  }

  function dowLabel(dateStr) {
    var p = dateStr.split('-');
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
  }

  function render() {
    if (!window.GameStats) return;
    var sum = GameStats.summary(7);
    var today = sum.days[0];
    var t = sum.totals;

    if (elAge && window.Store) elAge.textContent = Store.ageBandLabel(Store.settings().age);

    if (elToday) {
      elToday.innerHTML =
        card('🍉 과일 합치기', num(today.watermelon.plays) + '<span>판</span>',
          '최고 <b>' + num(today.watermelon.bestScore) + '점</b> · 합체 ' + num(today.watermelon.merges) + '번') +
        card('🃏 영단어 짝', num(today.match.plays) + '<span>판</span>',
          '최고 <b>' + num(today.match.bestScore) + '점</b> · 클리어 ' + num(today.match.clears) + '라운드') +
        '<div class="rep-card wide">' +
          '<div class="rep-title">📚 오늘 푼 문제</div>' +
          '<div class="rep-main">' + (today.quiz.asked
            ? '<b>' + num(today.quiz.correct) + '</b><span> / ' + num(today.quiz.asked) + '문제 정답</span>'
            : '<b>—</b><span> 아직 푼 문제가 없어요</span>') +
            '<span style="margin-left:auto">정답률 <b style="font-family:var(--font-body);font-size:13px">' + (today.quiz.asked ? today.quiz.accuracy + '%' : '—') + '</b></span></div>' +
          '<div class="rep-sub">영어 <b>' + today.quiz.english.correct + '/' + today.quiz.english.asked + '</b>' +
            ' · 수학 <b>' + today.quiz.math.correct + '/' + today.quiz.math.asked + '</b>' +
            ' · 충전 <b>' + today.quiz.bonuses + '회</b></div>' +
        '</div>';
    }

    if (elList) {
      var maxPlay = 1;
      var maxQuiz = 1;
      sum.days.forEach(function (d) {
        maxPlay = Math.max(maxPlay, d.watermelon.plays, d.match.plays);
        maxQuiz = Math.max(maxQuiz, d.quiz.asked);
      });
      elList.innerHTML = '';
      sum.days.forEach(function (d, i) {
        var li = document.createElement('li');
        li.className = 'rep-day' + (i === 0 ? ' is-today' : '');
        var p = d.date.split('-');
        li.innerHTML =
          '<div class="rep-date"><b>' + (i === 0 ? '오늘' : p[1] + '/' + p[2]) + '</b><span>' + dowLabel(d.date) + '요일</span></div>' +
          '<div class="rep-bars">' +
            row('🍉', d.watermelon.plays, maxPlay, '') +
            row('🃏', d.match.plays, maxPlay, '') +
            row('📚', d.quiz.asked ? (d.quiz.correct + '/' + d.quiz.asked) : '0', maxQuiz, ' q', d.quiz.asked) +
          '</div>' +
          '<div class="rep-day-detail">' +
            '최고 <b>🍉 ' + num(d.watermelon.bestScore) + ' · 🃏 ' + num(d.match.bestScore) + '</b>' +
            '영어 <b>' + d.quiz.english.correct + '/' + d.quiz.english.asked + '</b>' +
            '수학 <b>' + d.quiz.math.correct + '/' + d.quiz.math.asked + '</b>' +
            '정답률 <b>' + (d.quiz.asked ? d.quiz.accuracy + '%' : '—') + '</b>' +
            '충전 <b>' + d.quiz.bonuses + '회</b>' +
          '</div>';
        elList.appendChild(li);
      });
    }

    if (elTotal) {
      elTotal.innerHTML =
        '7일 합계 · 🍉 <b>' + num(t.watermelonPlays) + '판</b>' +
        '🃏 <b>' + num(t.matchPlays) + '판</b>' +
        '📚 <b>' + num(t.quizCorrect) + '/' + num(t.quizAsked) + '문제</b>' +
        '정답률 <b>' + (t.quizAsked ? t.quizAccuracy + '%' : '—') + '</b>' +
        '충전 <b>' + num(t.quizBonuses) + '회</b>';
    }
    if (elList) elList.classList.toggle('is-collapsed', collapsed);
    if (elToggle) elToggle.textContent = collapsed ? '자세히' : '접기';
  }

  function card(title, main, sub) {
    return '<div class="rep-card">' +
      '<div class="rep-title">' + title + '</div>' +
      '<div class="rep-main"><b>' + main + '</b></div>' +
      '<div class="rep-sub">' + sub + '</div>' +
    '</div>';
  }

  function row(icon, value, max, cls, weight) {
    var w = weight == null ? Number(value) || 0 : weight;
    var pct = Math.max(4, Math.min(100, (w / max) * 100));
    return '<div class="rep-bar-row' + (cls || '') + '">' +
      '<span class="n">' + icon + '</span>' +
      '<span class="bar"><i style="width:' + pct + '%"></i></span>' +
      '<span class="rep-num">' + value + '</span>' +
    '</div>';
  }

  function copyJSON() {
    if (!window.CoaGameStats) return;
    var text = window.CoaGameStats.toJSON({ days: 30 });
    var done = function (ok) {
      if (window.Toast) window.Toast(ok ? '활동 기록 JSON을 복사했어요' : '복사가 안 돼요 · JSON 저장을 눌러 주세요');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(fallbackCopy(text)); });
    } else {
      done(fallbackCopy(text));
    }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  window.Report = { init: init, render: render };
})();
