/* ============================================================
   나이대별 영단어 놀이감 (5~7 / 8~9 / 10~11 / 12~13)
   ============================================================ */
(function () {
  'use strict';

  var WORDS = [
    /* -------- 0 : 5~7세 -------- */
    [
      { en: 'apple', ko: '사과', emoji: '🍎' },
      { en: 'banana', ko: '바나나', emoji: '🍌' },
      { en: 'cat', ko: '고양이', emoji: '🐱' },
      { en: 'dog', ko: '강아지', emoji: '🐶' },
      { en: 'fish', ko: '물고기', emoji: '🐟' },
      { en: 'bird', ko: '새', emoji: '🐦' },
      { en: 'sun', ko: '해', emoji: '☀️' },
      { en: 'moon', ko: '달', emoji: '🌙' },
      { en: 'star', ko: '별', emoji: '⭐' },
      { en: 'car', ko: '자동차', emoji: '🚗' },
      { en: 'bus', ko: '버스', emoji: '🚌' },
      { en: 'milk', ko: '우유', emoji: '🥛' },
      { en: 'egg', ko: '달걀', emoji: '🥚' },
      { en: 'hat', ko: '모자', emoji: '🧢' },
      { en: 'cake', ko: '케이크', emoji: '🍰' },
      { en: 'tree', ko: '나무', emoji: '🌳' },
      { en: 'book', ko: '책', emoji: '📚' },
      { en: 'rain', ko: '비', emoji: '🌧️' },
      { en: 'flower', ko: '꽃', emoji: '🌸' },
      { en: 'house', ko: '집', emoji: '🏠' },
      { en: 'ball', ko: '공', emoji: '⚽' },
      { en: 'bear', ko: '곰', emoji: '🐻' }
    ],
    /* -------- 1 : 8~9세 -------- */
    [
      { en: 'rabbit', ko: '토끼', emoji: '🐰' },
      { en: 'tiger', ko: '호랑이', emoji: '🐯' },
      { en: 'monkey', ko: '원숭이', emoji: '🐵' },
      { en: 'pencil', ko: '연필', emoji: '✏️' },
      { en: 'school', ko: '학교', emoji: '🏫' },
      { en: 'friend', ko: '친구', emoji: '👫' },
      { en: 'river', ko: '강', emoji: '🏞️' },
      { en: 'mountain', ko: '산', emoji: '⛰️' },
      { en: 'ocean', ko: '바다', emoji: '🌊' },
      { en: 'cloud', ko: '구름', emoji: '☁️' },
      { en: 'winter', ko: '겨울', emoji: '❄️' },
      { en: 'summer', ko: '여름', emoji: '🌞' },
      { en: 'doctor', ko: '의사', emoji: '🩺' },
      { en: 'guitar', ko: '기타', emoji: '🎸' },
      { en: 'robot', ko: '로봇', emoji: '🤖' },
      { en: 'picnic', ko: '소풍', emoji: '🧺' },
      { en: 'airplane', ko: '비행기', emoji: '✈️' },
      { en: 'train', ko: '기차', emoji: '🚆' },
      { en: 'bridge', ko: '다리', emoji: '🌉' },
      { en: 'forest', ko: '숲', emoji: '🌲' },
      { en: 'kitchen', ko: '부엌', emoji: '🍳' },
      { en: 'camera', ko: '카메라', emoji: '📷' },
      { en: 'birthday', ko: '생일', emoji: '🎂' },
      { en: 'treasure', ko: '보물', emoji: '💎' }
    ],
    /* -------- 2 : 10~11세 -------- */
    [
      { en: 'giraffe', ko: '기린', emoji: '🦒' },
      { en: 'penguin', ko: '펭귄', emoji: '🐧' },
      { en: 'dinosaur', ko: '공룡', emoji: '🦕' },
      { en: 'butterfly', ko: '나비', emoji: '🦋' },
      { en: 'volcano', ko: '화산', emoji: '🌋' },
      { en: 'planet', ko: '행성', emoji: '🪐' },
      { en: 'telescope', ko: '망원경', emoji: '🔭' },
      { en: 'library', ko: '도서관', emoji: '📚' },
      { en: 'hospital', ko: '병원', emoji: '🏥' },
      { en: 'airport', ko: '공항', emoji: '🛫' },
      { en: 'festival', ko: '축제', emoji: '🎉' },
      { en: 'orchestra', ko: '오케스트라', emoji: '🎻' },
      { en: 'umbrella', ko: '우산', emoji: '☂️' },
      { en: 'scissors', ko: '가위', emoji: '✂️' },
      { en: 'stadium', ko: '경기장', emoji: '🏟️' },
      { en: 'desert', ko: '사막', emoji: '🏜️' },
      { en: 'island', ko: '섬', emoji: '🏝️' },
      { en: 'magnet', ko: '자석', emoji: '🧲' },
      { en: 'microscope', ko: '현미경', emoji: '🔬' },
      { en: 'calendar', ko: '달력', emoji: '📅' },
      { en: 'backpack', ko: '배낭', emoji: '🎒' },
      { en: 'dolphin', ko: '돌고래', emoji: '🐬' },
      { en: 'squirrel', ko: '다람쥐', emoji: '🐿️' },
      { en: 'sunflower', ko: '해바라기', emoji: '🌻' },
      { en: 'adventure', ko: '모험', emoji: '🗺️' }
    ],
    /* -------- 3 : 12~13세 -------- */
    [
      { en: 'curious', ko: '궁금한', emoji: '🤔' },
      { en: 'delicious', ko: '맛있는', emoji: '😋' },
      { en: 'dangerous', ko: '위험한', emoji: '⚠️' },
      { en: 'generous', ko: '다정한', emoji: '🎁' },
      { en: 'patient', ko: '참을성 있는', emoji: '⏳' },
      { en: 'mysterious', ko: '신비로운', emoji: '🔮' },
      { en: 'hilarious', ko: '아주 웃긴', emoji: '😂' },
      { en: 'exhausted', ko: '지친', emoji: '😵' },
      { en: 'environment', ko: '환경', emoji: '🌍' },
      { en: 'experiment', ko: '실험', emoji: '🧪' },
      { en: 'imagination', ko: '상상력', emoji: '💭' },
      { en: 'responsibility', ko: '책임', emoji: '🤝' },
      { en: 'competition', ko: '경쟁', emoji: '🏆' },
      { en: 'vocabulary', ko: '어휘', emoji: '📖' },
      { en: 'celebrate', ko: '축하하다', emoji: '🎊' },
      { en: 'discover', ko: '발견하다', emoji: '🔍' },
      { en: 'promise', ko: '약속', emoji: '🤞' },
      { en: 'schedule', ko: '일정', emoji: '📆' },
      { en: 'temperature', ko: '온도', emoji: '🌡️' },
      { en: 'challenge', ko: '도전', emoji: '🧗' },
      { en: 'evidence', ko: '증거', emoji: '🔎' },
      { en: 'improve', ko: '향상시키다', emoji: '📈' },
      { en: 'confidence', ko: '자신감', emoji: '💪' },
      { en: 'opinion', ko: '의견', emoji: '💬' }
    ]
  ];

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  window.Words = {
    all: WORDS,
    band: function (i) { return WORDS[Math.max(0, Math.min(WORDS.length - 1, i))] || WORDS[0]; },
    /** 나이대 단어에서 n쌍 뽑기 */
    pickPairs: function (band, n) {
      var pool = shuffle(WORDS[Math.max(0, Math.min(WORDS.length - 1, band))] || WORDS[0]);
      if (pool.length >= n) return pool.slice(0, n);
      // 부족하면 위/아래 단계에서 보충
      var extra = [];
      [band - 1, band + 1, 0, 1, 2, 3].forEach(function (b) {
        if (b >= 0 && b < WORDS.length && b !== band) extra = extra.concat(WORDS[b]);
      });
      return pool.concat(shuffle(extra)).slice(0, n);
    },
    /** 보기용 다른 단어들 */
    distractors: function (band, answer, count, key) {
      var pool = shuffle(WORDS[Math.max(0, Math.min(WORDS.length - 1, band))] || WORDS[0])
        .concat(shuffle(WORDS[0] || []));
      var out = [];
      var seen = {};
      seen[answer[key]] = true;
      pool.forEach(function (w) {
        if (out.length >= count) return;
        if (!seen[w[key]] && w.emoji !== answer.emoji) {
          seen[w[key]] = true;
          out.push(w);
        }
      });
      return out;
    },
    shuffle: shuffle
  };
})();
