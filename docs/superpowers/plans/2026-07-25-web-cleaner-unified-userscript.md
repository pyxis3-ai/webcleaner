# Web Cleaner — Unified Userscript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the repo's four userscripts into one `web-cleaner.user.js` with a single in-page control panel (opened from the manager menu) that exposes every feature, capability, and tuning value across all four modules.

**Architecture:** One `.user.js` file, one IIFE, sandboxed (`@grant GM_*`). `DEFAULTS` holds the config schema; live settings persist to GM storage (one object per module) and default to `DEFAULTS`. Shared plumbing (`clamp`, `makeDraggable`, `onHotkey`, `BUTTON_CSS`, `injectPageScript`, the settings layer, the `Panel`) is written once. Each feature is a guarded module (`initSiteBlocker`/`initViewMode`/`initFacebook`/`initYouTube`) whose detection/DOM logic is copied verbatim from the current scripts and rewired to read `settings.<module>`. View Mode's signal spoof runs in page context via an injected `<script>`.

**Tech Stack:** Vanilla JS userscript; Tampermonkey/Violentmonkey GM API (`GM_getValue`/`GM_setValue`/`GM_registerMenuCommand`); Shadow DOM for the panel. No build step, no bundler, no test framework — the automated gate is `node --check` and the rest is a manual browser checklist.

## Global Constraints

- Output file: `web-cleaner.user.js` at repo root. Single IIFE, `'use strict'`. No build system, no modules, no dependencies.
- Metadata header (exact): `@name Web Cleaner` · `@namespace https://local/web-cleaner` · `@version 1.0.0` · `@match *://*/*` · `@run-at document-start` · `@noframes` · `@grant GM_getValue` · `@grant GM_setValue` · `@grant GM_registerMenuCommand`.
- `@updateURL`/`@downloadURL`: `https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/web-cleaner.user.js`
- Delete the four old files: `facebook-clean-feed.user.js`, `youtube-skip-ads.user.js`, `site-blocker.user.js`, `view-mode-switcher.user.js`. Do NOT touch `mobile-mode/`.
- All detection/DOM logic is ported **verbatim** from the current scripts; only wrapping structure and `CONFIG.x` → `settings.<module>.x` references change. No new site-cleaning features.
- Hotkey defaults: `Alt+Shift+F` (Facebook), `Alt+Shift+Y` (YouTube), `Alt+Shift+B` (Site Blocker), `Alt+Shift+V` (View Mode). Rebindable in the panel; a rebind requires ≥1 modifier (Alt/Ctrl/Shift), Meta disallowed.
- The automated gate for every task is: `node --check web-cleaner.user.js` prints nothing and exits 0. There is no unit-test framework (spec decision). Manual verification items are for the human reviewer between tasks.
- GM settings persist as one object per module under keys `wc_facebook`, `wc_youtube`, `wc_siteBlocker`, `wc_viewMode`. Ephemeral/per-site state stays in localStorage: `vm_mode`, `sb_snooze`, `fcf_pos`, `yt_pos`, `vm_pos`.
- Design fact used throughout: the whole file is one IIFE, so `function` declarations are hoisted and top-level `const`/`let` state is initialized before any user interaction (menu click, panel open, button tap). Modules and the `Panel` may therefore freely reference each other's top-level declarations regardless of source order.

---

### Task 1: Scaffold — header, DEFAULTS, settings layer, shared helpers, bootstrap

**Files:**
- Create: `web-cleaner.user.js`

**Interfaces:**
- Produces (all at IIFE top-level, available to later tasks):
  - `DEFAULTS` — `{ facebook, youtube, siteBlocker, viewMode }` schema objects.
  - `settings` — `{ facebook, youtube, siteBlocker, viewMode }`, each `{ ...DEFAULTS.x, ...GM override }`.
  - `saveModule(name: 'facebook'|'youtube'|'siteBlocker'|'viewMode'): void`
  - `applyEdit(name, mutate: ()=>void, affects: boolean | 'block'): void` — persists then reloads iff the change affects the current page (`'block'` uses before/after `blockReason()`); otherwise calls `Panel.refresh()`.
  - `clamp(v, lo, hi): number`
  - `makeDraggable(btn, storeKey, onTap, opts?)` — `opts.longPress = { ms, onLong }`.
  - `onHotkey(getSpec: ()=>{ctrl,alt,shift,key}, handler: ()=>void): void`
  - `BUTTON_CSS: string`
  - `injectPageScript(fn, payload): void`
  - `Panel` — object `{ open(){}, close(){}, refresh(){} }` (stub; replaced in Task 6).
  - `host: string`, `FB_HOSTS: Set`, `YT_HOSTS: Set`, `run(name, fn)`.
  - Empty `initSiteBlocker/initViewMode/initFacebook/initYouTube` and `registerMenu` (filled in later tasks).

- [ ] **Step 1: Create the file with the full scaffold**

Create `web-cleaner.user.js` with exactly this content:

```javascript
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
```

- [ ] **Step 2: Verify it parses**

Run: `node --check web-cleaner.user.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add web-cleaner.user.js
git commit -m "feat: scaffold web-cleaner.user.js (header, settings layer, shared helpers)"
```

---

### Task 2: Site Blocker module

Port the blocking logic verbatim from `site-blocker.user.js`, rewired to `settings.siteBlocker`. Site Blocker's shadow-DOM management panel is NOT ported here — it becomes the shared `Panel` in Task 6. The block screen's "⚙ Manage" button calls `Panel.open` (stub for now).

**Files:**
- Modify: `web-cleaner.user.js` (replace the `blockReason` and `initSiteBlocker` stub bodies; add Site Blocker consts)
- Source to port from: `site-blocker.user.js:38-113` (constants, schedule, `blockReason`, `showBlock`, `check`) and `:257-276` (hotkey + menu — hotkey only here; menu quick-actions go in Task 7)

**Interfaces:**
- Consumes: `settings`, `saveModule`, `applyEdit`, `onHotkey`, `Panel`, `host` (Task 1).
- Produces: `blockReason(): string|null` (top-level, reads `settings.siteBlocker`), consts `FOCUS_PACK`, `ADULT_PACK` (top-level, read by the panel in Task 6), `initSiteBlocker()`.

