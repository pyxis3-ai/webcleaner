'use strict';

// Cross-browser (Chrome/Edge + Firefox). Driven by an inline on-page button
// (content.js) - no popup. One toggle, "best mobile the browser allows":
//   - Chrome/Edge: true device-mode reflow via the debugger API (Emulation.*).
//   - Firefox: rewrite the User-Agent (declarativeNetRequest) so UA-sniffing sites
//     serve their mobile site. Firefox has no extension viewport API, so true reflow
//     there is the built-in Responsive Design Mode (Ctrl+Shift+M).

const api = globalThis.browser || globalThis.chrome;
const HAS_DEBUGGER = !!(globalThis.chrome && globalThis.chrome.debugger);

const RULE_ID = 1;
const PROTO = '1.3';
const PHONE = {
  width: 412, height: 915, dpr: 2.625, platform: 'Android', platformVersion: '14', model: 'Pixel 8',
  ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
};

// --- Firefox / lightweight: UA rewrite via declarativeNetRequest -------------
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
  await api.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [RULE_ID], addRules: on ? [uaRule(PHONE.ua)] : [] });
}
async function uaOn() { const { uaOnly } = await api.storage.local.get('uaOnly'); return !!uaOnly; }

// --- Chrome/Edge: true device emulation via chrome.debugger -----------------
const emulated = new Set(); // tabIds currently emulated
function send(tabId, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params || {}, (res) => {
      const e = chrome.runtime.lastError; if (e) reject(new Error(e.message)); else resolve(res);
    });
  });
}
function attach(tabId) {
  return new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, PROTO, () => {
      const e = chrome.runtime.lastError; if (e) reject(new Error(e.message)); else resolve();
    });
  });
}
async function applyDevice(tabId) {
  await send(tabId, 'Emulation.setUserAgentOverride', { userAgent: PHONE.ua, userAgentMetadata: {
    brands: [{ brand: 'Chromium', version: '126' }, { brand: 'Google Chrome', version: '126' }, { brand: 'Not.A/Brand', version: '24' }],
    fullVersion: '126.0.0.0', platform: PHONE.platform, platformVersion: PHONE.platformVersion, architecture: '', model: PHONE.model, mobile: true,
  } });
  await send(tabId, 'Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send(tabId, 'Emulation.setDeviceMetricsOverride', { width: PHONE.width, height: PHONE.height, deviceScaleFactor: PHONE.dpr, mobile: true });
}
async function startDevice(tabId) {
  if (!emulated.has(tabId)) { await attach(tabId); await send(tabId, 'Page.enable'); }
  emulated.add(tabId);
  await applyDevice(tabId);
  try { await send(tabId, 'Page.reload', {}); } catch (e) {}
}
async function stopDevice(tabId) {
  if (!emulated.has(tabId)) return;
  emulated.delete(tabId);
  try { await send(tabId, 'Emulation.clearDeviceMetricsOverride'); } catch (e) {}
  try { await send(tabId, 'Emulation.setTouchEmulationEnabled', { enabled: false }); } catch (e) {}
  await new Promise((r) => chrome.debugger.detach({ tabId }, () => { void chrome.runtime.lastError; r(); }));
}
if (HAS_DEBUGGER) {
  chrome.debugger.onEvent.addListener((s, m) => { if (m === 'Page.frameNavigated' && s.tabId != null && emulated.has(s.tabId)) applyDevice(s.tabId).catch(() => {}); });
  chrome.debugger.onDetach.addListener((s) => { if (s.tabId != null) emulated.delete(s.tabId); });
}
api.tabs.onRemoved.addListener((tabId) => emulated.delete(tabId));

// --- shared toggle -----------------------------------------------------------
async function isActive(tabId) { return HAS_DEBUGGER ? (tabId != null && emulated.has(tabId)) : await uaOn(); }
async function doToggle(tabId) {
  if (HAS_DEBUGGER) {
    if (tabId == null) return { error: 'no active tab' };
    if (emulated.has(tabId)) await stopDevice(tabId); else await startDevice(tabId);
    return { active: emulated.has(tabId) };
  }
  const on = !(await uaOn());
  await api.storage.local.set({ uaOnly: on });
  await setUaOnly(on);
  if (tabId != null) api.tabs.reload(tabId);
  return { active: on };
}

// inline button (content script) + toolbar icon both drive the same toggle
api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    let tabId = sender && sender.tab && sender.tab.id;
    if (tabId == null) { const t = (await api.tabs.query({ active: true, currentWindow: true }))[0]; tabId = t && t.id; }
    try {
      if (msg.cmd === 'state') sendResponse({ hasDebugger: HAS_DEBUGGER, active: await isActive(tabId) });
      else if (msg.cmd === 'toggle') sendResponse(await doToggle(tabId));
      else sendResponse({ ok: true });
    } catch (e) { sendResponse({ error: String((e && e.message) || e) }); }
  })();
  return true;
});
if (api.action && api.action.onClicked) api.action.onClicked.addListener((tab) => doToggle(tab && tab.id));

api.runtime.onStartup.addListener(async () => setUaOnly(await uaOn()));
api.runtime.onInstalled.addListener(async () => setUaOnly(await uaOn()));
