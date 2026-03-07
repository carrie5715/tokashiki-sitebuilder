console.log('marqueeSlider.module.js loaded');

// 汎用マルキースライダー用ユーティリティ
// 必要なDOM構造:
// .slider-base       ... 外枠（data-slide-speed を持つ / 親に対して100%幅）
//   .slider-wrapper  ... スライドのグループ（トラック）
//     .slide-item    ... 各スライド（中身は用途に応じて自由）

(function () {
  const debug = false;
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

  function getGapPx(wrapperEl) {
    try {
      if (!wrapperEl) return 24;
      const style = window.getComputedStyle(wrapperEl);
      if (!style) return 24;
      const raw = style.columnGap || style.gap || '';
      const v = parseFloat(raw);
      return Number.isFinite(v) && v >= 0 ? v : 24;
    } catch (e) {
      return 24;
    }
  }

  function getBaseWidth(baseEl) {
    if (!baseEl) return 0;
    // レイアウト確定後の実効幅を優先して取得
    const direct = baseEl.clientWidth || baseEl.offsetWidth;
    if (direct && direct > 0) return direct;

    const rect = baseEl.getBoundingClientRect();
    return rect && rect.width ? rect.width : 0;
  }

  function ensureOriginals(instance) {
    if (instance.originals && instance.originals.length) return;
    const { wrapperEl } = instance;
    const items = Array.from(wrapperEl.querySelectorAll('.slide-item'));
    instance.originals = items.map((el) => cloneAsStatic(el));
  }

  function buildTrack(instance) {
    const { baseEl, wrapperEl, originals } = instance;
    if (!baseEl || !wrapperEl || !originals || originals.length === 0) return false;

    const baseWidth = getBaseWidth(baseEl);
    const vpWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 0;
    if (debug) console.log('マルキースライダー: トラック再構築 base幅=', baseWidth, 'viewport幅=', vpWidth);
    if (!baseWidth || baseWidth <= 0) {
      return false;
    }

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

    // 初回に決まった必要ループ数を下限として維持し、
    // 微小リサイズで 2 -> 1 のように縮んで周期が跳ぶのを防ぐ
    if (!Number.isFinite(instance.minLoopCount) || instance.minLoopCount <= 0) {
      instance.minLoopCount = loopCount;
    }
    const minLoops = Math.max(1, instance.minLoopCount || 1);
    while (loopCount < minLoops && loopCount < maxLoops) {
      loopCount += 1;
      originals.forEach((tpl) => {
        const node = tpl.cloneNode(true);
        wrapperEl.appendChild(node);
        groupNodes.push(node);
      });
      groupWidth = wrapperEl.scrollWidth;
    }

    if (groupNodes.length === 0 || !groupWidth) return false;

    // groupNodes全体の幅 = 1サイクルのシーム位置（loopCount分まとめた正しい距離）
    instance.trackDistance = groupWidth;

    // 初回に確定した距離を下限として保持し、
    // resize 後に distance が縮んで早戻りするのを防ぐ
    if (!Number.isFinite(instance.initialTrackDistance) || instance.initialTrackDistance <= 0) {
      instance.initialTrackDistance = groupWidth;
    }
    if (instance.trackDistance < instance.initialTrackDistance) {
      instance.trackDistance = instance.initialTrackDistance;
    }

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
    return true;
  }

  function applyDuration(instance) {
    const { baseEl, wrapperEl } = instance;
    if (!baseEl) return false;

    // data-slide-speed は「px/秒」として扱う
    // 例: 40 → 1秒間に40px進む速度
    const attr = baseEl.getAttribute('data-slide-speed');
    const pxPerSec = (() => {
      const v = parseFloat(attr);
      return Number.isFinite(v) && v > 0 ? v : 40;
    })();

    // 1サイクルで移動する距離（px）
    let distance = instance.trackDistance;
    if (!distance && wrapperEl) {
      // wrapper 全体の半分（2列構成前提）を距離とみなすフォールバック
      distance = wrapperEl.scrollWidth / 2;
    }

    // グループ間の gap ぶんも1サイクルの移動距離に含める
    if (wrapperEl && distance) {
      const gapPx = getGapPx(wrapperEl);
      if (Number.isFinite(gapPx) && gapPx > 0) {
        distance += gapPx;
      }
    }

    if (!distance || !pxPerSec) {
      return false;
    }

    // 1サイクル分の移動距離を CSS 変数としてピクセル指定
    const distancePx = -distance;
    baseEl.style.setProperty('--marquee-distance', `${distancePx}px`);

    const durationSec = distance / pxPerSec;
    baseEl.style.setProperty('--marquee-duration', `${durationSec}s`);

    if (debug) {
      console.log(
        'マルキースライダー: duration再計算 距離(px)=',
        distance,
        '速度(px/秒)=',
        pxPerSec,
        'duration(秒)=',
        durationSec
      );
    }
    return true;
  }

  function scheduleInit(instance, attempt) {
    const maxAttempts = 50; // 約5秒 (100ms間隔)
    const { baseEl } = instance;
    const count = attempt || 0;

    if (count > maxAttempts) {
      console.warn('MarqueeSlider: failed to initialize within timeout');
      baseEl.classList.add('is-marquee-ready');
      return;
    }

    const okTrack = buildTrack(instance);
    const okDuration = okTrack && applyDuration(instance);
    if (okDuration) {
      if (instance.deferReadyUntilAssets) {
        return;
      }
      baseEl.classList.add('is-marquee-ready');
      return;
    }

    setTimeout(() => scheduleInit(instance, count + 1), 100);
  }

  function init(baseEl) {
    if (!baseEl || baseEl.dataset.marqueeInitialized === '1') return;
    const wrapperEl = baseEl.querySelector('.slider-wrapper');
    if (!wrapperEl) return;

    const instance = {
      baseEl,
      wrapperEl,
      originals: null,
      minLoopCount: null,
      initialTrackDistance: null,
      deferReadyUntilAssets: false,
    };

    ensureOriginals(instance);
    if (!instance.originals || instance.originals.length === 0) return;

    instances.push(instance);
    baseEl.dataset.marqueeInitialized = '1';

    // 画像の遅延読み込みで実寸が変わるとループ距離がズレるため再計測する
    const hasPendingImages = bindImageLoadRebuild(instance);
    instance.deferReadyUntilAssets = hasPendingImages;

    // 高さ・距離・duration が正しく計算できるまでリトライし、完了したら表示・アニメ開始
    scheduleInit(instance, 0);
  }

  function bindImageLoadRebuild(instance) {
    if (!instance || instance.imageLoadBound) return;
    const { wrapperEl } = instance;
    if (!wrapperEl) return false;

    const images = Array.from(wrapperEl.querySelectorAll('img'));
    if (!images.length) {
      instance.imageLoadBound = true;
      return false;
    }

    let pendingCount = 0;
    const finalizeAfterAssets = debounce(() => {
      if (!instance.baseEl || !instance.baseEl.isConnected) return;
      const okTrack = buildTrack(instance);
      const okDuration = okTrack && applyDuration(instance);
      if (!okDuration) return;
      instance.deferReadyUntilAssets = false;
      instance.baseEl.classList.add('is-marquee-ready');
    }, 80);

    images.forEach((img) => {
      if (!img) return;
      if (img.complete) return;
      pendingCount += 1;
      const onDone = () => {
        pendingCount -= 1;
        if (pendingCount <= 0) {
          finalizeAfterAssets();
        }
      };
      img.addEventListener('load', onDone, { once: true });
      img.addEventListener('error', onDone, { once: true });
    });

    instance.imageLoadBound = true;
    return pendingCount > 0;
  }

  function initAll(root) {
    const targetRoot = root || document;
    if (!targetRoot) return;
    const bases = targetRoot.querySelectorAll('.slider-base[data-slide-speed]');
    bases.forEach((el) => init(el));
  }

  function rebuildOnResize(instance) {
    const { baseEl, wrapperEl } = instance;
    if (!baseEl || !wrapperEl) return;

    // アニメーションをいったん止めて位置を0にリセット
    baseEl.classList.remove('is-marquee-ready');
    wrapperEl.style.animation = 'none';
    void wrapperEl.offsetHeight; // reflow を強制してリセットを確定
    wrapperEl.style.animation = '';

    const okTrack = buildTrack(instance);
    if (!okTrack) return;
    const okDuration = applyDuration(instance);
    if (!okDuration) return;

    // レイアウト確定後にアニメーション再開
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        baseEl.classList.add('is-marquee-ready');
      });
    });
  }

  const onResize = debounce(() => {
    const vpWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 0;
    if (debug) console.log('マルキースライダー: リサイズ検知 viewport幅=', vpWidth);
    instances.forEach((instance) => {
      if (!instance.baseEl || !instance.baseEl.isConnected) return;
      rebuildOnResize(instance);
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