- [ ] **Step 1: Add Site Blocker top-level constants and `blockReason`**

Add these consts just above the `blockReason` stub, then replace the `blockReason` stub body. `FOCUS_PACK` / `ADULT_PACK` are copied verbatim from `site-blocker.user.js:26-35`:

```javascript
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
```

Replace the `blockReason` stub (`function blockReason() { return null; }`) with:

```javascript
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
```

- [ ] **Step 2: Fill `initSiteBlocker`**

Replace the `function initSiteBlocker() {}` stub with the block screen + check loop + hotkey, ported from `site-blocker.user.js:82-112` and `:257-265`. The `showBlock` "⚙ Manage" handler now calls `Panel.open`:

```javascript
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
```

- [ ] **Step 3: Verify it parses**

Run: `node --check web-cleaner.user.js`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add web-cleaner.user.js
git commit -m "feat: port Site Blocker blocking logic into web-cleaner"
```

- [ ] **Step 5: Manual verification (reviewer)**

Install the file in Violentmonkey/Tampermonkey. Add a site to `settings.siteBlocker.custom` via console (`GM` not needed — temporarily edit DEFAULTS or set `wc_siteBlocker`), or set the schedule to now and visit a Focus-Pack site. Confirm the ⛔ block screen appears, "Allow for 5 minutes" snoozes, `Alt+Shift+B` toggles blocking. The "⚙ Manage" button does nothing yet (panel arrives in Task 6).

---

### Task 3: View Mode module (with page-context spoof)

Port from `view-mode-switcher.user.js` (in git: `git show HEAD:view-mode-switcher.user.js`). The sandbox parts (viewport meta, frame, button, hotkey) stay in the sandbox; `spoofSignals` + `installMatchMedia` run in page context via `injectPageScript`.

**Files:**
- Modify: `web-cleaner.user.js` (replace `initViewMode` stub; add top-level `vmMode`, `setSiteMode`, `viewModeActive`)
- Source: `git show HEAD:view-mode-switcher.user.js`

**Interfaces:**
- Consumes: `settings`, `saveModule`, `gGet`, `gSet`, `clamp`, `makeDraggable`, `onHotkey`, `injectPageScript`, `BUTTON_CSS`.
- Produces: `vmMode: string` (resolved 'desktop'|'mobile'|'auto'), `setSiteMode(m): void` (writes `vm_mode`, reloads), `viewModeActive(): boolean` (`vmMode !== 'auto'`), `initViewMode()`.

- [ ] **Step 1: Add top-level View Mode resolution + helpers**

Add above the `initViewMode` stub:

```javascript
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
```

- [ ] **Step 2: Fill `initViewMode`**

Replace the `function initViewMode() {}` stub. This is `view-mode-switcher.user.js` ported, with `CONFIG.*` → `settings.viewMode.*`, GM `vm_pos` → localStorage via `makeDraggable`, `spoofSignals()` → `injectPageScript(vmSpoofInPage, …)`, `mode` → `vmMode`, `setSite` → `setSiteMode`, and the button using `BUTTON_CSS`:

```javascript
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
```

Note: the original View Mode button set its own `opacity`/hover, GM-stored position, and default `left:10px;bottom:10px`. `makeDraggable` reads the stored position from localStorage `vm_pos` and, if present, overrides `left/top`; the inline `left:10px;bottom:10px` is the default when none is stored. This matches the original default corner.

- [ ] **Step 3: Verify it parses**

Run: `node --check web-cleaner.user.js`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add web-cleaner.user.js
git commit -m "feat: port View Mode with page-context signal spoof"
```

- [ ] **Step 5: Manual verification (reviewer)**

On a responsive site, tap the 🖥/📱 button (or `Alt+Shift+V`) to switch to Mobile. In the page console run `navigator.userAgent` — it must show the spoofed mobile UA (validates the page-injection). Long-press → 🔄 Auto. Confirm viewport switches and the button drag-position persists across reloads.

---

### Task 4: Facebook module

Port `facebook-clean-feed.user.js:36-402` verbatim into `initFacebook`, rewired to `settings.facebook`. Master enable becomes persisted (top-level `setFacebookEnabled`).

**Files:**
- Modify: `web-cleaner.user.js` (replace `initFacebook` stub; add top-level `setFacebookEnabled`)
- Source: `facebook-clean-feed.user.js:36-402`

**Interfaces:**
- Consumes: `settings`, `saveModule`, `onHotkey`, `makeDraggable`, `clamp`.
- Produces: `setFacebookEnabled(on): void` (top-level), `initFacebook()`.

- [ ] **Step 1: Add top-level `setFacebookEnabled`**

Add above the `initFacebook` stub. This replaces the old per-page `toggleClean` state with persisted `settings.facebook.enabled`, keeping the instant CSS `fcf-off` toggle (no reload):

```javascript
  function setFacebookEnabled(on) {
    settings.facebook.enabled = on;
    saveModule('facebook');
    document.documentElement.classList.toggle('fcf-off', !on);
    const b = document.getElementById('fcf-toggle');
    if (b) b.style.opacity = on ? '1' : '0.4';
  }
```

- [ ] **Step 2: Fill `initFacebook`**

Replace `function initFacebook() {}` with the body of the current FB IIFE (`facebook-clean-feed.user.js:36-402`), applying these exact adaptations. Copy the source between those lines and change only:

