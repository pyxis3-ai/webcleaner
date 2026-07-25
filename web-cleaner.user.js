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
  function blockReason() { return null; }            // Task 2 replaces this body

  // ============================ Feature modules (filled by later tasks) ============================
  function initSiteBlocker() {}
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
