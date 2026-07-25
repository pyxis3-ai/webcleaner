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