1. Remove the local `const CONFIG = {…}` block (lines 18-34) — it is now `settings.facebook`.
2. Replace every `CONFIG.` with `settings.facebook.` throughout.
3. The `makeDraggable` and `clamp` local definitions (lines 214-252) are **deleted** — use the shared ones. Keep `addToggle` but point its tap handler at the persisted toggle (see 5).
4. Replace the standalone `toggleClean()` function (lines 208-212) with a call-through: delete it and, everywhere it was used, call `setFacebookEnabled(!settings.facebook.enabled)`.
5. In `addToggle` (lines 254-262): keep it, but change `makeDraggable(b, 'fcf_pos', toggleClean);` to `makeDraggable(b, 'fcf_pos', () => setFacebookEnabled(!settings.facebook.enabled));`. Also, after `document.body.appendChild(b);`, add `if (!settings.facebook.enabled) b.style.opacity = '0.4';` so a persisted-off state dims the button on load.
6. Replace the module's own `keydown` listener (lines 389-397) with: `onHotkey(() => settings.facebook.toggleHotkey, () => setFacebookEnabled(!settings.facebook.enabled));`.
7. The bottom bootstrap of the old IIFE (lines 399-402) — `injectStyle(); if (!IS_MOBILE) …; if (document.body) start(); else …;` — stays, but **add at the very top of `initFacebook`**, right after computing `IS_MOBILE`: `if (!settings.facebook.enabled) document.documentElement.classList.add('fcf-off');` so a persisted "off" is reflected on load.
8. The early `return` inside the `forceMostRecent` block (lines 38-44) now returns from `initFacebook` — correct (aborts only this module; `location.replace` navigates away anyway).

All detection functions (`renderedText`, `feedContainer`, `processStories`, `handleReels`, `cleanTracking`, `sweep`, etc.) are copied **unchanged** except for the `CONFIG.` → `settings.facebook.` rename.

- [ ] **Step 3: Verify it parses**

Run: `node --check web-cleaner.user.js`
Expected: no output, exit 0.

- [ ] **Step 4: Verify no stray CONFIG references remain in the FB code**

Run: `grep -n 'CONFIG' web-cleaner.user.js`
Expected: no matches (the only `CONFIG`-like token allowed is inside comments; there should be none).

- [ ] **Step 5: Commit**

```bash
git add web-cleaner.user.js
git commit -m "feat: port Facebook Clean Feed into web-cleaner"
```

- [ ] **Step 6: Manual verification (reviewer)**

On `www.facebook.com`: feed is cleaned, 🧹 button toggles and drags, `Alt+Shift+F` toggles, and the toggle state persists across reload. Spot-check `m.facebook.com`.

---

### Task 5: YouTube module

Port `youtube-skip-ads.user.js:32-211` verbatim into `initYouTube`, rewired to `settings.youtube`. Master enable persisted (top-level `setYoutubeEnabled`); `tick` reads `settings.youtube.enabled` instead of a local `enabled` var.

**Files:**
- Modify: `web-cleaner.user.js` (replace `initYouTube` stub; add top-level `setYoutubeEnabled`)
- Source: `youtube-skip-ads.user.js:32-211`

**Interfaces:**
- Consumes: `settings`, `saveModule`, `onHotkey`, `makeDraggable`, `clamp`.
- Produces: `setYoutubeEnabled(on): void` (top-level), `initYouTube()`.

- [ ] **Step 1: Add top-level `setYoutubeEnabled`**

```javascript
  function setYoutubeEnabled(on) {
    settings.youtube.enabled = on;
    saveModule('youtube');
    const s = document.getElementById('yt-skip-ads');
    if (s) s.disabled = !on;
    const b = document.getElementById('yt-toggle');
    if (b) b.style.opacity = on ? '1' : '0.4';
  }
```

- [ ] **Step 2: Fill `initYouTube`**

Replace `function initYouTube() {}` with the body of the current YT IIFE (`youtube-skip-ads.user.js:32-211`), with these exact adaptations:

1. Remove the local `const CONFIG = {…}` (lines 18-27) — now `settings.youtube`.
2. Remove the local `let enabled = true;` (line 29). Everywhere `enabled` was read (the `if (!enabled) return;` in `tick`, line 125), use `settings.youtube.enabled`. Keep `let styleEl = null;`.
3. Replace every `CONFIG.` with `settings.youtube.`.
4. Delete the local `makeDraggable` and `clamp` (lines 135-173) — use the shared ones.
5. Delete `toggleEnabled` (lines 128-133). In `addToggle` (line 181) change `makeDraggable(b, 'yt_pos', toggleEnabled);` to `makeDraggable(b, 'yt_pos', () => setYoutubeEnabled(!settings.youtube.enabled));`. Also, after `document.body.appendChild(b);`, add `if (!settings.youtube.enabled) b.style.opacity = '0.4';`.
6. Replace the module's `keydown` listener (lines 203-211) with: `onHotkey(() => settings.youtube.toggleHotkey, () => setYoutubeEnabled(!settings.youtube.enabled));`.
7. Keep the bottom bootstrap (`injectStyle(); if (document.body) start(); else …;`, lines 199-201). Add right after `injectStyle();`: `if (styleEl && !settings.youtube.enabled) styleEl.disabled = true;` so a persisted "off" is reflected on load.

All detection functions (`hideFeedWrappers`, `skipVideoAd`, `skipShortAd`, `dismissAntiAdblock`, `tick`) are copied **unchanged** except the `CONFIG.` → `settings.youtube.` rename and the `enabled` → `settings.youtube.enabled` change in `tick`.

- [ ] **Step 3: Verify it parses**

