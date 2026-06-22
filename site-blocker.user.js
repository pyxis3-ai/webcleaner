// ==UserScript==
// @name         Site Blocker
// @namespace    https://local/site-blocker
// @version      1.3.1
// @description  Block distracting / adult sites on demand. Adult always-on; a "Focus Pack" auto-blocks during work hours (Mon-Fri 9-6 by default) or whenever you flip "Focus mode now". Add/remove sites and toggle from the menu; "Allow for 5 min" snooze. For comprehensive adult blocking pair with a DNS family filter (Cloudflare 1.1.1.3 / NextDNS). Tampermonkey / Violentmonkey.
// @author       you
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// @downloadURL https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/site-blocker.user.js
// @updateURL   https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/site-blocker.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    blockAdultDefault: true,     // adult sites always blocked unless toggled off
    blockFocusDefault: false,    // Focus Pack: also blocked any time you turn "Focus mode now" on
    snoozeMinutes:     5,
    toggleHotkey:      { ctrl: false, alt: true, shift: true, key: 'b' },  // Alt+Shift+B toggles all blocking on/off
    // Work-hours schedule: the Focus Pack is auto-blocked during these times. days: 0=Sun … 6=Sat
    schedule: { enabled: true, days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' },
    // Edit these lists freely:
    focus: [
      'facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'reddit.com',
      'snapchat.com', 'threads.net', 'pinterest.com', 'tumblr.com', 'linkedin.com',
      'twitch.tv', 'netflix.com', 'hulu.com', 'dailymotion.com',
      'news.ycombinator.com', 'cnn.com', 'bbc.com', 'dailymail.co.uk', 'foxnews.com', 'buzzfeed.com',
      '9gag.com', 'imgur.com', 'boredpanda.com',
      'amazon.com', 'ebay.com', 'aliexpress.com', 'temu.com', 'shein.com',
    ],
    adult: ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com',
            'spankbang.com', 'onlyfans.com', 'chaturbate.com', 'stripchat.com'],
  };
  // Heuristic for the long tail of adult hostnames (kept narrow to avoid false positives like "sussex").
  const ADULT_RE = /(porn|xvideos|xhamster|hentai|camsoda|chaturbate|brazzers|onlyfans|nsfw|sexcam|sextube|camgirl)/i;

  const GM_OK = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  const gGet = (k, d) => (GM_OK ? GM_getValue(k, d) : d);
  const gSet = (k, v) => { if (GM_OK) GM_setValue(k, v); };

  const blockingOn  = gGet('sb_on', true);
  const blockAdult  = gGet('sb_adult', CONFIG.blockAdultDefault);
  const blockFocus  = gGet('sb_focus', CONFIG.blockFocusDefault);
  const scheduleOn  = gGet('sb_sched', CONFIG.schedule.enabled);
  const asList = (v) => (Array.isArray(v) ? v : []);     // tolerate corrupted / legacy storage
  const custom = asList(gGet('sb_custom', []));   // sites you added from the menu
  const allow  = asList(gGet('sb_allow', []));    // sites you removed / always allow
  const dedupe = (arr) => [...new Set(arr)];

  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  function inSchedule() {
    const s = CONFIG.schedule;
    if (!scheduleOn || !s.enabled || !s.days.includes(new Date().getDay())) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const from = toMin(s.from), to = toMin(s.to);
    return from <= to ? (cur >= from && cur < to) : (cur >= from || cur < to);
  }

  const host = location.hostname.replace(/^www\./, '');
  const inList = (list) => list.some((d) => host === d || host.endsWith('.' + d));
  const snoozed = () => {
    try { return Date.now() < parseInt(localStorage.getItem('sb_snooze') || '0', 10); } catch (e) { return false; }
  };

  function blockReason() {
    if (!blockingOn || snoozed()) return null;
    if (inList(allow)) return null;
    if (inList(custom)) return 'on your block list';
    if (blockAdult && (inList(CONFIG.adult) || ADULT_RE.test(host))) return 'blocked by the adult filter';
    if ((blockFocus || inSchedule()) && inList(CONFIG.focus))
      return blockFocus ? 'blocked by the focus filter' : 'blocked during focus hours';
    return null;
  }

  function showBlock(why) {
    try { window.stop(); } catch (e) {}
    document.documentElement.innerHTML =
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blocked</title></head><body></body>';
    const b = document.body;
    Object.assign(b.style, {
      margin: '0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '14px', textAlign: 'center', padding: '24px',
      fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0b0b0c', color: '#e9e9ea',
    });
    b.innerHTML =
      '<div style="font-size:56px">⛔</div>' +
      '<div style="font-size:22px;font-weight:600">Blocked</div>' +
      '<div style="opacity:.65;max-width:30rem">' + host + ' - ' + why + '.</div>' +
      '<button id="sb-allow" style="margin-top:6px;padding:10px 18px;border:0;border-radius:10px;cursor:pointer;font-size:14px;background:#2b2b30;color:#e9e9ea">Allow for ' + CONFIG.snoozeMinutes + ' minutes</button>' +
      '<div style="opacity:.4;font-size:12px">Manage filters from your userscript-manager menu</div>';
    const btn = document.getElementById('sb-allow');
    if (btn) btn.addEventListener('click', () => {
      try { localStorage.setItem('sb_snooze', String(Date.now() + CONFIG.snoozeMinutes * 60000)); } catch (e) {}
      location.reload();
    });
  }

  function check() {
    const why = blockReason();
    if (why && !document.getElementById('sb-allow')) showBlock(why);
  }
  check();
  setInterval(check, 30000);

  window.addEventListener('keydown', (e) => {
    const h = CONFIG.toggleHotkey;
    if (e.metaKey || e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift) return;
    if ((e.key || '').toLowerCase() !== h.key.toLowerCase()) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName || ''))) return;
    e.preventDefault();
    gSet('sb_on', !blockingOn);
    location.reload();
  }, true);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('➕ Block this site (' + host + ')', () => {
      gSet('sb_custom', dedupe(custom.concat(host)));
      gSet('sb_allow', allow.filter((d) => d !== host));
      location.reload();
    });
    GM_registerMenuCommand('➖ Allow this site (' + host + ')', () => {
      gSet('sb_allow', dedupe(allow.concat(host)));
      gSet('sb_custom', custom.filter((d) => d !== host));
      location.reload();
    });
    GM_registerMenuCommand('📝 Edit my blocked sites…', () => {
      const next = prompt('Sites to block (separate with commas or spaces):', custom.join(', '));
      if (next === null) return;
      gSet('sb_custom', dedupe(next.split(/[\s,]+/).map((s) => s.trim().replace(/^www\./, '')).filter(Boolean)));
      location.reload();
    });
    GM_registerMenuCommand((blockingOn ? '⛔ Blocking: ON' : '✅ Blocking: OFF') + ' - tap to toggle',
      () => { gSet('sb_on', !blockingOn); location.reload(); });
    GM_registerMenuCommand((blockAdult ? '☑' : '☐') + ' Adult sites',
      () => { gSet('sb_adult', !blockAdult); location.reload(); });
    GM_registerMenuCommand((blockFocus ? '☑' : '☐') + ' Focus mode now (block the Focus Pack)',
      () => { gSet('sb_focus', !blockFocus); location.reload(); });
    GM_registerMenuCommand((scheduleOn ? '☑' : '☐') + ' Work-hours schedule (' + CONFIG.schedule.from + '-' + CONFIG.schedule.to + ', Mon-Fri)',
      () => { gSet('sb_sched', !scheduleOn); location.reload(); });
  }
})();
