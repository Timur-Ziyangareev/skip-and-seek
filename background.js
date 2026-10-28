'use strict';

// Карта фреймов с видео: "tabId:frameId" -> { tabId, frameId, score, ts }
const frames = new Map();

function prune() {
  const now = Date.now();
  for (const [k, v] of frames) {
    if (now - v.ts > 8000) frames.delete(k);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return;

  // Фрейм сообщает, есть ли у него видимое видео и насколько оно "важное"
  if (msg.type === 'report') {
    if (sender.tab && sender.frameId != null) {
      const key = sender.tab.id + ':' + sender.frameId;
      frames.set(key, {
        tabId: sender.tab.id,
        frameId: sender.frameId,
        score: Number.isFinite(msg.score) ? msg.score : 0,
        ts: Date.now()
      });
      prune();
    }
    return;
  }

  // Фрейм без видео просит перемотать видео в другом фрейме той же вкладки
  if (msg.type === 'seek-remote') {
    if (!sender.tab) {
      sendResponse({ ok: false });
      return;
    }
    const tabId = sender.tab.id;
    const requester = sender.frameId;

    let best = null;
    for (const f of frames.values()) {
      if (f.tabId !== tabId || f.score <= 0) continue;
      if (f.frameId === requester) continue;
      if (!best || f.score > best.score) best = f;
    }

    if (best) {
      chrome.tabs
        .sendMessage(tabId, { type: 'do-seek', delta: msg.delta }, { frameId: best.frameId })
        .then((resp) => sendResponse(resp && resp.ok ? { ok: true } : { ok: false }))
        .catch(() => sendResponse({ ok: false }));
      return true; // асинхронный ответ
    }

    sendResponse({ ok: false });
    return;
  }
});
