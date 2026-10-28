'use strict';

const enabledEl = document.getElementById('enabled');
const seekEl = document.getElementById('seekSeconds');
const adEnabledEl = document.getElementById('adEnabled');

chrome.storage.local.get(['enabled', 'seekSeconds', 'adSkip'], (r) => {
  enabledEl.checked = r.enabled !== false;
  seekEl.value = Number.isFinite(r.seekSeconds) && r.seekSeconds > 0 ? r.seekSeconds : 5;

  const a = (r.adSkip && typeof r.adSkip === 'object') ? r.adSkip : {};
  adEnabledEl.checked = a.enabled !== false;
});

function saveAdSkip() {
  chrome.storage.local.set({ adSkip: { enabled: adEnabledEl.checked } });
}

enabledEl.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: enabledEl.checked });
});

seekEl.addEventListener('change', () => {
  let v = parseInt(seekEl.value, 10);
  if (!Number.isFinite(v) || v < 1) v = 5;
  if (v > 600) v = 600;
  seekEl.value = v;
  chrome.storage.local.set({ seekSeconds: v });
});

adEnabledEl.addEventListener('change', saveAdSkip);
