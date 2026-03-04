console.log('marqueeSlider.module.js loaded');

// 汎用マルキースライダー用ユーティリティ
// 必要なDOM構造:
// .slider-base       ... 外枠（data-slide-speed を持つ / 親に対して100%幅）
//   .slider-wrapper  ... スライドのグループ（トラック）
//     .slide-item    ... 各スライド（中身は用途に応じて自由）

(function () {
  const instances = [];

  function debounce(fn, delay) {
    let timer = null;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        fn();
      }, delay);
    };
  }

  function cloneAsStatic(node) {
    const clone = node.cloneNode(true);
    const stack = [clone];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || cur.nodeType !== 1) continue;
      const attrs = Array.from(cur.attributes || []);
      attrs.forEach((attr) => {
        const name = attr.name || '';
        if (name.startsWith('x-') || name.startsWith(':') || name.startsWith('@')) {
          cur.removeAttribute(name);
        }
      });
      stack.push(...Array.from(cur.children || []));
    }
    return clone;
  }

  function ensureOriginals(instance) {
    if (instance.originals && instance.originals.length) return;
    const { wrapperEl } = instance;
    const items = Array.from(wrapperEl.querySelectorAll('.slide-item'));
    instance.originals = items.map((el) => cloneAsStatic(el));
  }

  function buildTrack(instance) {
    const { baseEl, wrapperEl, originals } = instance;
    if (!baseEl || !wrapperEl || !originals || originals.length === 0) return;

    const baseRect = baseEl.getBoundingClientRect();
    const baseWidth = baseRect.width;

    // x-show などで非表示中だと width が 0 になるので、その場合は少し待って再試行
    if (!baseWidth || baseWidth <= 0) {
      const attempts = (instance.buildAttempts || 0);
      if (attempts < 5) {
        instance.buildAttempts = attempts + 1;
        setTimeout(() => buildTrack(instance), 50);
      }
      return;
    }

    instance.buildAttempts = 0;

    // 一旦トラックをリセット
    wrapperEl.innerHTML = '';

    let groupWidth = 0;
    const groupNodes = [];

    // ビューポート幅を満たすまで元スライド列を複製して1グループを構成
    // 安全のため上限を設けて無限ループを防ぐ
    const maxLoops = 20;
    let loopCount = 0;
    while (groupWidth < baseWidth && loopCount < maxLoops) {
      loopCount += 1;
      originals.forEach((tpl) => {
        const node = tpl.cloneNode(true);
        wrapperEl.appendChild(node);
        groupNodes.push(node);
      });
      groupWidth = wrapperEl.scrollWidth;
      if (originals.length === 0) break;
    }

    if (groupNodes.length === 0) return;

    // シームレスループのために、構成したグループ全体をもう一度複製
    const groupLength = groupNodes.length;
    for (let i = 0; i < groupLength; i += 1) {
      const clone = groupNodes[i].cloneNode(true);
      wrapperEl.appendChild(clone);
    }

    // コンテンツ高さを測って外枠に固定高さを与える
    const trackHeight = wrapperEl.offsetHeight;
    if (trackHeight && trackHeight > 0) {
      const prev = parseFloat(baseEl.style.height || '0');
      if (!Number.isFinite(prev) || trackHeight > prev) {
        baseEl.style.height = trackHeight + 'px';
      }
    }
  }

  function applyDuration(instance) {
    const { baseEl } = instance;
    if (!baseEl) return;
    const attr = baseEl.getAttribute('data-slide-speed');
    const sec = parseFloat(attr);
    const duration = Number.isFinite(sec) && sec > 0 ? sec : 60;
    baseEl.style.setProperty('--marquee-duration', `${duration}s`);
  }

  function init(baseEl) {
    if (!baseEl || baseEl.dataset.marqueeInitialized === '1') return;
    const wrapperEl = baseEl.querySelector('.slider-wrapper');
    if (!wrapperEl) return;

    const instance = {
      baseEl,
      wrapperEl,
      originals: null,
    };

    ensureOriginals(instance);
    if (!instance.originals || instance.originals.length === 0) return;

    instances.push(instance);
    baseEl.dataset.marqueeInitialized = '1';

    buildTrack(instance);
    applyDuration(instance);

    // 初期化完了でフェードイン＆アニメーション開始
    baseEl.classList.add('is-marquee-ready');
  }

  function initAll(root) {
    const targetRoot = root || document;
    if (!targetRoot) return;
    const bases = targetRoot.querySelectorAll('.slider-base[data-slide-speed]');
    bases.forEach((el) => init(el));
  }

  const onResize = debounce(() => {
    instances.forEach((instance) => {
      if (!instance.baseEl || !instance.baseEl.isConnected) return;
      buildTrack(instance);
      applyDuration(instance);
    });
  }, 200);

  window.addEventListener('resize', onResize);

  const MarqueeSlider = {
    initAll,
    init,
  };

  // グローバル公開（他モジュールやページ側から利用）
  window.MarqueeSlider = MarqueeSlider;
})();