Run: `node --check web-cleaner.user.js`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add web-cleaner.user.js
git commit -m "feat: port YouTube Skip Ads into web-cleaner"
```

- [ ] **Step 5: Manual verification (reviewer)**

On `www.youtube.com`: a video ad auto-skips/mutes, ⏭ button toggles + `Alt+Shift+Y`, feed ads hidden, toggle state persists across reload.

---

### Task 6: Unified control panel

Replace the `Panel` stub with the full shared control panel: one shadow-DOM dialog, one collapsible section per module, every setting editable and routed through `applyEdit`. Reuse Site Blocker's proven panel CSS and list-editor patterns (`site-blocker.user.js:115-255`), extended with number/time/UA-text/hotkey-capture controls and the FB/YT/View-Mode sections.

**Files:**
- Modify: `web-cleaner.user.js` (replace `const Panel = { … }` stub)
- Reference: `site-blocker.user.js:115-255` (panel style, switch `sw`, list `listHtml`/`packHtml`, wiring)

**Interfaces:**
- Consumes: `settings`, `saveModule`, `applyEdit`, `blockReason`, `FOCUS_PACK`, `ADULT_PACK`, `vmMode`, `setSiteMode`, `viewModeActive`, `setFacebookEnabled`, `setYoutubeEnabled`, `host`, `FB_HOSTS`, `YT_HOSTS`.
- Produces: `Panel.open()`, `Panel.close()`, `Panel.refresh()`.

- [ ] **Step 1: Add panel helper builders**

Add these module-level helpers just above the `const Panel` stub (they build HTML fragments; `esc`/`cleanHost` are copied from `site-blocker.user.js:115-117`):

```javascript
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cleanHost = (s) => String(s).trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  const keyLabel = (h) => (h.ctrl ? 'Ctrl+' : '') + (h.alt ? 'Alt+' : '') + (h.shift ? 'Shift+' : '') + String(h.key || '').toUpperCase();

  // control builders — each carries data-* attributes read by wirePanel
  const swRow = (label, mod, key) =>
    '<div class="row"><span>' + esc(label) + '</span><label class="sw"><input type="checkbox" data-bool="' + mod + '.' + key + '"' + (settings[mod][key] ? ' checked' : '') + '><span class="track"></span></label></div>';
  const numRow = (label, mod, key) =>
    '<div class="row"><span>' + esc(label) + '</span><input class="num" type="number" data-num="' + mod + '.' + key + '" value="' + esc(settings[mod][key]) + '"></div>';
  const txtRow = (label, mod, key) =>
    '<div class="frow"><span>' + esc(label) + '</span><input class="txt" type="text" data-txt="' + mod + '.' + key + '" value="' + esc(settings[mod][key]) + '"></div>';
  const timeRow = (label, mod, key) =>
    '<div class="row"><span>' + esc(label) + '</span><input class="time" type="time" data-time="' + mod + '.' + key + '" value="' + esc(settings[mod].schedule[key]) + '"></div>';
  const hotRow = (mod) =>
    '<div class="row"><span>Shortcut</span><button class="hk" data-hk="' + mod + '">' + esc(keyLabel(settings[mod].toggleHotkey)) + '</button></div>';
  const listBlock = (label, mod, key, placeholder) =>
    '<div class="sec"><h2>' + esc(label) + '</h2>' + listHtml(settings[mod][key], mod + '.' + key) +
    '<div class="add"><input type="text" data-add="' + mod + '.' + key + '" placeholder="' + esc(placeholder) + '"><button data-addbtn="' + mod + '.' + key + '">Add</button></div></div>';
  function listHtml(arr, path) {
    if (!arr.length) return '<div class="empty">None yet.</div>';
    return arr.map((d) => '<div class="item"><span title="' + esc(d) + '">' + esc(d) + '</span>'
      + '<button class="del" data-del="' + path + '" data-host="' + esc(d) + '">Remove</button></div>').join('');
  }
  function packHtml(sites) {
    const allow = settings.siteBlocker.allow;
    return sites.map((d) => {
      const on = allow.includes(d);
      return '<div class="item"><span>' + esc(d) + '</span><button class="pill ' + (on ? 'allowed' : 'blocked')
        + '" data-pack="' + esc(d) + '">' + (on ? 'Allowed' : 'Blocked') + '</button></div>';
    }).join('');
  }
```

- [ ] **Step 2: Add the panel style**

Add the panel style function (copied from `site-blocker.user.js:146-178`, with three extra rules appended for the new controls):

```javascript
  function panelStyle() {
    return '' +
      ':host{all:initial}' +
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}' +
      '.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646}' +
      '.card{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 28px));max-height:min(86vh,820px);overflow:auto;background:#17181b;color:#e9e9ea;border-radius:14px;padding:18px;box-shadow:0 12px 48px rgba(0,0,0,.6);z-index:2147483647;font-size:14px;line-height:1.4}' +
      '.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
      '.hd h1{font-size:16px;font-weight:700;margin:0}' +
      '.x{background:none;border:0;color:#9a9aa0;font-size:24px;cursor:pointer;line-height:1;padding:0 4px}' +
      '.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #26272c}' +
      '.frow{display:flex;flex-direction:column;gap:5px;padding:9px 0;border-top:1px solid #26272c}' +
      '.cur{font-size:12px;color:#8a8a90;margin-top:2px}' +
      '.sec{margin-top:14px}' +
      '.sec>h2{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8a8a90;margin:0 0 2px}' +
      '.item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid #26272c}' +
      '.item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.del{background:#2b2b30;border:0;color:#ff8a8a;border-radius:8px;cursor:pointer;padding:4px 10px;font-size:13px;flex:0 0 auto}' +
      '.add{display:flex;gap:8px;margin-top:8px}' +
      '.add input{flex:1;min-width:0;background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:8px 10px;font-size:13px}' +
      '.add button{background:#3a7afe;border:0;color:#fff;border-radius:8px;cursor:pointer;padding:8px 14px;font-size:13px;flex:0 0 auto}' +
      '.empty{color:#6a6a70;font-style:italic;padding:7px 0;border-top:1px solid #26272c}' +
      '.sw{position:relative;display:inline-block;width:44px;height:26px;flex:0 0 auto}' +
      '.sw input{opacity:0;width:0;height:0;position:absolute}' +
      '.track{position:absolute;inset:0;background:#3a3b42;border-radius:999px;transition:.15s;cursor:pointer}' +
      '.track::before{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.15s}' +
      '.sw input:checked+.track{background:#2ecc71}' +
      '.sw input:checked+.track::before{transform:translateX(18px)}' +
      'details{margin-top:6px}' +
      'summary{cursor:pointer;padding:9px 0;color:#c9c9cf;border-top:1px solid #26272c;list-style:none;user-select:none;font-weight:600}' +
      'summary::-webkit-details-marker{display:none}' +
      '.pill{border:0;border-radius:8px;cursor:pointer;padding:4px 12px;font-size:12px;flex:0 0 auto}' +
      '.pill.blocked{background:#3a2b2b;color:#ff9a9a}' +
      '.pill.allowed{background:#243024;color:#9be79b}' +
      '.num{width:96px;background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:6px 8px;font-size:13px;text-align:right}' +
      '.time{background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:6px 8px;font-size:13px}' +
      '.txt{background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:8px 10px;font-size:12px;width:100%}' +
      '.hk{background:#2b2b30;border:0;color:#e9e9ea;border-radius:8px;cursor:pointer;padding:5px 12px;font-size:13px}' +
      '.hk.arm{background:#3a7afe;color:#fff}' +
      '.seg{display:flex;gap:6px}' +
      '.seg button{flex:1;background:#2b2b30;border:0;color:#c9c9cf;border-radius:8px;cursor:pointer;padding:6px 0;font-size:13px}' +
      '.seg button.on{background:#3a7afe;color:#fff}';
  }
