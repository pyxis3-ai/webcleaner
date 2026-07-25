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
  const vmSiteMode = (() => { try { return localStorage.getItem('vm_mode') || ''; } catch (e) { return ''; } })();
  const vmMode = vmSiteMode || settings.viewMode.newSiteDefault;
  const viewModeActive = () => vmMode !== 'auto';
  function setSiteMode(m) { try { localStorage.setItem('vm_mode', m); } catch (e) {} location.reload(); }

  // Runs in PAGE context. Self-contained: references only `p` (payload) and page globals.
  function vmSpoofInPage(p) {
    const def = (obj, prop, getter) => {
      try { Object.defineProperty(obj, prop, { configurable: true, get: getter }); return true; }
      catch (e) { return false; }
    };
    function installMatchMedia(emuWidth, coarse) {
      const native = window.matchMedia ? window.matchMedia.bind(window) : null;
      const decide = (qRaw) => {
        const q = String(qRaw).toLowerCase();
        let known = null;
        const clause = (ok) => { if (known !== false) known = ok; };
        let m;
        if ((m = q.match(/min-width:\s*(\d+(?:\.\d+)?)px/))) clause(emuWidth >= parseFloat(m[1]));
        if ((m = q.match(/max-width:\s*(\d+(?:\.\d+)?)px/))) clause(emuWidth <= parseFloat(m[1]));
        if (q.includes('pointer: coarse') || q.includes('any-pointer: coarse')) clause(coarse);
        if (q.includes('pointer: fine') || q.includes('any-pointer: fine')) clause(!coarse);
        if (q.includes('hover: none')) clause(coarse);
        if (q.includes('hover: hover')) clause(!coarse);
        return known;
      };
      window.matchMedia = function (query) {
        const verdict = decide(query);
        if (verdict === null && native) return native(query);
        return {
          matches: !!verdict, media: String(query), onchange: null,
          addEventListener() {}, removeEventListener() {},
          addListener() {}, removeListener() {}, dispatchEvent() { return false; },
        };
      };
    }
    const toMobile = p.toMobile, cfg = p.cfg;
    if (cfg.spoofUA) {
      const ua = toMobile ? cfg.mobileUA : cfg.desktopUA;
      def(navigator, 'userAgent', () => ua);
      def(navigator, 'appVersion', () => ua.replace(/^Mozilla\//, ''));
      def(navigator, 'platform', () => (toMobile ? 'Linux armv8l' : 'Win32'));
      def(navigator, 'vendor', () => 'Google Inc.');
      try {
        const prevBrands = navigator.userAgentData ? navigator.userAgentData.brands : [];
        def(navigator, 'userAgentData', () => ({
          mobile: toMobile,
          platform: toMobile ? 'Android' : 'Windows',
          brands: prevBrands,
          getHighEntropyValues: () => Promise.resolve({ mobile: toMobile, platform: toMobile ? 'Android' : 'Windows' }),
          toJSON: () => ({ mobile: toMobile, platform: toMobile ? 'Android' : 'Windows', brands: prevBrands }),
        }));
      } catch (e) {}
    }
    if (cfg.spoofTouch) {
      def(navigator, 'maxTouchPoints', () => (toMobile ? 5 : 0));
      try { if (toMobile && !('ontouchstart' in window)) window.ontouchstart = null; } catch (e) {}
    }
    if (cfg.spoofMedia) {
      const emuW = toMobile ? cfg.mobileWidth : cfg.desktopWidth;
      installMatchMedia(emuW, toMobile);
      if (p.useFrame) {
        def(window, 'innerWidth', () => cfg.mobileWidth);
        def(window, 'innerHeight', () => cfg.mobileHeight);
        def(screen, 'width', () => cfg.mobileWidth);
        def(screen, 'height', () => cfg.mobileHeight);
        def(screen, 'availWidth', () => cfg.mobileWidth);
        def(screen, 'availHeight', () => cfg.mobileHeight);
        def(window, 'devicePixelRatio', () => cfg.mobileDpr);
      }
    }
  }

  function initViewMode() {
    const vm = settings.viewMode;
    const realUA = navigator.userAgent;
    const uaData = navigator.userAgentData;
    const realMobile = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(realUA) ||
      /iPad/.test(realUA) ||
      (/Macintosh/.test(realUA) && navigator.maxTouchPoints > 1) ||
      (!!uaData && uaData.mobile === true);
    const toMobile = vmMode === 'mobile';
    const useFrame = toMobile && !realMobile && vm.frameOnDesktop;

    if (vmMode !== 'auto') {
      injectPageScript(vmSpoofInPage, {
        toMobile: toMobile, useFrame: useFrame,
        cfg: {
          spoofUA: vm.spoofUA, spoofTouch: vm.spoofTouch, spoofMedia: vm.spoofMedia,
          mobileUA: vm.mobileUA, desktopUA: vm.desktopUA,
          mobileWidth: vm.mobileWidth, desktopWidth: vm.desktopWidth,
          mobileHeight: vm.mobileHeight, mobileDpr: vm.mobileDpr,
        },
      });
    }

    function applyViewport() {
      if (vmMode === 'auto') return;
      document.querySelectorAll('meta[name="viewport"]').forEach((el) => { if (!el.hasAttribute('data-vm')) el.remove(); });
      let meta = document.querySelector('meta[name="viewport"][data-vm]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        meta.setAttribute('data-vm', '1');
        (document.head || document.documentElement).appendChild(meta);
      }
      meta.setAttribute('content', vmMode === 'desktop' ? 'width=' + vm.desktopWidth : 'width=device-width, initial-scale=1');
    }
    function applyFrame() {
      if (!useFrame || document.getElementById('vm-frame-style')) return;
      const w = vm.mobileWidth;
      const style = document.createElement('style');
      style.id = 'vm-frame-style';
      style.textContent =
        'html.vm-framed{background:#202124!important;overflow-x:hidden!important}' +
        'html.vm-framed>body{width:' + w + 'px!important;min-width:' + w + 'px!important;max-width:' + w + 'px!important;' +
          'margin:0 auto!important;min-height:100vh!important;overflow-x:hidden!important;' +
          'box-shadow:0 0 0 100vmax #202124,0 0 40px rgba(0,0,0,.6)!important}';
      (document.head || document.documentElement).appendChild(style);
      document.documentElement.classList.add('vm-framed');
    }

    applyViewport();
    if (vmMode !== 'auto') {
      const reassert = () => { applyViewport(); applyFrame(); };
      document.addEventListener('DOMContentLoaded', reassert);
      [200, 600, 1500, 3500].forEach((t) => setTimeout(reassert, t));
    }

    const toggleMode = () => setSiteMode(vmMode === 'desktop' ? 'mobile' : 'desktop');

    function addButton() {
      if (!vm.showButton || !document.body || document.getElementById('vm-btn')) return;
      const b = document.createElement('button');
      b.id = 'vm-btn';
      b.textContent = vmMode === 'desktop' ? '🖥' : vmMode === 'mobile' ? '📱' : '🔄';
      b.title = 'View: ' + vmMode + ' - tap: switch · long-press: Auto · drag: move';
      b.setAttribute('style', BUTTON_CSS + ';background:rgba(0,0,0,.55);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.4);opacity:0.55;left:10px;bottom:10px');
      b.addEventListener('mouseenter', () => { b.style.opacity = '1'; });
      b.addEventListener('mouseleave', () => { b.style.opacity = '0.55'; });
      makeDraggable(b, 'vm_pos', toggleMode, { longPress: { ms: vm.longPressMs, onLong: () => setSiteMode('auto') } });
      document.body.appendChild(b);
    }
    if (document.body) addButton();
    else document.addEventListener('DOMContentLoaded', addButton);

    onHotkey(() => settings.viewMode.toggleHotkey, toggleMode);
  }
  function setFacebookEnabled(on) {
    settings.facebook.enabled = on;
    saveModule('facebook');
    document.documentElement.classList.toggle('fcf-off', !on);
    const b = document.getElementById('fcf-toggle');
    if (b) b.style.opacity = on ? '1' : '0.4';
  }

  function initFacebook() {
    const IS_MOBILE = location.hostname === 'm.facebook.com';
    if (!settings.facebook.enabled) document.documentElement.classList.add('fcf-off');

    if (!IS_MOBILE && settings.facebook.forceMostRecent) {
      const onHome = location.pathname === '/' || location.pathname === '/home.php';
      if (onHome && !/[?&]sk=/.test(location.search)) {
        location.replace(location.origin + '/?sk=h_chr');
        return;
      }
    }

    const norm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[^\p{L}]/gu, '');
    const SPONSORED_MARKS = ['sponsored', 'paidpartnership', 'publicidad', 'patrocinado', 'sponsoris', 'commandit', 'gesponsert', 'sponsorizzat', 'gesponsord', 'bersponsor', 'sponsorlu', 'sponsorowan', 'sponsrad', 'sponset', 'sponsoreret', 'ممول', 'ממומן', 'реклама', '広告', '광고', '赞助', '贊助', 'χορηγούμενη'].map(norm);
    const INCLUDE_MARKS = [
      ...(settings.facebook.hideSponsored ? SPONSORED_MARKS : []),
      ...(settings.facebook.hideSuggested ? ['suggestedforyou', 'suggestedpost', 'pagesforyou', 'pagesyoumaylike', 'groupsyoumaylike'] : []),
      ...(settings.facebook.hidePeopleYouMayKnow ? ['peopleyoumayknow'] : []),
      ...settings.facebook.extraJunkPhrases.map(norm),
    ];
    const EXACT_MARKS = settings.facebook.hideReelsTrays ? ['reels', 'reelsandshortvideos', 'stories'] : [];

    function injectStyle() {
      const R = ['html:not(.fcf-off) [data-fcf-hide]{display:none!important}'];
      if (!IS_MOBILE) {
        const P = 'html.fcf-strip:not(.fcf-off) ';
        if (settings.facebook.hideRightSidebar) R.push(P + '[role="complementary"]{display:none!important}');
        if (settings.facebook.hideLeftSidebar)  R.push(P + '[role="navigation"][aria-label="Shortcuts"]{display:none!important}');
        if (settings.facebook.hideLeftSidebar)  R.push('html:not(.fcf-off) [data-fcf-leftnav]{display:none!important}');
        if (settings.facebook.hideComposer)     R.push(P + '[role="region"][aria-label="Create a post"]{display:none!important}');
        if (settings.facebook.hideTopBar)       R.push(P + '[role="banner"],' + P + '[role="navigation"][aria-label="Facebook"],' + P + '[role="navigation"][aria-label="Account Controls and Settings"]{display:none!important}');
        if (settings.facebook.hideReelsTrays)   R.push(P + '[aria-label="Stories"],' + P + '[aria-label="Reels"]{display:none!important}');
        R.push(P + '[role="main"]{margin-left:auto!important;margin-right:auto!important}');
        if (settings.facebook.hideTopBar)       R.push(P + 'body{padding-top:0!important}');
      }
      if (settings.facebook.showToggleButton) R.push('#fcf-toggle{position:fixed;z-index:2147483647;bottom:16px;right:16px;width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;font-size:18px;line-height:40px;padding:0;background:#fff;color:#111;box-shadow:0 2px 10px rgba(0,0,0,.35);touch-action:none;transition:transform .1s}');
      const style = document.createElement('style');
      style.id = 'fcf-style';
      style.textContent = R.join('\n');
      (document.head || document.documentElement).appendChild(style);
    }

    const STRIP = /[​-‏‪-‮﻿­⁠]/g;
    function renderedText(scope, bandTop, bandBottom) {
      const glyphs = [];
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
      let n, budget = 600;
      while ((n = walker.nextNode()) && budget-- > 0) {
        const s = n.nodeValue;
        if (!s || !s.trim()) continue;
        const p = n.parentElement;
        if (!p) continue;
        const cs = getComputedStyle(p);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0' || cs.fontSize === '0px') continue;
        if (p.closest('[aria-hidden="true"]')) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const r = range.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right <= 0) continue;
        if (r.top < bandTop || r.top > bandBottom) continue;
        glyphs.push({ c: s.trim(), top: Math.round(r.top), left: Math.round(r.left) });
      }
      const buckets = new Map();
      for (const g of glyphs) {
        const k = g.top + ':' + g.left;
        (buckets.get(k) || buckets.set(k, []).get(k)).push(g);
      }
      const kept = [];
      for (const arr of buckets.values()) if (arr.length === 1) kept.push(arr[0]);
      kept.sort((a, b) => (a.top - b.top) || (a.left - b.left));
      return kept.map((g) => g.c).join('').replace(STRIP, '').replace(/\s+/g, ' ').trim();
    }

    let _feed = null;
    function feedContainer() {
      if (_feed && _feed.isConnected && countStoryChildren(_feed) >= 2) return _feed;
      const main = document.querySelector('[role="main"]');
      if (!main) return null;
      let best = null, bestN = 1;
      for (const d of main.querySelectorAll('div')) {
        const n = countStoryChildren(d);
        if (n > bestN) { bestN = n; best = d; }
      }
      return (_feed = best);
    }
    function countStoryChildren(el) {
      let n = 0;
      for (const ch of el.children) {
        const r = ch.getBoundingClientRect();
        if (r.width >= 500 && r.width <= 720 && r.height > 90) n++;
      }
      return n;
    }

    const VIEWPAD = 500;
    const HEADER_BAND = 130;
    const CLEAN_CONFIRMATIONS = 4;
    function isJunkHeader(compact) {
      if (!compact) return false;
      for (const m of INCLUDE_MARKS) if (compact.includes(m)) return true;
      return EXACT_MARKS.includes(compact);
    }

    function processStories() {
      const feed = feedContainer();
      if (!feed) return;
      const vh = window.innerHeight;
      for (const story of feed.children) {
        if (story.__fcf === 'hidden') continue;
        if (story.__fcf === 'clean') continue;
        const r = story.getBoundingClientRect();
        if (r.height < 60) continue;
        if (r.bottom < -VIEWPAD || r.top > vh + VIEWPAD) continue;
        const header = renderedText(story, r.top - 2, r.top + HEADER_BAND);
        if (!header) continue;
        const junk = isJunkHeader(norm(header)) ||
          (settings.facebook.hideReelsTrays && story.querySelectorAll('a[href*="/reel/"]').length > 3);
        if (junk) {
          story.setAttribute('data-fcf-hide', '');
          story.__fcf = 'hidden';
        } else if ((story.__fcfSeen = (story.__fcfSeen || 0) + 1) >= CLEAN_CONFIRMATIONS) {
          story.__fcf = 'clean';
        }
      }
    }

    function hideLeftRail() {
      if (!settings.facebook.hideLeftSidebar) return;
      for (const nav of document.querySelectorAll('[role="navigation"]:not([data-fcf-leftnav])')) {
        const r = nav.getBoundingClientRect();
        if (r.height > 350 && r.width >= 150 && r.width <= 460 && r.left <= 24)
          nav.setAttribute('data-fcf-leftnav', '');
      }
    }

    function hardenStructure() {
      const main = document.querySelector('[role="main"]');
      if (!main) return;
      const mr = main.getBoundingClientRect();
      if (settings.facebook.hideLeftSidebar) {
        for (const nav of document.querySelectorAll('[role="navigation"]')) {
          const r = nav.getBoundingClientRect();
          if (r.height > 350 && r.width > 120 && r.right <= mr.left + 8)
            nav.setAttribute('data-fcf-leftnav', '');
        }
      }
    }

    const MOBILE_POST = '[data-tracking-duration-id]';
    const MOBILE_LABELS = 'span, a[role="link"], h3, h4, div[role="heading"]';
    function mobilePostIsJunk(post) {
      for (const el of post.querySelectorAll(MOBILE_LABELS)) {
        const raw = (el.textContent || '').trim();
        if (!raw || raw.length > 40) continue;
        const t = norm(raw);
        if (!t) continue;
        if (INCLUDE_MARKS.some((m) => t === m || t.startsWith(m))) return true;
        if (EXACT_MARKS.includes(t)) return true;
      }
      return false;
    }
    function sweepMobile() {
      for (const post of document.querySelectorAll(MOBILE_POST)) {
        if (post.__fcf) continue;
        if (mobilePostIsJunk(post)) {
          post.setAttribute('data-fcf-hide', '');
          post.__fcf = 'hidden';
        } else if ((post.__fcfSeen = (post.__fcfSeen || 0) + 1) >= CLEAN_CONFIRMATIONS) {
          post.__fcf = 'clean';
        }
      }
    }

    function addToggle() {
      if (!settings.facebook.showToggleButton || !document.body || document.getElementById('fcf-toggle')) return;
      const b = document.createElement('button');
      b.id = 'fcf-toggle';
      b.textContent = '🧹';
      b.title = 'Facebook Clean Feed - tap: toggle · drag: move';
      makeDraggable(b, 'fcf_pos', () => setFacebookEnabled(!settings.facebook.enabled));
      document.body.appendChild(b);
      if (!settings.facebook.enabled) b.style.opacity = '0.4';
    }

    // Ad tracking is keyed on the centered <video> element (node identity), NOT the URL
    // path. Facebook gates its Reels ads and snap-scrolls back to them, and the path does
    // not reliably change per reel — so keying on the path meant one nudge got reverted and
    // the ad was then marked "handled" forever. Keying on the element lets us keep retrying a
    // snapped-back ad and reset cleanly only once we actually land on a different reel.
    const _reelState = new WeakMap();
    let _skipTarget = null, _lastSkip = 0, _skipTries = 0;
    const SKIP_RETRY_MS = 600;
    const SKIP_MAX_TRIES = 8;
    function handleReels() {
      if (!settings.facebook.skipReelsAds || !/^\/reels?(\/|$)/.test(location.pathname)) return;
      const cy = window.innerHeight / 2;
      let active = null, best = 1e9;
      for (const v of document.querySelectorAll('video')) {
        const r = v.getBoundingClientRect();
        if (r.height < 200) continue;
        const d = Math.abs((r.top + r.bottom) / 2 - cy);
        if (d < best) { best = d; active = v; }
      }
      if (!active) return;
      let reel = active;
      for (let i = 0; i < 12 && reel.parentElement; i++) {
        reel = reel.parentElement;
        if (reel.querySelector('[aria-label="Like"],[aria-label^="Comment"],[role="button"][aria-label="Next Card"]')) break;
      }
      if (!reelIsSponsored(reel, active)) {
        if (active !== _skipTarget) { _skipTarget = null; _skipTries = 0; }  // landed on a clean reel
        return;
      }
      if (active !== _skipTarget) { _skipTarget = active; _skipTries = 0; }  // a (new) ad is centered
      if (Date.now() - _lastSkip < SKIP_RETRY_MS || _skipTries >= SKIP_MAX_TRIES) return;
      _skipTries++; _lastSkip = Date.now();
      advancePastReel(reel);
    }

    function advancePastReel(reel) {
      const next = document.querySelector('[role="button"][aria-label="Next Card"]');
      if (next) { next.click(); return; }
      const target = reel.closest('[tabindex]') || reel;  // FB's key handler lives on the reel, not document
      for (const type of ['keydown', 'keyup']) {
        target.dispatchEvent(new KeyboardEvent(type, {
          key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, which: 40, bubbles: true,
        }));
      }
    }

    function reelIsSponsored(reel, key) {
      let st = _reelState.get(key);
      if (!st) _reelState.set(key, (st = { spon: false, tries: 0 }));
      if (st.spon) return true;
      if (st.tries >= 8) return false;
      st.tries++;
      const r = reel.getBoundingClientRect();
      const c = norm(renderedText(reel, r.top - 2, r.bottom + 2));
      if (SPONSORED_MARKS.some((m) => c.includes(m))) st.spon = true;
      return st.spon;
    }

    const TRACK_EXACT = new Set(['fbclid', 'gclid', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'twclid', 'igshid', 'mc_eid', 'mc_cid', '_openstat', 'vero_id', 'oly_enc_id', 'oly_anon_id', 'wickedid', '_hsenc', '_hsmi', 'mkt_tok', 'ref', 'refsrc', 'refid', 'fref', 'hc_ref', 'hc_location', 'ref_src', 'ref_url', 'eav', 'paipv', 'comment_tracking', 'av', 'rdid']);
    const FB_SHIMS = new Set(['l.facebook.com', 'lm.facebook.com', 'l.messenger.com']);
    const isTrackingParam = (k) => TRACK_EXACT.has(k) || k.startsWith('utm_') || k.startsWith('__');
    function cleanUrl(href) {
      let u;
      try { u = new URL(href, location.href); } catch (e) { return null; }
      let dirty = false;
      if (FB_SHIMS.has(u.hostname) && u.pathname === '/l.php') {
        const real = u.searchParams.get('u');
        if (real) {
          try {
            const r = new URL(real);
            if (r.protocol === 'https:' || r.protocol === 'http:') { u = r; dirty = true; }
          } catch (e) {}
        }
      }
      for (const k of [...u.searchParams.keys()]) {
        if (isTrackingParam(k)) { u.searchParams.delete(k); dirty = true; }
      }
      return dirty ? u.toString() : null;
    }
    function cleanTracking() {
      const here = cleanUrl(location.href);
      if (here) history.replaceState(history.state, '', here);
      for (const a of document.querySelectorAll('a[href^="http"]:not([data-fcf-clean])')) {
        a.setAttribute('data-fcf-clean', '');
        const cleaned = cleanUrl(a.getAttribute('data-lynx-uri') || a.href);
        if (cleaned) a.href = cleaned;
        a.removeAttribute('ping');
        a.removeAttribute('data-lynx-uri');
      }
    }

    function isFeedPage() {
      const p = location.pathname;
      return p === '/' || p === '/home.php';
    }
    function isCleanPage() {
      const p = location.pathname.replace(/\/$/, '');
      return isFeedPage() || p === '/groups/feed' || p === '/watch' || /^\/groups\/[^/]+$/.test(p);
    }
    function sweep() {
      try {
        if (settings.facebook.stripTracking) cleanTracking();
        if (IS_MOBILE) { sweepMobile(); return; }
        hideLeftRail();
        document.documentElement.classList.toggle('fcf-strip', isFeedPage());
        if (isCleanPage()) { hardenStructure(); processStories(); }
        handleReels();
      } catch (e) { console.warn('[FCF]', e); }
    }
    let scheduled = false;
    const idle = window.requestIdleCallback || ((fn) => requestAnimationFrame(fn));
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      idle(() => { scheduled = false; sweep(); });
    }

    function start() {
      sweep();
      addToggle();
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener('scroll', schedule, { passive: true });
      setInterval(sweep, IS_MOBILE ? 1000 : 1500);
    }

    onHotkey(() => settings.facebook.toggleHotkey, () => setFacebookEnabled(!settings.facebook.enabled));

    injectStyle();
    if (!IS_MOBILE) document.documentElement.classList.toggle('fcf-strip', isFeedPage());
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);
  }
  function setYoutubeEnabled(on) {
    settings.youtube.enabled = on;
    saveModule('youtube');
    const s = document.getElementById('yt-skip-ads');
    if (s) s.disabled = !on;
    const b = document.getElementById('yt-toggle');
    if (b) b.style.opacity = on ? '1' : '0.4';
  }

  function initYouTube() {
    let styleEl = null;

    const BANNER_HIDE = [
      '#masthead-ad', '#player-ads',
      'ytd-banner-promo-renderer', 'ytd-statement-banner-renderer',
      'ytd-companion-slot-renderer', 'ytd-action-companion-ad-renderer',
      '.ytp-ad-overlay-slot', '.ytp-ad-overlay-container', '.ytp-ad-image-overlay',
    ];
    const FEED_HIDE = [
      'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-display-ad-renderer',
      'ytd-promoted-video-renderer', 'ytd-promoted-sparkles-web-renderer',
      'ytm-companion-slot-renderer', 'ytm-promoted-video-renderer', 'ytm-search-pyv-renderer',
      'ytm-promoted-sparkles-web-renderer', 'ad-slot-renderer',
    ];
    const FEED_WRAPPERS = 'ytd-rich-item-renderer, ytd-rich-section-renderer, ytm-rich-item-renderer, ytm-item-section-renderer';

    const VIDEO_AD_CLASSES = ['ad-showing', 'ad-interrupting'];
    const SHORT_AD_CLASSES = ['ad-showing', 'ad-interrupting', 'ad-created'];
    const hasAnyClass = (el, classes) => !!el && classes.some((c) => el.classList.contains(c));

    function injectStyle() {
      const rules = [];
      if (settings.youtube.hideBanners) rules.push(...BANNER_HIDE);
      if (settings.youtube.hideFeedAds) rules.push(...FEED_HIDE, '[data-yt-hide]');
      if (rules.length) {
        const style = document.createElement('style');
        style.id = 'yt-skip-ads';
        style.textContent = rules.join(',') + '{display:none!important}';
        (document.head || document.documentElement).appendChild(style);
        styleEl = style;
      }
      if (settings.youtube.showToggleButton) {
        const ui = document.createElement('style');
        ui.id = 'yt-skip-ads-ui';
        ui.textContent = '#yt-toggle{position:fixed;z-index:2147483647;bottom:16px;right:16px;width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;font-size:18px;line-height:40px;padding:0;background:#fff;color:#111;box-shadow:0 2px 10px rgba(0,0,0,.35);touch-action:none;transition:transform .1s}';
        (document.head || document.documentElement).appendChild(ui);
      }
    }

    function hideFeedWrappers() {
      if (!settings.youtube.hideFeedAds) return;
      for (const ad of document.querySelectorAll(FEED_HIDE.join(','))) {
        const wrap = ad.closest(FEED_WRAPPERS);
        if (wrap) wrap.setAttribute('data-yt-hide', '');
      }
    }

    let mutedByUs = false;
    function skipVideoAd() {
      if (!settings.youtube.skipVideoAds) return;
      const player = document.querySelector('#movie_player, .html5-video-player');
      const video = document.querySelector('.html5-video-player video') || document.querySelector('video');
      const adShowing = hasAnyClass(player, VIDEO_AD_CLASSES);
      if (adShowing) {
        const skip = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-container button, .ytp-ad-skip-button-slot button, .ytp-ad-skip-button-slot');
        if (skip) skip.click();
        if (video) {
          if (settings.youtube.muteAds && !video.muted) { video.muted = true; mutedByUs = true; }
          if (isFinite(video.duration) && video.duration > 1) video.currentTime = video.duration;
        }
        const close = document.querySelector('.ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container button');
        if (close) close.click();
      } else if (video && mutedByUs) {
        video.muted = false;
        mutedByUs = false;
      }
    }

    let lastShortSkipAt = 0;
    function skipShortAd() {
      if (!settings.youtube.skipShortsAds || !/^\/shorts/.test(location.pathname)) return;
      const player = document.querySelector('#shorts-player');
      const ad = hasAnyClass(player, SHORT_AD_CLASSES)
        || !!document.querySelector('ytd-reel-video-renderer ad-slot-renderer, ytd-reel-video-renderer ytd-ad-slot-renderer, ytd-shorts ytd-ad-slot-renderer, ytd-shorts ad-slot-renderer');
      if (!ad || Date.now() - lastShortSkipAt < 700) return;
      lastShortSkipAt = Date.now();
      const next = document.querySelector('#navigation-button-down button, button[aria-label="Next video"], button[aria-label="Next Short"]');
      if (next) next.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    }

    function dismissAntiAdblock() {
      if (!settings.youtube.dismissAntiAdblock) return;
      const enforce = document.querySelector('ytd-enforcement-message-view-model');
      if (!enforce) return;
      const dialog = enforce.closest('tp-yt-paper-dialog');
      if (dialog) dialog.remove(); else enforce.remove();
      const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
      if (backdrop) backdrop.remove();
      if (document.body) document.body.style.removeProperty('overflow');
      const video = document.querySelector('video');
      if (video && video.paused) video.play().catch(() => {});
    }

    function tick() {
      if (!settings.youtube.enabled) return;
      try { dismissAntiAdblock(); skipVideoAd(); skipShortAd(); hideFeedWrappers(); } catch (e) { console.warn('[YT-skip]', e); }
    }

    function addToggle() {
      if (!settings.youtube.showToggleButton || !document.body || document.getElementById('yt-toggle')) return;
      const b = document.createElement('button');
      b.id = 'yt-toggle';
      b.textContent = '⏭';
      b.title = 'YouTube Skip Ads - tap: toggle · drag: move';
      makeDraggable(b, 'yt_pos', () => setYoutubeEnabled(!settings.youtube.enabled));
      document.body.appendChild(b);
      if (!settings.youtube.enabled) b.style.opacity = '0.4';
    }

    let scheduled = false;
    function schedule() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; tick(); });
    }

    function start() {
      tick();
      addToggle();
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      setInterval(tick, 250);
    }

    injectStyle();
    if (styleEl && !settings.youtube.enabled) styleEl.disabled = true;
    if (document.body) start();
    else document.addEventListener('DOMContentLoaded', start);

    onHotkey(() => settings.youtube.toggleHotkey, () => setYoutubeEnabled(!settings.youtube.enabled));
  }
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
