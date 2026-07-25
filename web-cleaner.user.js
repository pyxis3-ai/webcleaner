// ==UserScript==
// @name         Web Cleaner
// @namespace    https://local/web-cleaner
// @version      1.0.0
// @updateURL    https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/web-cleaner.user.js
// @downloadURL  https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/web-cleaner.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // ============================ DEFAULTS (config schema) ============================
  const DEFAULTS = {
    facebook: {
      enabled: true,
      hideSponsored: true, hideSuggested: true, hidePeopleYouMayKnow: true, hideReelsTrays: true,
      stripTracking: true, showToggleButton: true,
      hideRightSidebar: true, hideLeftSidebar: true, hideComposer: true, hideTopBar: true,
      skipReelsAds: true, forceMostRecent: true,
      extraJunkPhrases: [],
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: 'f' },
    },
    youtube: {
      enabled: true,
      skipVideoAds: true, skipShortsAds: true, hideFeedAds: true, hideBanners: true,
      muteAds: true, dismissAntiAdblock: true, showToggleButton: true,
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: 'y' },
    },
    siteBlocker: {
      enabled: true,
      blockAdult: true, blockFocus: false, scheduleOn: true, snoozeMinutes: 5,
      schedule: { days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' },
      custom: [], allow: [],
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: 'b' },
    },
    viewMode: {
      newSiteDefault: 'auto', showButton: true,
      spoofUA: true, spoofTouch: true, spoofMedia: true, frameOnDesktop: false,
      longPressMs: 500,
      desktopWidth: 1280, mobileWidth: 412, mobileHeight: 915, mobileDpr: 2.625,
      mobileUA: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
      desktopUA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: 'v' },
    },
  };

  // ============================ Settings layer (GM-persisted) ============================
  const GM_OK = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  const gGet = (k, d) => (GM_OK ? GM_getValue(k, d) : d);
  const gSet = (k, v) => { if (GM_OK) GM_setValue(k, v); };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  // Deep-clone the defaults (so nested objects/arrays are never shared with DEFAULTS), then overlay the stored object.
  const merge = (def, ov) => Object.assign(clone(def), (ov && typeof ov === 'object') ? ov : {});

  const settings = {
    facebook:    merge(DEFAULTS.facebook,    gGet('wc_facebook', {})),
    youtube:     merge(DEFAULTS.youtube,     gGet('wc_youtube', {})),
    siteBlocker: merge(DEFAULTS.siteBlocker, gGet('wc_siteBlocker', {})),
    viewMode:    merge(DEFAULTS.viewMode,    gGet('wc_viewMode', {})),
  };
  function saveModule(name) { gSet('wc_' + name, settings[name]); }

  // Persist a change; reload only if it changes what THIS page shows right now.
  // affects: true/false, or 'block' → use before/after blockReason() (Site Blocker).
  function applyEdit(name, mutate, affects) {
    const before = affects === 'block' ? !!blockReason() : null;
    mutate();
    saveModule(name);
    const reload = affects === 'block' ? (before !== !!blockReason()) : !!affects;
    if (reload) location.reload(); else Panel.refresh();
  }

  // ============================ Shared helpers ============================
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const BUTTON_CSS = 'position:fixed;z-index:2147483647;width:40px;height:40px;border-radius:50%;'
    + 'border:none;cursor:pointer;font-size:18px;line-height:40px;padding:0;'
    + 'box-shadow:0 2px 10px rgba(0,0,0,.35);touch-action:none;transition:transform .1s';

  function makeDraggable(btn, storeKey, onTap, opts) {
    opts = opts || {};
    let pos = null;
    try { pos = JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (e) {}
    if (pos && typeof pos.left === 'number') {
      btn.style.left = clamp(pos.left, 0, window.innerWidth - 40) + 'px';
      btn.style.top = clamp(pos.top, 0, window.innerHeight - 40) + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
    let press = null;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { btn.setPointerCapture(e.pointerId); } catch (_) {}
      btn.style.transform = 'scale(0.9)';
      press = { sx: e.clientX, sy: e.clientY, moved: false, long: false };
      if (opts.longPress) {
        press.timer = setTimeout(() => {
          if (press && !press.moved) { press.long = true; opts.longPress.onLong(); }
        }, opts.longPress.ms);
      }
    });
    btn.addEventListener('pointermove', (e) => {
      if (!press) return;
      if (!press.moved && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) > 6) {
        press.moved = true;
        if (press.timer) clearTimeout(press.timer);
      }
      if (press.moved) {
        btn.style.left = clamp(e.clientX - 20, 0, window.innerWidth - 40) + 'px';
        btn.style.top = clamp(e.clientY - 20, 0, window.innerHeight - 40) + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
      }
    });
    btn.addEventListener('pointerup', (e) => {
      btn.style.transform = '';
      if (!press) return;
      if (press.timer) clearTimeout(press.timer);
      const p = press; press = null;
      try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
      if (p.long) return;
      if (p.moved) {
        try { localStorage.setItem(storeKey, JSON.stringify({ left: parseInt(btn.style.left, 10), top: parseInt(btn.style.top, 10) })); } catch (e2) {}
        return;
      }
      onTap();
    });
  }

  function onHotkey(getSpec, handler) {
    window.addEventListener('keydown', (e) => {
      const h = getSpec();
      if (e.metaKey || e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift) return;
      if ((e.key || '').toLowerCase() !== String(h.key).toLowerCase()) return;
      const el = e.target;
      if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName || ''))) return;
      e.preventDefault();
      handler();
    }, true);
  }

  // Run fn(payload) synchronously in PAGE context (needed for View Mode navigator/matchMedia spoof).
  function injectPageScript(fn, payload) {
    try {
      const s = document.createElement('script');
      s.textContent = '(' + fn.toString() + ')(' + JSON.stringify(payload) + ');';
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (e) { console.warn('[WC inject]', e); }
  }

  // ============================ Control panel (stub — see Task 6) ============================
  const Panel = { open() {}, close() {}, refresh() {} };

  // ============================ Cross-module functions (filled by later tasks) ============================
  const FOCUS_PACK = [
    'facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'reddit.com',
    'snapchat.com', 'threads.net', 'pinterest.com', 'tumblr.com', 'linkedin.com',
    'twitch.tv', 'netflix.com', 'hulu.com', 'dailymotion.com',
    'news.ycombinator.com', 'cnn.com', 'bbc.com', 'dailymail.co.uk', 'foxnews.com', 'buzzfeed.com',
    '9gag.com', 'imgur.com', 'boredpanda.com',
    'amazon.com', 'ebay.com', 'aliexpress.com', 'temu.com', 'shein.com',
  ];
  const ADULT_PACK = ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com',
    'spankbang.com', 'onlyfans.com', 'chaturbate.com', 'stripchat.com'];
  const ADULT_RE = /(porn|xvideos|xhamster|hentai|camsoda|chaturbate|brazzers|onlyfans|nsfw|sexcam|sextube|camgirl)/i;

  const sbHost = () => location.hostname.replace(/^www\./, '');
  const sbInList = (list) => { const h = sbHost(); return list.some((d) => h === d || h.endsWith('.' + d)); };
  const sbSnoozed = () => { try { return Date.now() < parseInt(localStorage.getItem('sb_snooze') || '0', 10); } catch (e) { return false; } };
  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  function sbInSchedule() {
    const sb = settings.siteBlocker, s = sb.schedule;
    if (!sb.scheduleOn || !s.days.includes(new Date().getDay())) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const from = toMin(s.from), to = toMin(s.to);
    return from <= to ? (cur >= from && cur < to) : (cur >= from || cur < to);
  }

  function blockReason() {
    const sb = settings.siteBlocker;
    if (!sb.enabled || sbSnoozed()) return null;
    if (sbInList(sb.allow)) return null;
    if (sbInList(sb.custom)) return 'on your block list';
    if (sb.blockAdult && (sbInList(ADULT_PACK) || ADULT_RE.test(sbHost()))) return 'blocked by the adult filter';
    if ((sb.blockFocus || sbInSchedule()) && sbInList(FOCUS_PACK))
      return sb.blockFocus ? 'blocked by the focus filter' : 'blocked during focus hours';
    return null;
  }

  // ============================ Feature modules (filled by later tasks) ============================
  function initSiteBlocker() {
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
        '<div style="opacity:.65;max-width:30rem">' + sbHost() + ' - ' + why + '.</div>' +
        '<button id="sb-allow" style="margin-top:6px;padding:10px 18px;border:0;border-radius:10px;cursor:pointer;font-size:14px;background:#2b2b30;color:#e9e9ea">Allow for ' + settings.siteBlocker.snoozeMinutes + ' minutes</button>' +
        '<button id="sb-manage" style="padding:8px 16px;border:0;border-radius:10px;cursor:pointer;font-size:13px;background:#1c1c20;color:#9a9aa0">⚙ Manage blocked sites</button>';
      const allowBtn = document.getElementById('sb-allow');
      if (allowBtn) allowBtn.addEventListener('click', () => {
        try { localStorage.setItem('sb_snooze', String(Date.now() + settings.siteBlocker.snoozeMinutes * 60000)); } catch (e) {}
        location.reload();
      });
      const mng = document.getElementById('sb-manage');
      if (mng) mng.addEventListener('click', Panel.open);
    }
    function check() {
      const why = blockReason();
      if (why && !document.getElementById('sb-allow')) showBlock(why);
    }
    check();
    setInterval(check, 30000);

    onHotkey(() => settings.siteBlocker.toggleHotkey, () => {
      applyEdit('siteBlocker', () => { settings.siteBlocker.enabled = !settings.siteBlocker.enabled; }, 'block');
    });
  }
  function initViewMode() {}
  function initFacebook() {}
  function initYouTube() {}
  function registerMenu() {}

  // ============================ Bootstrap ============================
  const host = location.hostname;
  const FB_HOSTS = new Set(['www.facebook.com', 'web.facebook.com', 'm.facebook.com']);
  const YT_HOSTS = new Set(['www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
  const run = (name, fn) => { try { fn(); } catch (e) { console.warn('[' + name + ']', e); } };

  run('SiteBlocker', initSiteBlocker);
  run('ViewMode', initViewMode);
  if (FB_HOSTS.has(host)) run('FCF', initFacebook);
  if (YT_HOSTS.has(host)) run('YT', initYouTube);
  registerMenu();
})();