```

- [ ] **Step 3: Add the section renderers**

Add one render function per module. The Site Blocker section reproduces the current panel content; the others are new:

```javascript
  function secFacebook() {
    const f = settings.facebook;
    return '<details data-sec="facebook"><summary>🧹 Facebook  ' + (f.enabled ? 'ON' : 'OFF') + '</summary>' +
      swRow('Clean feed enabled', 'facebook', 'enabled') +
      swRow('Hide Sponsored', 'facebook', 'hideSponsored') +
      swRow('Hide Suggested', 'facebook', 'hideSuggested') +
      swRow('Hide People You May Know', 'facebook', 'hidePeopleYouMayKnow') +
      swRow('Hide Reels / Stories trays', 'facebook', 'hideReelsTrays') +
      swRow('Hide right sidebar', 'facebook', 'hideRightSidebar') +
      swRow('Hide left sidebar', 'facebook', 'hideLeftSidebar') +
      swRow('Hide composer', 'facebook', 'hideComposer') +
      swRow('Hide top bar', 'facebook', 'hideTopBar') +
      swRow('Strip tracking / unwrap l.php', 'facebook', 'stripTracking') +
      swRow('Skip Reel ads', 'facebook', 'skipReelsAds') +
      swRow('Force Most Recent feed', 'facebook', 'forceMostRecent') +
      swRow('Show floating button', 'facebook', 'showToggleButton') +
      listBlock('Extra junk phrases', 'facebook', 'extraJunkPhrases', 'add a phrase to hide') +
      '<details data-sec="facebook-adv"><summary>Advanced</summary>' + hotRow('facebook') + '</details>' +
      '</details>';
  }
  function secYouTube() {
    const y = settings.youtube;
    return '<details data-sec="youtube"><summary>⏭ YouTube  ' + (y.enabled ? 'ON' : 'OFF') + '</summary>' +
      swRow('Ad-skipping enabled', 'youtube', 'enabled') +
      swRow('Skip video ads', 'youtube', 'skipVideoAds') +
      swRow('Skip Shorts ads', 'youtube', 'skipShortsAds') +
      swRow('Hide feed ads', 'youtube', 'hideFeedAds') +
      swRow('Hide banners / overlays', 'youtube', 'hideBanners') +
      swRow('Mute ads', 'youtube', 'muteAds') +
      swRow('Dismiss anti-adblock popup', 'youtube', 'dismissAntiAdblock') +
      swRow('Show floating button', 'youtube', 'showToggleButton') +
      '<details data-sec="youtube-adv"><summary>Advanced</summary>' + hotRow('youtube') + '</details>' +
      '</details>';
  }
  function secSiteBlocker() {
    const sb = settings.siteBlocker;
    return '<details data-sec="siteBlocker" open><summary>⛔ Site Blocker  ' + (sb.enabled ? 'ON' : 'OFF') + '</summary>' +
      '<div class="row"><div>Blocking<div class="cur">This page: ' + esc(host) + '</div></div><label class="sw"><input type="checkbox" data-bool="siteBlocker.enabled"' + (sb.enabled ? ' checked' : '') + '><span class="track"></span></label></div>' +
      swRow('Adult filter', 'siteBlocker', 'blockAdult') +
      swRow('Focus mode now', 'siteBlocker', 'blockFocus') +
      swRow('Work-hours schedule (' + esc(sb.schedule.from) + '–' + esc(sb.schedule.to) + ')', 'siteBlocker', 'scheduleOn') +
      (sbSnoozed() ? '<div class="cur">⏱ Snoozed — blocking is paused on this tab.</div>' : '') +
      listBlock('My blocked sites', 'siteBlocker', 'custom', 'add a site, e.g. example.com') +
      listBlock('Allowed (never blocked)', 'siteBlocker', 'allow', 'add a site to always allow') +
      '<div class="sec"><h2>Built-in packs</h2>' +
        '<details data-sec="focus"><summary>Focus Pack (' + FOCUS_PACK.length + ')</summary>' + packHtml(FOCUS_PACK) + '</details>' +
        '<details data-sec="adult"><summary>Adult Pack (' + ADULT_PACK.length + ')</summary>' + packHtml(ADULT_PACK) + '</details>' +
      '</div>' +
      '<details data-sec="siteBlocker-adv"><summary>Advanced</summary>' +
        timeRow('Schedule from', 'siteBlocker', 'from') + timeRow('Schedule to', 'siteBlocker', 'to') +
        numRow('Snooze minutes', 'siteBlocker', 'snoozeMinutes') + hotRow('siteBlocker') +
      '</details>' +
      '</details>';
  }
  function secViewMode() {
    const seg = (m) => '<button class="' + (vmMode === m ? 'on' : '') + '" data-mode="' + m + '">' + (m[0].toUpperCase() + m.slice(1)) + '</button>';
    const dseg = (m) => '<button class="' + (settings.viewMode.newSiteDefault === m ? 'on' : '') + '" data-default="' + m + '">' + (m[0].toUpperCase() + m.slice(1)) + '</button>';
    return '<details data-sec="viewMode"><summary>🖥 View Mode  ' + vmMode.toUpperCase() + '</summary>' +
      '<div class="row"><span>This site</span><div class="seg">' + seg('desktop') + seg('mobile') + seg('auto') + '</div></div>' +
      '<div class="row"><span>New-site default</span><div class="seg">' + dseg('desktop') + dseg('mobile') + dseg('auto') + '</div></div>' +
      swRow('Spoof User-Agent', 'viewMode', 'spoofUA') +
      swRow('Spoof touch', 'viewMode', 'spoofTouch') +
      swRow('Spoof matchMedia', 'viewMode', 'spoofMedia') +
      swRow('Phone frame on desktop', 'viewMode', 'frameOnDesktop') +
      swRow('Show floating button', 'viewMode', 'showButton') +
      '<details data-sec="viewMode-adv"><summary>Advanced</summary>' +
        numRow('Desktop width', 'viewMode', 'desktopWidth') + numRow('Mobile width', 'viewMode', 'mobileWidth') +
        numRow('Mobile height', 'viewMode', 'mobileHeight') + numRow('Mobile DPR', 'viewMode', 'mobileDpr') +
        numRow('Long-press ms', 'viewMode', 'longPressMs') +
        txtRow('Mobile UA', 'viewMode', 'mobileUA') + txtRow('Desktop UA', 'viewMode', 'desktopUA') +
        hotRow('viewMode') +
      '</details>' +
      '</details>';
  }
