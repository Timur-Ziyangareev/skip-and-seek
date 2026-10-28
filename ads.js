// Ad bypass — content script (автопропуск рекламы на любых плеерах)
// Работает по нескольким сигналам: классы VAST/IMA/videojs/VPAID, URL рекламы,
// надписи «Реклама»/таймер рядом с видео и кнопки «Пропустить»/«Закрыть».
// Ищет элементы В ТОМ ЧИСЛЕ внутри shadow DOM (кастомные плееры вроде <video-player>).
(function () {
  'use strict';

  const DEFAULTS = { enabled: true, speed: 16, mute: false };
  let cfg = Object.assign({}, DEFAULTS);

  function load() {
    try {
      chrome.storage.local.get('adSkip', (r) => {
        if (r && r.adSkip && typeof r.adSkip === 'object') {
          cfg = Object.assign({}, DEFAULTS, r.adSkip);
        }
      });
    } catch (e) {}
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.adSkip) return;
      if (changes.adSkip.newValue && typeof changes.adSkip.newValue === 'object') {
        cfg = Object.assign({}, DEFAULTS, changes.adSkip.newValue);
      }
    });
  } catch (e) {}
  load();

  // ---------- утилиты ----------
  function isVisible(el) {
    if (!el) return false;
    if (el.offsetWidth < 1 || el.offsetHeight < 1) return false;
    try {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    } catch (e) {}
    return true;
  }

  function classNameOf(node) {
    try {
      if (!node) return '';
      const c = node.className;
      if (typeof c === 'string') return c;
      if (c && typeof c.baseVal === 'string') return c.baseVal; // SVG
      return '';
    } catch (e) { return ''; }
  }

  function isDisabled(el) {
    try {
      if (el.disabled === true) return true;
      if (el.getAttribute && el.getAttribute('disabled') != null) return true;
      if (el.getAttribute && el.getAttribute('aria-disabled') === 'true') return true;
      const c = classNameOf(el);
      if (c && /(^|[\s_-])disabled([\s_-]|$)/i.test(c)) return true;
    } catch (e) {}
    return false;
  }

  function click(el) {
    try {
      el.click();
      ['pointerdown', 'pointerup', 'mousedown', 'mouseup'].forEach((t) => {
        try {
          el.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window }));
        } catch (e) {}
      });
    } catch (e) {}
  }

  // ---------- отладка: проброс DOM рекламы в top-фрейм ----------
  let __lastAdDebug = 0;

  function reportAdDebug(btn) {
    const now = Date.now();
    if (now - __lastAdDebug < 4000) return;
    __lastAdDebug = now;
    try {
      const ancestors = [];
      let p = btn;
      let depth = 0;
      while (p && depth < 7) {
        p = p.parentElement;
        if (p) {
          ancestors.push((p.tagName || '') + ' id=' + (p.id || '') + ' class=' + classNameOf(p) + ' :: ' + (p.outerHTML || '').slice(0, 300));
        }
        depth++;
      }
      const videos = collectDeep('video').map(function (v) {
        return {
          cls: classNameOf(v),
          dur: Number.isFinite(v.duration) ? Math.round(v.duration) : 'n/a',
          paused: !!v.paused,
          src: (v.currentSrc || v.src || '').slice(0, 120)
        };
      });
      const payload = {
        kind: 'ad-dom',
        at: location.href,
        skipBtn: (btn.outerHTML || '').slice(0, 500),
        ancestors: ancestors,
        videos: videos
      };
      if (window !== window.top) {
        try { window.top.postMessage({ __videoseek_log: payload }, '*'); } catch (e) {}
      } else {
        console.log('[VideoSeek] AD DOM', JSON.stringify(payload));
      }
    } catch (e) {}
  }

  try {
    window.addEventListener('message', function (e) {
      if (e && e.data && e.data.__videoseek_log) {
        const m = e.data.__videoseek_log;
        const label = (m && m.kind === 'skip-short') ? 'SKIP SHORT (из iframe)' : 'AD DOM (из iframe)';
        console.log('[VideoSeek] ' + label, JSON.stringify(m));
      }
    });
  } catch (e) {}

  // Глубокий обход: document + все shadow roots
  function collectDeep(selector, root) {
    root = root || document;
    const out = [];
    const seen = new Set();
    function walk(r) {
      if (!r) return;
      let nodes = [];
      try { nodes = r.querySelectorAll(selector); } catch (e) {}
      for (let i = 0; i < nodes.length; i++) {
        if (!seen.has(nodes[i])) { seen.add(nodes[i]); out.push(nodes[i]); }
      }
      try {
        const all = r.querySelectorAll('*');
        for (let j = 0; j < all.length; j++) {
          if (all[j].shadowRoot) walk(all[j].shadowRoot);
        }
      } catch (e) {}
    }
    walk(root);
    return out;
  }

  // ---------- кнопки пропуска/закрытия ----------
  const SKIP_RE = /skip|пропустить|пропустити|перейти к видео|продолжить просмотр|überspringen|passer l.?annonce|saltar|ignorar|跳過|跳过|광고 건너뛰기|pular anúncio|atlama|skip intro|skip recap/i;
  const CLOSE_RE = /закрыть рекламу|закрити рекламу|close ad|закрыть объявление|пропустить объявление|пропустить рекламу/i;
  const AD_BTN_CLASS_RE = /(ad-skip|ad-close|ad-dismiss|skip-ad|close-ad|skip-button|ad-button|vast-skip|skip-ad-button|ad-skip-button)/i;

  function findActionButton() {
    const candidates = collectDeep('button, [role="button"], .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
    for (let i = 0; i < candidates.length; i++) {
      const el = candidates[i];
      if (AD_BTN_CLASS_RE.test(classNameOf(el)) && isVisible(el) && !isDisabled(el)) return el;
      const al = (el.getAttribute && el.getAttribute('aria-label')) || '';
      if (al && (SKIP_RE.test(al) || CLOSE_RE.test(al)) && isVisible(el) && !isDisabled(el)) return el;
    }
    for (let i = 0; i < candidates.length; i++) {
      const b = candidates[i];
      const txt = (b.textContent || '').trim();
      if (!txt || txt.length > 40) continue;
      if ((SKIP_RE.test(txt) || CLOSE_RE.test(txt)) && isVisible(b) && !isDisabled(b)) return b;
    }
    return null;
  }

  // ---------- определение «играет реклама» ----------
  const AD_CLASS_RE = /(vjs-ad-playing|vjs-ad-loading|vjs-ad-content-resuming|ima-ad|ima-ads|ad-showing|ad-interrupting|ad-playing|video-ad|vast-|vpaid|instream|ad-container|ad-overlay|ad-label|ad-timer|ad-badge|ad-tag|ad-slot|ad-sdk|ad-break|reklama|advertisement|ad-countdown)/i;

  function adByClass(v) {
    let node = v, depth = 0;
    while (node && depth < 12) {
      const c = classNameOf(node);
      if (c && AD_CLASS_RE.test(c)) return true;
      if (node.id && AD_CLASS_RE.test(node.id)) return true;
      node = node.parentElement || node.parentNode;
      depth++;
    }
    return false;
  }

  const AD_SRC_RE = /(^|[\/._-])(ad|ads|vast|doubleclick|googlesyndication|googletagservices|pagead2|serving-sys|serving|aniview|springserve|adserver|adtech|2mdn|adnxs|rtb|pubmatic|criteo|imasdk|vpaid|sizmek)([\/._?=-]|$)/i;

  function adBySrc(v) {
    try {
      const s = v.currentSrc || v.src || '';
      if (s && AD_SRC_RE.test(s)) return true;
      if (s && /strm\.yandex|vh-canvas-converted|adfox|yandex.*\/ads\/|adriver|weborama|prestreamnos|zerocdn|adsp|bidster|alfadart|smi2|ussp|utraff/i.test(s)) return true;
    } catch (e) {}
    return false;
  }

  const AD_TEXT_RE = /реклама|пропустить рекламу|advertisement|пропустить объявление|реклама закончится|через\s*\d+\s*сек|ad\s*[:—–]\s*\d/i;

  function adMarkerNear(v) {
    const now = Date.now();
    if (v.__vsAt && now - v.__vsAt < 800) return !!v.__vsVal;
    v.__vsAt = now;

    let root = null;
    try {
      root = v.closest('.video-js, .jwplayer, .player, .plyr, [data-player], [class*="player"], [class*="video"], [id*="player"], [id*="video"]');
    } catch (e) {}
    if (!root || root.nodeType === 9) {
      try { root = v.getRootNode(); } catch (e) {}
      if (!root || root.nodeType === 9) root = v.parentElement || v;
    }

    let nodes = [];
    try { nodes = root.querySelectorAll('div, span, p, button, video, section, a'); } catch (e) {}
    let found = false;
    const limit = Math.min(nodes.length, 400);
    for (let i = 0; i < limit; i++) {
      const n = nodes[i];
      const c = classNameOf(n);
      if (c && AD_CLASS_RE.test(c) && isVisible(n)) { found = true; break; }
      const txt = (n.textContent || '').trim();
      if (txt && txt.length <= 60 && AD_TEXT_RE.test(txt) && isVisible(n)) { found = true; break; }
    }
    v.__vsVal = found;
    return found;
  }

  function isVideoInAd(v) {
    if (adByClass(v) || adBySrc(v)) return true;
    return adMarkerNear(v);
  }

  let __lastSkipLog = 0;
  function logSkipShort(videos) {
    const now = Date.now();
    if (now - __lastSkipLog < 5000) return;
    __lastSkipLog = now;
    const info = {
      kind: 'skip-short',
      frame: location.href,
      vids: videos.map(function (v) {
        const d = Number.isFinite(v.duration) ? v.duration : 0;
        return { dur: Math.round(d), cls: classNameOf(v), paused: !!v.paused, src: (v.currentSrc || v.src || '').slice(0, 100) };
      })
    };
    if (window !== window.top) {
      try { window.top.postMessage({ __videoseek_log: info }, '*'); } catch (e) {}
    } else {
      console.log('[VideoSeek] SKIP SHORT', JSON.stringify(info));
    }
  }

  // ---------- управление скоростью ----------
  const spedUp = new Map(); // video -> { rate, muted }

  function restoreOne(v) {
    const saved = spedUp.get(v);
    if (!saved) return;
    try { v.playbackRate = saved.rate || 1; } catch (e) {}
    if (cfg.mute) { try { v.muted = saved.muted; } catch (e) {} }
    spedUp.delete(v);
  }

  function restoreAll() {
    Array.from(spedUp.keys()).forEach(restoreOne);
  }

  // защита от повтора: каждый уникальный src дожимаем один раз.
  // Ключ — src, а НЕ элемент: плееры переиспользуют один <video> под каждую рекламу.
  const seekedSrcs = new Set();
  let lastClickAt = 0;
  let lastSeekAt = 0;

  function handleAds() {
    if (!cfg.enabled) {
      restoreAll();
      return;
    }

    const btn = findActionButton();
    if (btn) {
      const nowClick = Date.now();
      if (nowClick - lastClickAt > 1500) {
        lastClickAt = nowClick;
        click(btn);
        reportAdDebug(btn);
      }
    }

    const videos = collectDeep('video');
    let skippedAny = false;
    for (let i = 0; i < videos.length; i++) {
      const v = videos[i];
      if (!isVisible(v) && v.paused) { restoreOne(v); continue; }

      if (isVideoInAd(v)) {
        const d = Number.isFinite(v.duration) ? v.duration : 0;
        if (d >= 3 && d < 180 && !v.paused) {
          // короткий играющий рекламный ролик → дожимаем до конца (срабатывает ended)
          const src = v.currentSrc || v.src || '';
          if (src && !seekedSrcs.has(src)) {
            const nowSeek = Date.now();
            if (nowSeek - lastSeekAt > 800) {
              seekedSrcs.add(src);
              lastSeekAt = nowSeek;
              try {
                v.currentTime = Math.max(0, d - 0.05);
                const p = v.play();
                if (p && p.catch) p.catch(function () {});
                skippedAny = true;
              } catch (e) {}
            }
          }
        } else if (!v.paused) {
          if (!spedUp.has(v)) spedUp.set(v, { rate: v.playbackRate || 1, muted: !!v.muted });
          if (v.playbackRate !== cfg.speed) { try { v.playbackRate = cfg.speed; } catch (e) {} }
          if (cfg.mute && !v.muted) { try { v.muted = true; } catch (e) {} }
        }
      } else {
        restoreOne(v);
      }
    }

    if (skippedAny) logSkipShort(videos);
  }

  // ---------- периодический запуск ----------
  setInterval(handleAds, 250);
  // плееры часто сбрасывают playbackRate — удерживаем скорость
  setInterval(() => {
    for (const v of spedUp.keys()) {
      if (v.playbackRate !== cfg.speed) { try { v.playbackRate = cfg.speed; } catch (e) {} }
      if (cfg.mute && !v.muted) { try { v.muted = true; } catch (e) {} }
    }
  }, 100);

  // ---------- наблюдатель за DOM ----------
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; handleAds(); }, 120);
  }

  const mo = new MutationObserver(schedule);
  function observe() {
    if (document.body) {
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
      });
    }
  }
  if (document.body) observe();
  else document.addEventListener('DOMContentLoaded', observe);
})();
