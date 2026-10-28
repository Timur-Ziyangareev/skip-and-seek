// Video Seek — content script (работает в каждом фрейме)
(function () {
  'use strict';

  const DEFAULT_SEEK = 5;
  let seekSeconds = DEFAULT_SEEK;
  let enabled = true;

  // ---------- настройки ----------
  function loadSettings(cb) {
    try {
      chrome.storage.local.get(['enabled', 'seekSeconds'], function (r) {
        if (r && typeof r.enabled === 'boolean') enabled = r.enabled;
        if (r && Number.isFinite(r.seekSeconds) && r.seekSeconds > 0) seekSeconds = r.seekSeconds;
        if (cb) cb();
      });
    } catch (e) {
      if (cb) cb();
    }
  }

  try {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area !== 'local') return;
      if (changes.enabled) enabled = !!changes.enabled.newValue;
      if (changes.seekSeconds && Number.isFinite(changes.seekSeconds.newValue) && changes.seekSeconds.newValue > 0) {
        seekSeconds = changes.seekSeconds.newValue;
      }
    });
  } catch (e) {}

  loadSettings();

  // ---------- экранное уведомление (OSD) ----------
  let osd = null;
  let osdTimer = null;
  function showOsd(text) {
    if (!osd) {
      osd = document.createElement('div');
      osd.setAttribute('data-video-seek-osd', '1');
      osd.style.cssText = [
        'position:fixed;bottom:24px;right:24px;z-index:2147483647;',
        'background:rgba(10,10,10,.8);color:#fff;',
        'font:600 15px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;',
        'padding:10px 14px;border-radius:10px;',
        'box-shadow:0 4px 16px rgba(0,0,0,.35);',
        'pointer-events:none;opacity:0;transition:opacity .15s ease;'
      ].join('');
      (document.body || document.documentElement).appendChild(osd);
    }
    osd.textContent = text;
    osd.style.opacity = '1';
    if (osdTimer) clearTimeout(osdTimer);
    osdTimer = setTimeout(function () { if (osd) osd.style.opacity = '0'; }, 800);
  }

  // ---------- утилиты ----------
  function isEditable(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  function getVisibleRect(v) {
    var r = v.getBoundingClientRect();
    if (!r || r.width < 2 || r.height < 2) return null;
    try {
      var cs = getComputedStyle(v);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return null;
    } catch (e) {}
    var vw = window.innerWidth || document.documentElement.clientWidth || 0;
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    var x = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0));
    var y = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (x < 20 || y < 20) return null;
    return { x: x, y: y, area: x * y, full: r.width * r.height };
  }

  // Обходит документ и все shadow DOM, собирая <video>
  function collectVideos() {
    var out = [];
    var seen = new Set();
    function walk(root) {
      if (!root) return;
      var nodes = [];
      try { nodes = root.querySelectorAll('video'); } catch (e) {}
      for (var i = 0; i < nodes.length; i++) {
        if (!seen.has(nodes[i])) { seen.add(nodes[i]); out.push(nodes[i]); }
      }
      try {
        var all = root.querySelectorAll('*');
        for (var j = 0; j < all.length; j++) {
          if (all[j].shadowRoot) walk(all[j].shadowRoot);
        }
      } catch (e) {}
    }
    walk(document);
    return out;
  }

  function videoScore(v) {
    var rect = getVisibleRect(v);
    if (!rect) return 0;
    var score = rect.area;
    if (Number.isFinite(v.currentTime) && v.currentTime > 0) score += 1e9;
    if (!v.paused && !v.ended && v.readyState >= 2) score += 2e9;
    if (v === document.activeElement || (document.activeElement && v.contains(document.activeElement))) score += 3e9;
    return score;
  }

  function pickVideo() {
    var best = null, bestScore = 0;
    var vids = collectVideos();
    for (var i = 0; i < vids.length; i++) {
      var s = videoScore(vids[i]);
      if (s > bestScore) { bestScore = s; best = vids[i]; }
    }
    return best;
  }

  function fmtTime(t) {
    if (!Number.isFinite(t)) return '';
    t = Math.max(0, Math.floor(t));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
    var mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
    return h > 0 ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }

  function applySeek(delta) {
    var v = pickVideo();
    if (!v) return false;
    var t = (Number.isFinite(v.currentTime) ? v.currentTime : 0) + delta;
    if (t < 0) t = 0;
    var dur = v.duration;
    if (Number.isFinite(dur) && dur > 0) t = Math.min(t, dur);
    try { v.currentTime = t; } catch (e) { return false; }
    var tail = Number.isFinite(dur) && dur > 0 ? ' / ' + fmtTime(dur) : '';
    showOsd((delta > 0 ? '+' : '−') + Math.abs(delta) + ' сек   ' + fmtTime(t) + tail);
    return true;
  }

  // ---------- ретрансляция между фреймами ----------
  function reportScore() {
    try {
      var max = 0;
      var vids = collectVideos();
      for (var i = 0; i < vids.length; i++) {
        var s = videoScore(vids[i]);
        if (s > max) max = s;
      }
      chrome.runtime.sendMessage({ type: 'report', score: max });
    } catch (e) {}
  }

  function requestRemoteSeek(delta, cb) {
    try {
      chrome.runtime.sendMessage({ type: 'seek-remote', delta: delta }, function (resp) {
        if (cb) cb(!!(resp && resp.ok));
      });
    } catch (e) {
      if (cb) cb(false);
    }
  }

  // ---------- обработка клавиш ----------
  function onKeydown(e) {
    if (!enabled) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (isEditable(e.target)) return;

    var delta = 0;
    // event.code не зависит от раскладки (работает и на русской клавиатуре)
    if (e.code === 'KeyA') delta = -seekSeconds;
    else if (e.code === 'KeyD') delta = seekSeconds;
    else {
      var k = (e.key || '').toLowerCase();
      if (k === 'a' || k === 'ф') delta = -seekSeconds;
      else if (k === 'd' || k === 'в') delta = seekSeconds;
      else return;
    }

    // быстрый путь: видео в этом же фрейме
    if (applySeek(delta)) {
      e.preventDefault();
      e.stopPropagation();
      reportScore();
      return;
    }

    // иначе пробуем найти видео в другом фрейме
    requestRemoteSeek(delta, function () {});
  }

  document.addEventListener('keydown', onKeydown, true);

  // ---------- приём команды из background ----------
  try {
    chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || msg.type !== 'do-seek') return;
      var ok = applySeek(msg.delta || 0);
      sendResponse({ ok: ok });
    });
  } catch (e) {}

  // ---------- периодический отчёт о наличии видео ----------
  setInterval(reportScore, 1500);
  window.addEventListener('resize', reportScore);
  document.addEventListener('visibilitychange', reportScore);
})();