```

- [ ] **Step 4: Replace the `Panel` stub with the full implementation**

Replace `const Panel = { open() {}, close() {}, refresh() {} };` with:

```javascript
  const Panel = (function () {
    let hostEl = null;
    let armedHk = null;   // module name whose hotkey is being captured

    function onKey(e) {
      if (armedHk) return;   // hotkey capture handled separately
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    }
    function affectsFor(mod) {
      if (mod === 'siteBlocker') return 'block';
      if (mod === 'facebook') return FB_HOSTS.has(host);
      if (mod === 'youtube') return YT_HOSTS.has(host);
      if (mod === 'viewMode') return viewModeActive();
      return false;
    }
    function edit(mod, mutate) { armedHk = null; applyEdit(mod, mutate, affectsFor(mod)); }

    function render() {
      const shadow = hostEl.shadowRoot;
      const open = {};
      shadow.querySelectorAll('details[data-sec]').forEach((d) => { open[d.getAttribute('data-sec')] = d.open; });
      shadow.innerHTML = '<style>' + panelStyle() + '</style>' +
        '<div class="backdrop" data-close></div>' +
        '<div class="card" role="dialog" aria-label="Web Cleaner settings">' +
          '<div class="hd"><h1>🧼 Web Cleaner</h1><button class="x" data-close aria-label="Close">×</button></div>' +
          secSiteBlocker() + secViewMode() + secFacebook() + secYouTube() +
        '</div>';
      shadow.querySelectorAll('details[data-sec]').forEach((d) => { if (open[d.getAttribute('data-sec')]) d.open = true; });
      wire(shadow);
    }

    function wire(shadow) {
      shadow.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));

      shadow.querySelectorAll('[data-bool]').forEach((el) => el.addEventListener('change', () => {
        const [mod, key] = el.getAttribute('data-bool').split('.');
        // FB/YT master enable toggles live (no reload) via their setters
        if (mod === 'facebook' && key === 'enabled') { setFacebookEnabled(el.checked); render(); return; }
        if (mod === 'youtube' && key === 'enabled') { setYoutubeEnabled(el.checked); render(); return; }
        edit(mod, () => { settings[mod][key] = el.checked; });
      }));

      shadow.querySelectorAll('[data-num]').forEach((el) => el.addEventListener('change', () => {
        const [mod, key] = el.getAttribute('data-num').split('.');
        const v = parseFloat(el.value);
        if (!isFinite(v) || v <= 0) { render(); return; }   // reject invalid → revert
        edit(mod, () => { settings[mod][key] = v; });
      }));

      shadow.querySelectorAll('[data-txt]').forEach((el) => el.addEventListener('change', () => {
        const [mod, key] = el.getAttribute('data-txt').split('.');
        const v = el.value.trim();
        if (!v) { render(); return; }
        edit(mod, () => { settings[mod][key] = v; });
      }));

      shadow.querySelectorAll('[data-time]').forEach((el) => el.addEventListener('change', () => {
        const [mod, key] = el.getAttribute('data-time').split('.');   // mod === 'siteBlocker'
        if (!/^\d{2}:\d{2}$/.test(el.value)) { render(); return; }
        edit('siteBlocker', () => { settings.siteBlocker.schedule[key] = el.value; });
      }));

      shadow.querySelectorAll('[data-del]').forEach((el) => el.addEventListener('click', () => {
        const [mod, key] = el.getAttribute('data-del').split('.');
        const h = el.getAttribute('data-host');
        edit(mod, () => { settings[mod][key] = settings[mod][key].filter((d) => d !== h); });
      }));

      shadow.querySelectorAll('[data-addbtn]').forEach((btn) => {
        const path = btn.getAttribute('data-addbtn');
        const [mod, key] = path.split('.');
        const input = shadow.querySelector('[data-add="' + path + '"]');
        const submit = () => {
          const raw = input.value;
          const h = (mod === 'facebook') ? raw.trim().toLowerCase() : cleanHost(raw);   // FB phrases aren't hostnames
          if (!h) return;
          edit(mod, () => {
            const arr = settings[mod][key];
            if (!arr.includes(h)) arr.push(h);
            // Site Blocker: adding to one list removes from the other
            if (mod === 'siteBlocker' && key === 'custom') settings.siteBlocker.allow = settings.siteBlocker.allow.filter((d) => d !== h);
            if (mod === 'siteBlocker' && key === 'allow') settings.siteBlocker.custom = settings.siteBlocker.custom.filter((d) => d !== h);
          });
        };
        btn.addEventListener('click', submit);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
      });

      shadow.querySelectorAll('[data-pack]').forEach((btn) => btn.addEventListener('click', () => {
        const h = btn.getAttribute('data-pack');
        edit('siteBlocker', () => {
          const a = settings.siteBlocker.allow;
          settings.siteBlocker.allow = a.includes(h) ? a.filter((d) => d !== h) : a.concat(h);
        });
      }));

      shadow.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => setSiteMode(btn.getAttribute('data-mode'))));
      shadow.querySelectorAll('[data-default]').forEach((btn) => btn.addEventListener('click', () => {
        edit('viewMode', () => { settings.viewMode.newSiteDefault = btn.getAttribute('data-default'); });
      }));

      shadow.querySelectorAll('[data-hk]').forEach((btn) => btn.addEventListener('click', () => {
        const mod = btn.getAttribute('data-hk');
        armedHk = mod;
        btn.textContent = 'Press keys…';
        btn.classList.add('arm');
        const cap = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;   // wait for a non-modifier
          if (e.metaKey || !(e.altKey || e.ctrlKey || e.shiftKey)) {          // require ≥1 modifier, no Meta
            armedHk = null; window.removeEventListener('keydown', cap, true); render(); return;
          }
          window.removeEventListener('keydown', cap, true);
          const spec = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, key: e.key.toLowerCase() };
          edit(mod, () => { settings[mod].toggleHotkey = spec; });   // affects=false path for hotkeys handled below
        };
        window.addEventListener('keydown', cap, true);
      }));
    }

    function open() {
      if (hostEl) { close(); return; }
      if (!document.body) return;
      hostEl = document.createElement('div');
      hostEl.id = 'wc-panel-root';
      hostEl.setAttribute('style', 'all:initial');
      hostEl.attachShadow({ mode: 'open' });
      document.body.appendChild(hostEl);
      render();
      document.addEventListener('keydown', onKey, true);
    }
    function close() {
      if (hostEl) { hostEl.remove(); hostEl = null; }
      armedHk = null;
      document.removeEventListener('keydown', onKey, true);
    }
    function refresh() { if (hostEl && hostEl.shadowRoot) render(); }

    return { open, close, refresh };
  })();
