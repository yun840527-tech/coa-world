/* ============================================================
   과일 11단계 — 모양/색/그리기
   ============================================================ */
(function () {
  'use strict';

  var DEFS = [
    { name: '체리', r: 13, base: '#e23a52', dark: '#a81b33', light: '#ff7f90', score: 0 },
    { name: '딸기', r: 17, base: '#f24a62', dark: '#b81f37', light: '#ff8f9d', score: 0 },
    { name: '포도', r: 21, base: '#8e63c9', dark: '#5f3e96', light: '#bb98ea', score: 0 },
    { name: '귤', r: 25, base: '#ff9a2e', dark: '#d06a00', light: '#ffc470', score: 0 },
    { name: '감', r: 30, base: '#f2703c', dark: '#c04a1c', light: '#ffa87c', score: 0 },
    { name: '사과', r: 35, base: '#dd3a44', dark: '#a81f26', light: '#ff7b7b', score: 0 },
    { name: '배', r: 40, base: '#c9d96a', dark: '#94a63a', light: '#eaf3a6', score: 0 },
    { name: '복숭아', r: 46, base: '#ffb3a7', dark: '#df7f77', light: '#ffd9d2', score: 0 },
    { name: '파인애플', r: 52, base: '#f5c13b', dark: '#c29016', light: '#ffe483', score: 0 },
    { name: '멜론', r: 59, base: '#a9d96a', dark: '#75a33a', light: '#d3eda6', score: 0 },
    { name: '수박', r: 67, base: '#3fa35f', dark: '#1e6739', light: '#6fc787', score: 0 }
  ];

  // 합칠 때 점수
  var MERGE_SCORE = [0, 6, 12, 22, 36, 54, 78, 108, 145, 190, 245, 320];

  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.closePath();
  }

  function drawFace(ctx, r, mood) {
    var eyeR = Math.max(1.7, r * 0.082);
    var ex = r * 0.29;
    var ey = -r * 0.04;
    ctx.fillStyle = '#3d2b23';
    circle(ctx, -ex, ey, eyeR); ctx.fill();
    circle(ctx, ex, ey, eyeR); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    circle(ctx, -ex + eyeR * 0.32, ey - eyeR * 0.36, eyeR * 0.36); ctx.fill();
    circle(ctx, ex + eyeR * 0.32, ey - eyeR * 0.36, eyeR * 0.36); ctx.fill();

    // 입
    ctx.strokeStyle = '#3d2b23';
    ctx.lineWidth = Math.max(1.1, r * 0.045);
    ctx.lineCap = 'round';
    ctx.beginPath();
    if (mood === 'joy') {
      ctx.arc(0, r * 0.13, r * 0.26, 0.12 * Math.PI, 0.88 * Math.PI);
    } else {
      ctx.arc(0, r * 0.16, r * 0.2, 0.18 * Math.PI, 0.82 * Math.PI);
    }
    ctx.stroke();

    if (r > 17) {
      ctx.fillStyle = 'rgba(255,110,120,.30)';
      circle(ctx, -r * 0.52, r * 0.26, r * 0.16); ctx.fill();
      circle(ctx, r * 0.52, r * 0.26, r * 0.16); ctx.fill();
    }
  }

  function leaf(ctx, x, y, r, rot, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = color || '#5cae62';
    ctx.beginPath();
    ctx.ellipse(r * 0.28, 0, r * 0.28, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function draw(ctx, x, y, r, tier, opts) {
    var d = DEFS[tier] || DEFS[0];
    opts = opts || {};
    var rot = opts.rot || 0;
    var scale = opts.scale == null ? 1 : opts.scale;
    r = r * scale;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);

    // 그림자
    if (opts.shadow !== false) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = '#5b3b1f';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.9, r * 0.78, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 몸통
    var g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.05);
    g.addColorStop(0, d.light);
    g.addColorStop(0.55, d.base);
    g.addColorStop(1, d.dark);
    ctx.fillStyle = g;
    circle(ctx, 0, 0, r);
    ctx.fill();

    // 무늬
    ctx.save();
    circle(ctx, 0, 0, r);
    ctx.clip();

    if (tier === 0) { // 체리 — 꼭지
      ctx.strokeStyle = '#4e8a45';
      ctx.lineWidth = Math.max(1.4, r * 0.12);
      ctx.beginPath();
      ctx.moveTo(-r * 0.15, -r * 0.6);
      ctx.quadraticCurveTo(r * 0.1, -r * 1.25, r * 0.55, -r * 1.0);
      ctx.stroke();
      leaf(ctx, r * 0.5, -r * 1.0, r, -0.5);
    } else if (tier === 1) { // 딸기 — 씨앗
      ctx.fillStyle = 'rgba(255,236,170,.92)';
      for (var sy = -0.55; sy <= 0.6; sy += 0.34) {
        for (var sx = -0.6; sx <= 0.6; sx += 0.32) {
          if (sx * sx + sy * sy > 0.72) continue;
          ctx.beginPath();
          ctx.ellipse(sx * r, sy * r, r * 0.032, r * 0.05, 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (tier === 2) { // 포도 — 알알이
      ctx.fillStyle = 'rgba(255,255,255,.13)';
      var dots = [[-0.34, -0.3], [0.32, -0.36], [-0.05, -0.06], [-0.45, 0.18], [0.4, 0.16], [0.02, 0.42]];
      dots.forEach(function (p) { circle(ctx, p[0] * r, p[1] * r, r * 0.24); ctx.fill(); });
    } else if (tier === 3) { // 귤 — 껍질 결
      ctx.strokeStyle = 'rgba(255,255,255,.22)';
      ctx.lineWidth = Math.max(1, r * 0.045);
      for (var a = 0; a < 8; a++) {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a / 8 * Math.PI * 2) * r, Math.sin(a / 8 * Math.PI * 2) * r);
        ctx.stroke();
      }
    } else if (tier === 4) { // 감 — 꼭지 별
      ctx.strokeStyle = 'rgba(120,70,20,.18)';
      ctx.lineWidth = Math.max(1, r * 0.04);
      ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0.2, Math.PI - 0.2); ctx.stroke();
    } else if (tier === 5) { // 사과 — 세로 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath();
      ctx.ellipse(-r * 0.42, -r * 0.15, r * 0.2, r * 0.42, -0.35, 0, Math.PI * 2);
      ctx.fill();
    } else if (tier === 6) { // 배 — 점박이
      ctx.fillStyle = 'rgba(120,140,50,.35)';
      for (var i = 0; i < 12; i++) {
        var px = (Math.sin(i * 2.4) * 0.72) * r;
        var py = (Math.cos(i * 1.9) * 0.72) * r;
        circle(ctx, px, py, Math.max(0.8, r * 0.022));
        ctx.fill();
      }
    } else if (tier === 7) { // 복숭아 — 골
      ctx.strokeStyle = 'rgba(220,110,105,.35)';
      ctx.lineWidth = Math.max(1.2, r * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.92);
      ctx.quadraticCurveTo(r * 0.18, 0, 0, r * 0.95);
      ctx.stroke();
    } else if (tier === 8) { // 파인애플 — 격자
      ctx.strokeStyle = 'rgba(170,110,10,.30)';
      ctx.lineWidth = Math.max(1, r * 0.035);
      for (var k = -2; k <= 2; k++) {
        ctx.beginPath(); ctx.moveTo(-r, k * r * 0.42 - r); ctx.lineTo(r, k * r * 0.42 + r); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-r, k * r * 0.42 + r); ctx.lineTo(r, k * r * 0.42 - r); ctx.stroke();
      }
    } else if (tier === 9) { // 멜론 — 그물
      ctx.strokeStyle = 'rgba(255,255,255,.5)';
      ctx.lineWidth = Math.max(0.9, r * 0.028);
      for (var m = -2; m <= 2; m++) {
        ctx.beginPath();
        ctx.arc(m * r * 0.5, -r * 1.1, r * 1.0, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(m * r * 0.5, r * 1.1, r * 1.0, Math.PI + 0.2, -0.2);
        ctx.stroke();
      }
    } else if (tier === 10) { // 수박 — 줄무늬
      ctx.strokeStyle = 'rgba(24,80,44,.55)';
      ctx.lineWidth = Math.max(2, r * 0.075);
      for (var s2 = -2; s2 <= 2; s2++) {
        ctx.beginPath();
        ctx.moveTo(s2 * r * 0.34, -r * 1.1);
        ctx.quadraticCurveTo(s2 * r * 0.46, 0, s2 * r * 0.34, r * 1.1);
        ctx.stroke();
      }
    }
    ctx.restore();

    // 꼭지/잎 (몸통 위)
    if (tier >= 3 && tier !== 8) {
      ctx.strokeStyle = '#6b4a2b';
      ctx.lineWidth = Math.max(1.2, r * 0.055);
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.98);
      ctx.quadraticCurveTo(r * 0.06, -r * 1.12, r * 0.16, -r * 1.1);
      ctx.stroke();
      if (tier !== 4) leaf(ctx, 0, -r * 1.05, r, -0.9, '#57a85c');
    }
    if (tier === 4) { // 감 꼭지
      ctx.fillStyle = '#4f8a4b';
      for (var p2 = 0; p2 < 5; p2++) {
        ctx.save();
        ctx.rotate(p2 / 5 * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.92, r * 0.16, r * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (tier === 1) { // 딸기 꼭지
      ctx.fillStyle = '#4f9c52';
      for (var q = -2; q <= 2; q++) {
        ctx.save();
        ctx.translate(q * r * 0.22, -r * 0.82);
        ctx.rotate(q * 0.35);
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.13, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    if (tier === 8) { // 파인애플 왕관
      ctx.fillStyle = '#4f9c52';
      for (var c2 = -3; c2 <= 3; c2++) {
        ctx.save();
        ctx.translate(c2 * r * 0.14, -r * 0.94);
        ctx.rotate(c2 * 0.16);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.14, r * 0.06, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // 테두리
    ctx.strokeStyle = 'rgba(70,40,20,.16)';
    ctx.lineWidth = Math.max(1, r * 0.035);
    circle(ctx, 0, 0, r);
    ctx.stroke();

    // 얼굴
    if (opts.face !== false) drawFace(ctx, r, tier >= 9 ? 'joy' : 'smile');

    ctx.restore();
  }

  function drawIcon(canvas, tier) {
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    var size = 36;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    var c = canvas.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, size, size);
    var r = size * 0.34;
    draw(c, size / 2, size / 2 + 1, r, tier, { shadow: false });
  }

  window.FruitArt = {
    defs: DEFS,
    count: DEFS.length,
    radius: function (tier) { return DEFS[tier].r; },
    name: function (tier) { return DEFS[tier].name; },
    scoreFor: function (tier) { return MERGE_SCORE[tier] || 0; },
    draw: draw,
    drawIcon: drawIcon
  };
})();
