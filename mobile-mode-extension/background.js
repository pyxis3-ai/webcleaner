'use strict';

// Why this exists (reverse-engineered, traced to the wire):
//   GET https://m.facebook.com/  ->  301  location: https://www.facebook.com/?_rdr
//   The decision is made at FB's edge from the REQUEST headers:
//     user-agent: …Macintosh… Chrome…      (desktop)
//     sec-ch-ua-mobile: ?0                  (Client Hint: "not mobile")
//   …and it returns the 301 before any page JS runs. So a userscript NEVER executes
//   on the mobile host — it can't influence this. The only lever is the request's
//   User-Agent / Sec-CH-UA-Mobile headers, which only the browser can set on a
//   navigation. A userscript can't. declarativeNetRequest (this extension) can.
//
// Verified: with a mobile UA, www.facebook.com serves its mobile interface on a
// 1280px desktop window (mobile viewport meta, no desktop sidebars, mobile tab bar).

const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const RULE_ID = 1;

// One dynamic rule: rewrite the UA (+ the two client hints sites actually sniff) on
// every request while Mobile Mode is on. Covers the main document AND subresources/XHR
// so the site's own API calls also return mobile data.
const rule = {
  id: RULE_ID,
  priority: 1,
  action: {
    type: 'modifyHeaders',
    requestHeaders: [
      { header: 'user-agent', operation: 'set', value: MOBILE_UA },
      { header: 'sec-ch-ua-mobile', operation: 'set', value: '?1' },
      { header: 'sec-ch-ua-platform', operation: 'set', value: '"Android"' },
    ],
  },
  condition: {
    resourceTypes: ['main_frame', 'sub_frame', 'xmlhttprequest', 'script', 'stylesheet', 'image', 'font', 'media', 'other'],
  },
};

async function isOn() {
  const { on } = await chrome.storage.local.get('on');
  return !!on;
}

async function apply(on) {
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [RULE_ID],
    addRules: on ? [rule] : [],
  });
  await chrome.action.setBadgeText({ text: on ? 'M' : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
}

// Restore state across browser/extension restarts.
chrome.runtime.onInstalled.addListener(async () => apply(await isOn()));
chrome.runtime.onStartup.addListener(async () => apply(await isOn()));

// Toolbar click toggles Mobile Mode and reloads the current tab so it re-requests
// with the new User-Agent.
chrome.action.onClicked.addListener(async (tab) => {
  const on = !(await isOn());
  await chrome.storage.local.set({ on });
  await apply(on);
  if (tab && tab.id != null) {
    try { await chrome.tabs.reload(tab.id); } catch (e) { /* tab may not be reloadable */ }
  }
});