```

Note on hotkey edits: `edit(mod, …)` uses `affectsFor(mod)`, which for a hotkey change on a non-current-module page is `false` → no reload, just re-render. On the current-module page it may reload, which is harmless (the rebind is already persisted). If you prefer hotkey rebinds to never reload, change the hotkey-capture line to `applyEdit(mod, () => { settings[mod].toggleHotkey = spec; }, false);` directly instead of `edit(...)`.

- [ ] **Step 5: Verify it parses**

Run: `node --check web-cleaner.user.js`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add web-cleaner.user.js
git commit -m "feat: unified Web Cleaner control panel"
```

- [ ] **Step 7: Manual verification (reviewer)**

Temporarily add a way to open the panel (e.g. run `Panel.open()` in the console, or wait for Task 7's menu). Confirm: all four sections render; toggling a Site Blocker switch reloads only if it flips this page's block state; toggling a Facebook flag on facebook.com reloads (off facebook.com it just persists); number/UA/time fields reject blank/invalid input; the "Shortcut" button captures a new combo (requires a modifier) and it persists; blocked/allowed list add/remove works; View-Mode Desktop/Mobile/Auto and new-site-default segments work.

---

### Task 7: Menu commands

Fill `registerMenu` with the settings-panel command plus quick actions, so every interactive capability is reachable from the manager menu.

**Files:**
- Modify: `web-cleaner.user.js` (replace `function registerMenu() {}`)

**Interfaces:**
- Consumes: `settings`, `applyEdit`, `Panel`, `setFacebookEnabled`, `setYoutubeEnabled`, `setSiteMode`, `host`, `FB_HOSTS`, `YT_HOSTS`.

- [ ] **Step 1: Fill `registerMenu`**

```javascript
  function registerMenu() {
    if (typeof GM_registerMenuCommand !== 'function') return;
    const sbHostName = location.hostname.replace(/^www\./, '');
    GM_registerMenuCommand('⚙ Web Cleaner settings…', Panel.open);
    GM_registerMenuCommand((settings.siteBlocker.enabled ? '⛔ Blocking: ON' : '✅ Blocking: OFF') + ' - toggle', () => {
      applyEdit('siteBlocker', () => { settings.siteBlocker.enabled = !settings.siteBlocker.enabled; }, 'block');
    });
    GM_registerMenuCommand('➕ Block this site (' + sbHostName + ')', () => {
      applyEdit('siteBlocker', () => {
        if (!settings.siteBlocker.custom.includes(sbHostName)) settings.siteBlocker.custom.push(sbHostName);
        settings.siteBlocker.allow = settings.siteBlocker.allow.filter((d) => d !== sbHostName);
      }, 'block');
    });
    GM_registerMenuCommand('➖ Allow this site (' + sbHostName + ')', () => {
      applyEdit('siteBlocker', () => {
        if (!settings.siteBlocker.allow.includes(sbHostName)) settings.siteBlocker.allow.push(sbHostName);
        settings.siteBlocker.custom = settings.siteBlocker.custom.filter((d) => d !== sbHostName);
      }, 'block');
    });
    if (FB_HOSTS.has(host)) {
      GM_registerMenuCommand('🧹 Facebook clean feed: ' + (settings.facebook.enabled ? 'ON' : 'OFF') + ' - toggle',
        () => setFacebookEnabled(!settings.facebook.enabled));
    }
    if (YT_HOSTS.has(host)) {
      GM_registerMenuCommand('⏭ YouTube skip-ads: ' + (settings.youtube.enabled ? 'ON' : 'OFF') + ' - toggle',
        () => setYoutubeEnabled(!settings.youtube.enabled));
    }
    GM_registerMenuCommand('🖥 View: Desktop (this site)', () => setSiteMode('desktop'));
    GM_registerMenuCommand('📱 View: Mobile (this site)', () => setSiteMode('mobile'));
    GM_registerMenuCommand('↺ View: Auto (this site)', () => setSiteMode('auto'));
  }
```

- [ ] **Step 2: Verify it parses**

Run: `node --check web-cleaner.user.js`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add web-cleaner.user.js
git commit -m "feat: Web Cleaner menu commands (settings + quick actions)"
```

- [ ] **Step 4: Manual verification (reviewer)**

Open the userscript-manager menu on an ordinary page: "⚙ Web Cleaner settings…", "Blocking: … toggle", "Block/Allow this site", and the three "View:" commands appear; the FB/YT toggle commands appear only on their sites. "⚙ Web Cleaner settings…" opens the panel.

---

### Task 8: Delete old files, update README and install page

**Files:**
- Delete: `facebook-clean-feed.user.js`, `youtube-skip-ads.user.js`, `site-blocker.user.js`, `view-mode-switcher.user.js`
- Modify: `README.md`, `index.html`

- [ ] **Step 1: Remove the four old scripts**

```bash
git rm -f facebook-clean-feed.user.js youtube-skip-ads.user.js site-blocker.user.js
git rm -f --ignore-unmatch view-mode-switcher.user.js   # already deleted from the working tree
```

- [ ] **Step 2: Rewrite the README install table + rationale**

In `README.md`, replace the install table (the `| Script | What it does | Install |` block and its four rows) with a single row:

```markdown
| Script | What it does | Install |
|---|---|---|
| **Web Cleaner** | One userscript, four modules: **Facebook Clean Feed** (strips ads/Sponsored, Stories, Reels, Suggested, sidebars, composer, top bar; skips Sponsored reels; strips tracking; forces Most Recent — desktop + `m.facebook.com`), **YouTube Skip Ads** (auto-skips video/Shorts ads, hides feed/banner ads, dismisses anti-adblock — desktop, `m.youtube.com`, YouTube Music), **Site Blocker** (adult filter + work-hours Focus Pack, custom lists, snooze), and **View Mode Switcher** (force Desktop/Mobile rendering per site). Everything is configurable from one in-page panel — open **⚙ Web Cleaner settings…** from your userscript-manager menu. | [Install](https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/web-cleaner.user.js) |
```

Replace the `## Why these are separate scripts` section with:

```markdown
## One script, four modules

Web Cleaner is a single userscript. Each module (Facebook, YouTube, Site Blocker, View Mode) runs inside its own error boundary, so one site's redesign breaking a module can't take down the others. Shared plumbing — the draggable button, storage, hotkey handling, and the settings panel — is written once.

**Mobile Mode** is still a separate browser **extension**, not part of this: only an extension can change the request's User-Agent header and the real viewport — the two levers "mobile on desktop" needs.

### Migrating from the old four scripts

Install **Web Cleaner**, then remove the old **Facebook Clean Feed**, **YouTube Skip Ads**, **Site Blocker**, and **View Mode Switcher** scripts from your manager. Per-site view modes, snoozes, and button positions carry over; Site Blocker's custom block/allow lists and other saved settings reset to defaults, so re-add any custom sites once from the panel.
```

Then in the "Controls" section, update the panel/menu rows to reflect the unified panel: change the "Userscript-manager menu" row to `The whole panel — open ⚙ Web Cleaner settings… from the menu; every feature, list, schedule, hotkey, and tuning value is editable there.` The hotkey table stays as-is (defaults unchanged).

- [ ] **Step 3: Collapse the install cards in `index.html`**

In `index.html`, replace the four userscript install cards (the `<div class="row">` blocks at lines ~105, ~112, ~119, ~126 pointing at the four old `.user.js` files, together with their surrounding card markup) with a single Web Cleaner card whose install link is `https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/web-cleaner.user.js` and source link is `https://github.com/pyxis3-ai/userscripts/blob/main/web-cleaner.user.js`. Keep the Mobile Mode extension card (line ~132) unchanged. Match the existing card markup/classes exactly; use the same "one script, four modules" summary as the README row. Update the intro/meta description sentences that enumerate "Facebook & YouTube cleaners, a site blocker, a view switcher" only if they now read wrong — they remain accurate as a feature list, so leaving them is fine.

- [ ] **Step 4: Final verification**

Run: `node --check web-cleaner.user.js`
Expected: no output, exit 0.

Run: `grep -rn 'facebook-clean-feed.user.js\|youtube-skip-ads.user.js\|site-blocker.user.js\|view-mode-switcher.user.js' README.md index.html`
Expected: no matches (all old links replaced).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: replace four userscripts with web-cleaner; update README + install page"
```

- [ ] **Step 6: Full manual verification checklist (reviewer)**

Install `web-cleaner.user.js` fresh in Violentmonkey/Tampermonkey and confirm:
- Facebook: feed cleaned; 🧹 button + `Alt+Shift+F`; toggle persists; `m.facebook.com` branch.
- YouTube: video/Shorts ad auto-skip; ⏭ button + `Alt+Shift+Y`; feed ads hidden.
- Site Blocker: block a Focus/adult/custom site; block screen; "Allow 5 min" snooze; `Alt+Shift+B`.
- View Mode: switch a responsive site; `navigator.userAgent` flips in the page console; long-press → Auto; button position persists.
- Panel: opens from "⚙ Web Cleaner settings…" and the block screen's ⚙; every control works; validation rejects bad input; hotkey rebind captures and fires.
- Menu: all quick actions present and correct per host.
- Persistence: set several non-defaults, reload, confirm they stick.
- Isolation: no console errors; if one module throws (inject a temporary error), the others still run.

---

## Self-review notes

- **Spec coverage:** consolidation (Tasks 1–5), View Mode context split (Task 3), settings layer/persistence (Task 1), unified panel with all tuning + hotkey capture + list editors (Task 6), menu quick actions (Task 7), delete-four + README/index docs + migration note (Task 8), verification via `node --check` + manual checklist (every task). All spec sections map to a task.
- **Persisted master enable, View Mode injection, runtime-editable flags** — the three intentional behavior changes — are implemented in Tasks 4/5, 3, and 6 respectively.
- **Type/name consistency:** `settings.<module>`, `saveModule`, `applyEdit(name, mutate, affects)`, `blockReason`, `vmMode`, `setSiteMode`, `viewModeActive`, `setFacebookEnabled`, `setYoutubeEnabled`, `FOCUS_PACK`, `ADULT_PACK`, `Panel.{open,close,refresh}` are used consistently across tasks.
