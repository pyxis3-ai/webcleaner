'use strict';

// Mobile Mode - two ways to get mobile on a desktop browser:
//
// 1) "Mobile UA only" (no banner): a global declarativeNetRequest rule rewrites the
//    User-Agent + UA client hints to a phone, so UA-sniffing sites (Facebook, YouTube)
//    serve their mobile site. It does NOT reflow pure-CSS-responsive sites - the
//    viewport stays desktop-width, so CSS @media still sees a wide window.
//
// 2) "Device mode" (true reflow; shows Chrome's "debugging this browser" banner):
//    attaches the DevTools protocol to the active tab and calls
//    Emulation.setDeviceMetricsOverride + setUserAgentOverride + setTouchEmulationEnabled
//    - exactly what DevTools device mode / responsive design mode does. This reflows
//    ANY site, normal CSS-responsive ones included, because it changes the real viewport.

const RULE_ID = 1;
const PROTO = '1.3';

const DEVICES = {
  pixel:      { label: 'Pixel 8',         width: 412, height: 915,  dpr: 2.625, platform: 'Android', platformVersion: '14',   model: 'Pixel 8',
                ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' },
  iphone:     { label: 'iPhone',          width: 393, height: 852,  dpr: 3,     platform: 'iOS', platformVersion: '17.5', model: 'iPhone',
                ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  ipad:       { label: 'iPad mini',       width: 768, height: 1024, dpr: 2,     platform: 'iOS', platformVersion: '17.5', model: 'iPad',
                ua: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  responsive: { label: 'Responsive 390',  width: 390, height: 844,  dpr: 3,     platform: 'Android', platformVersion: '14', model: '',
                ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' },
};

// --- mode 1: UA-only via declarativeNetRequest -------------------------------
function uaRule(ua) {
  return {
    id: RULE_ID, priority: 1,
    action: { type: 'modifyHeaders', requestHeaders: [
      { header: 'user-agent', operation: 'set', value: ua },
      { header: 'sec-ch-ua-mobile', operation: 'set', value: '?1' },
      { header: 'sec-ch-ua-platform', operation: 'set', value: '"Android"' },
    ] },
    condition: { resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet', 'image', 'font', 'media', 'other'] },
  };
}
async function setUaOnly(on) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: on ? [uaRule(DEVICES.pixel.ua)] : [],
  });
}
async function uaOn() { const { uaOnly } = await chrome.storage.local.get('uaOnly'); return !!uaOnly; }

// --- mode 2: true device emulation via chrome.debugger -----------------------
const emulated = new Map(); // tabId -> device key

function uaMeta(d) {
  return {
    brands: [{ brand: 'Chromium', version: '126' }, { brand: 'Google Chrome', version: '126' }, { brand: 'Not.A/Brand', version: '24' }],
    fullVersion: '126.0.0.0', platform: d.platform, platformVersion: d.platformVersion || '',
    architecture: '', model: d.model || '', mobile: true,
  };
}
function send(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (res) => {
      const e = chrome.runtime.lastError;
      if (e) reject(new Error(e.message)); else resolve(res);
    });
  });
}
function attach(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, PROTO, () => {
      const e = chrome.runtime.lastError;
      if (e) reject(new Error(e.message)); else resolve();
    });
  });
}
async function applyDevice(tabId, d) {
  await send(tabId, 'Emulation.setUserAgentOverride', { userAgent: d.ua, userAgentMetadata: uaMeta(d) });
  await send(tabId, 'Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send(tabId, 'Emulation.setDeviceMetricsOverride', { width: d.width, height: d.height, deviceScaleFactor: d.dpr, mobile: true });
}
async function startDevice(tabId, key) {
  const d = DEVICES[key];
  if (!d) return;
  if (!emulated.has(tabId)) {
    await attach(tabId);
    await send(tabId, 'Page.enable');
  }
  emulated.set(tabId, key);
  await applyDevice(tabId, d);
  try { await send(tabId, 'Page.reload', {}); } catch (e) { /* ignore */ }
}
async function stopDevice(tabId) {
  if (!emulated.has(tabId)) return;
  emulated.delete(tabId);
  try { await send(tabId, 'Emulation.clearDeviceMetricsOverride'); } catch (e) {}
  try { await send(tabId, 'Emulation.setTouchEmulationEnabled', { enabled: false }); } catch (e) {}
  await new Promise((r) => chrome.debugger.detach({ tabId }, () => { void chrome.runtime.lastError; r(); }));
}

// Re-apply metrics after navigations (debugger stays attached across them).
chrome.debugger.onEvent.addListener((source, method) => {
  if (method === 'Page.frameNavigated' && source.tabId != null && emulated.has(source.tabId)) {
    const d = DEVICES[emulated.get(source.tabId)];
    if (d) applyDevice(source.tabId, d).catch(() => {});
  }
});
chrome.debugger.onDetach.addListener((source) => { if (source.tabId != null) emulated.delete(source.tabId); });
chrome.tabs.onRemoved.addListener((tabId) => { emulated.delete(tabId); });

// --- popup messaging ---------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const tab = (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
    const tabId = tab && tab.id;
    try {
      if (msg.cmd === 'state') {
        sendResponse({ uaOnly: await uaOn(), device: tabId != null ? (emulated.get(tabId) || null) : null });
      } else if (msg.cmd === 'uaOnly') {
        await chrome.storage.local.set({ uaOnly: msg.on });
        await setUaOnly(msg.on);
        if (tabId != null) chrome.tabs.reload(tabId);
        sendResponse({ ok: true });
      } else if (msg.cmd === 'device') {
        if (tabId == null) { sendResponse({ error: 'no active tab' }); return; }
        if (msg.key === 'off') await stopDevice(tabId);
        else await startDevice(tabId, msg.key);
        sendResponse({ ok: true, device: emulated.get(tabId) || null });
      } else {
        sendResponse({ ok: true });
      }
    } catch (e) {
      sendResponse({ error: String((e && e.message) || e) });
    }
  })();
  return true; // keep the channel open for the async response
});

chrome.runtime.onStartup.addListener(async () => setUaOnly(await uaOn()));
chrome.runtime.onInstalled.addListener(async () => setUaOnly(await uaOn()));
