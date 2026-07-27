// ==UserScript==
// @name         Web Cleaner
// @namespace    https://local/webcleaner
// @version      6.2.0
// @updateURL    https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js
// @downloadURL  https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==
(function () {
  "use strict";

  const HOST = location.hostname;
  const isFB = /^(www\.|web\.|m\.)?facebook\.com$/.test(HOST);
  const isYT = /^(www\.|m\.)?youtube\.com$|^music\.youtube\.com$/.test(HOST);
  const isMFB = HOST === "m.facebook.com";

  const FOCUS = "facebook.com youtube.com instagram.com tiktok.com x.com twitter.com reddit.com snapchat.com threads.net pinterest.com tumblr.com linkedin.com twitch.tv netflix.com hulu.com dailymotion.com news.ycombinator.com cnn.com bbc.com dailymail.co.uk foxnews.com buzzfeed.com 9gag.com imgur.com boredpanda.com amazon.com ebay.com aliexpress.com temu.com shein.com".split(" ");
  const ADULT = "pornhub.com xvideos.com xnxx.com xhamster.com redtube.com youporn.com spankbang.com onlyfans.com chaturbate.com stripchat.com".split(" ");
  const ADULT_RE = /(porn|xvideos|xhamster|hentai|camsoda|chaturbate|brazzers|onlyfans|nsfw|sexcam|sextube|camgirl)/i;

  const BOUNDS = {
    snoozeMinutes: [1, 1440], desktopWidth: [320, 7680], mobileWidth: [240, 1080],
    mobileHeight: [400, 2400], mobileDpr: [0.5, 5], longPressMs: [100, 5000],
  };

  const DEF = {
    facebook: {
      enabled: true, hideSponsored: true, hideSuggested: true, hidePeopleYouMayKnow: true,
      hideReelsTrays: true, stripTracking: true, showToggleButton: true,
      hideRightSidebar: true, hideLeftSidebar: true, hideComposer: true,
      hideTopBar: true, skipReelsAds: true, forceMostRecent: true, extraJunkPhrases: [],
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "f" },
    },
    youtube: {
      enabled: true, skipVideoAds: true, skipShortsAds: true, hideFeedAds: true,
      hideBanners: true, muteAds: true, dismissAntiAdblock: true, showToggleButton: true,
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "y" },
    },
    siteBlocker: {
      enabled: true, blockAdult: true, blockFocus: false, scheduleOn: true, snoozeMinutes: 5,
      schedule: { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" },
      custom: [], allow: [],
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "b" },
    },
    viewMode: {
      newSiteDefault: "auto", showButton: true, spoofUA: true, spoofTouch: true,
      spoofMedia: true, frameOnDesktop: false, longPressMs: 500,
      desktopWidth: 1280, mobileWidth: 412, mobileHeight: 915, mobileDpr: 2.625,
      mobileUA: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      desktopUA: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "v" },
    },
  };

  // ── storage ────────────────────────────────────────────────
  const PFX = "wc6_";
  const gmOk = typeof GM_getValue === "function" && typeof GM_setValue === "function";

  function storeGet(key, def) {
    if (gmOk) { const v = GM_getValue(PFX + key, "__MISS__"); if (v !== "__MISS__") return v; }
    try { const r = localStorage.getItem(PFX + key); return r === null ? def : JSON.parse(r); } catch (_) { return def; }
  }

  function storeSet(key, val) {
    if (gmOk) try { GM_setValue(PFX + key, val); } catch (_) {}
    try { localStorage.setItem(PFX + key, JSON.stringify(val)); } catch (_) {}
  }

  function deepMerge(def, ov) {
    const r = JSON.parse(JSON.stringify(def));
    if (!ov || typeof ov !== "object") return r;
    for (const k of Object.keys(ov))
      if (k in r && !Array.isArray(r[k]) && typeof r[k] === "object" && !Array.isArray(ov[k]) && typeof ov[k] === "object")
        r[k] = deepMerge(r[k], ov[k]);
      else r[k] = ov[k];
    return r;
  }

  const C = {};
  for (const m of Object.keys(DEF)) C[m] = deepMerge(DEF[m], storeGet(m, null));
  const save = (m) => storeSet(m, C[m]);

  // ── helpers ────────────────────────────────────────────────
  const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const bare    = () => location.hostname.replace(/^www\./, "");
  const norm    = (s) => String(s).normalize("NFKC").toLowerCase().replace(/[^\p{L}]/gu, "");
  const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc     = (s) => String(s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  const q       = (sel, root) => (root || document).querySelector(sel);
  const qa      = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const onReady = (fn) => document.body ? fn() : document.addEventListener("DOMContentLoaded", fn);

  const mk = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs)) k === "style" ? (e.style.cssText = attrs[k]) : e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };

  const addStyle = (id, css, container) => {
    const root = container || document.head || document.documentElement;
    if (root.querySelector?.(`#${id}`)) return;
    const s = mk("style", { id }); s.textContent = css; root.appendChild(s);
  };

  // Trusted Types-safe innerHTML setter.
  // YouTube (and some other Google sites) enforce `require-trusted-types-for 'script'`
  // which blocks raw innerHTML assignment. We create a TrustedTypes policy as fallback.
  const safeSetHTML = (() => {
    let policy = null;
    if (typeof window.trustedTypes !== "undefined" && trustedTypes.createPolicy) {
      try { policy = trustedTypes.createPolicy("wcHTML", { createHTML: (s) => s }); } catch (_) {}
    }
    return (el, html) => {
      try {
        if (policy) el.innerHTML = policy.createHTML(html);
        else el.innerHTML = html;
      } catch (_) {
        // Last resort: parse via DOMParser and transplant nodes
        try {
          const doc = new DOMParser().parseFromString(html, "text/html");
          el.textContent = "";
          for (const n of Array.from(doc.body.childNodes)) el.appendChild(document.adoptNode(n));
        } catch (_2) {}
      }
    };
  })();

  function cleanHost(raw) {
    try {
      const s = String(raw).trim();
      return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : "https://" + s)
        .hostname.replace(/^www\./, "").toLowerCase();
    } catch (_) {
      return String(raw).trim().replace(/^[a-z]+:\/\//i, "").replace(/[/:?#].*$/, "").replace(/^www\./, "").toLowerCase();
    }
  }

  function onHotkey(gs, h) {
    window.addEventListener("keydown", (e) => {
      if (e.metaKey) return;
      const k = gs();
      if (e.ctrlKey !== !!k.ctrl || e.altKey !== !!k.alt || e.shiftKey !== !!k.shift) return;
      if ((e.key || "").toLowerCase() !== String(k.key || "").toLowerCase()) return;
      if (e.target?.isContentEditable || /^(input|textarea|select)$/i.test(e.target?.tagName || "")) return;
      e.preventDefault(); h();
    }, true);
  }

  function interceptNav(cb) {
    const wrap = (fn) => function (...a) {
      let r; try { r = fn.apply(this, a); } catch (e) { throw e; }
      try { cb(); } catch (_) {} return r;
    };
    try { history.pushState = wrap(history.pushState); } catch (_) {}
    try { history.replaceState = wrap(history.replaceState); } catch (_) {}
    window.addEventListener("popstate", () => { try { cb(); } catch (_) {} });
  }

  // ── view mode: direct spoof (no script injection) ──────────
  function defProp(obj, key, getter) {
    try { Object.defineProperty(obj, key, { configurable: true, get: getter }); } catch (_) {}
  }

  function applyVMSpoof() {
    const v = C.viewMode;
    const stored = (() => { try { return localStorage.getItem(PFX + "vm") || ""; } catch (_) { return ""; } })();
    const mode = stored || v.newSiteDefault;
    if (mode === "auto") return;
    const tm = mode === "mobile";

    if (v.spoofUA) {
      const ua = tm ? v.mobileUA : v.desktopUA;
      defProp(navigator, "userAgent", () => ua);
      defProp(navigator, "appVersion", () => ua.replace(/^Mozilla\//, ""));
      defProp(navigator, "platform", () => tm ? "Linux armv8l" : "Win32");
      defProp(navigator, "vendor", () => "Google Inc.");
      try {
        const br = navigator.userAgentData?.brands ?? [];
        defProp(navigator, "userAgentData", () => ({
          mobile: tm, platform: tm ? "Android" : "Windows", brands: br,
          getHighEntropyValues: () => Promise.resolve({ mobile: tm, platform: tm ? "Android" : "Windows" }),
          toJSON: () => ({ mobile: tm, platform: tm ? "Android" : "Windows", brands: br }),
        }));
      } catch (_) {}
    }

    if (v.spoofTouch) {
      defProp(navigator, "maxTouchPoints", () => tm ? 5 : 0);
      try { if (tm && !("ontouchstart" in window)) window.ontouchstart = null; } catch (_) {}
    }

    if (v.spoofMedia) {
      const emuW = tm ? v.mobileWidth : v.desktopWidth;
      const nat = window.matchMedia?.bind(window) ?? null;
      window.matchMedia = (query) => {
        const s = String(query).toLowerCase(); let r = null;
        const f = (val) => { if (r !== false) r = val; }; let m;
        if ((m = s.match(/min-width:\s*([\d.]+)px/))) f(emuW >= parseFloat(m[1]));
        if ((m = s.match(/max-width:\s*([\d.]+)px/))) f(emuW <= parseFloat(m[1]));
        if (s.includes("pointer: coarse") || s.includes("any-pointer: coarse")) f(tm);
        if (s.includes("pointer: fine") || s.includes("any-pointer: fine")) f(!tm);
        if (s.includes("hover: none")) f(tm);
        if (s.includes("hover: hover")) f(!tm);
        if (r === null && nat) return nat(query);
        return { matches: !!r, media: String(query), onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } };
      };

      const realMobile = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(navigator.userAgent) || /iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) || (navigator.userAgentData?.mobile === true);
      if (tm && !realMobile && v.frameOnDesktop) {
        defProp(window, "innerWidth", () => v.mobileWidth);
        defProp(window, "innerHeight", () => v.mobileHeight);
        defProp(screen, "width", () => v.mobileWidth);
        defProp(screen, "height", () => v.mobileHeight);
        defProp(screen, "availWidth", () => v.mobileWidth);
        defProp(screen, "availHeight", () => v.mobileHeight);
        defProp(window, "devicePixelRatio", () => v.mobileDpr);
      }
    }
  }

  applyVMSpoof();

  // ── blocker ────────────────────────────────────────────────
  const sbMatch = (list) => { const h = bare(); return list.some((d) => h === d || h.endsWith("." + d)); };
  const sbSnoozed = () => Date.now() < (storeGet("snz", 0));
  const sbSnooze = (m) => storeSet("snz", Date.now() + m * 60000);

  function sbInSchedule() {
    const { scheduleOn, schedule: sc } = C.siteBlocker;
    if (!scheduleOn || !sc.days.includes(new Date().getDay())) return false;
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    const [fh, fm] = sc.from.split(":").map(Number), [th, tm2] = sc.to.split(":").map(Number);
    const from = fh * 60 + fm, to = th * 60 + tm2;
    return from <= to ? cur >= from && cur < to : cur >= from || cur < to;
  }

  function blockReason() {
    const s = C.siteBlocker;
    if (!s.enabled || sbSnoozed()) return null;
    if (sbMatch(s.allow)) return null;
    if (sbMatch(s.custom)) return "on your block list";
    if (s.blockAdult && (sbMatch(ADULT) || ADULT_RE.test(bare()))) return "blocked by adult filter";
    if ((s.blockFocus || sbInSchedule()) && sbMatch(FOCUS)) return s.blockFocus ? "blocked by focus filter" : "blocked during focus hours";
    return null;
  }

  function applyEdit(mod, mutate, affects) {
    const before = affects === "block" ? !!blockReason() : null;
    mutate(); save(mod);
    (affects === "block" ? before !== !!blockReason() : !!affects) ? location.reload() : Panel.refresh();
  }

  // ── view mode state ────────────────────────────────────────
  const vmMode = (() => { try { return localStorage.getItem(PFX + "vm") || ""; } catch (_) { return ""; } })() || C.viewMode.newSiteDefault;
  const vmActive = () => vmMode !== "auto";
  const setVM = (m) => { try { localStorage.setItem(PFX + "vm", m); } catch (_) {} location.reload(); };

  function initVM() {
    const v = C.viewMode;
    const realMobile = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(navigator.userAgent) || /iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) || (navigator.userAgentData?.mobile === true);
    const useFrame = vmMode === "mobile" && !realMobile && v.frameOnDesktop;
    let vpLocked = false;

    function applyVP() {
      if (vmMode === "auto" || vpLocked) return; vpLocked = true;
      qa('meta[name="viewport"]').forEach((e) => { if (!e.hasAttribute("data-wc")) e.remove(); });
      let m = q('meta[name="viewport"][data-wc]');
      if (!m) { m = mk("meta", { name: "viewport", "data-wc": "1" }); (document.head || document.documentElement).appendChild(m); }
      m.setAttribute("content", vmMode === "desktop" ? `width=${v.desktopWidth}` : "width=device-width,initial-scale=1,viewport-fit=cover");
      vpLocked = false;
    }

    function applyFrame() {
      if (!useFrame) return;
      addStyle("vm-frame", `html.vm-f{background:#202124!important;overflow-x:hidden!important}html.vm-f>body{width:${v.mobileWidth}px!important;min-width:${v.mobileWidth}px!important;max-width:${v.mobileWidth}px!important;margin:0 auto!important;min-height:100vh!important;overflow-x:hidden!important;box-shadow:0 0 0 100vmax #202124,0 0 40px rgba(0,0,0,.6)!important}`);
      document.documentElement.classList.add("vm-f");
    }

    applyVP();
    if (vmMode !== "auto") {
      new MutationObserver(() => { if (!vpLocked) applyVP(); }).observe(document.head || document.documentElement, { childList: true, subtree: true });
      document.addEventListener("DOMContentLoaded", () => { applyVP(); applyFrame(); });
      [200, 600, 1500, 3500].forEach((t) => setTimeout(() => { applyVP(); applyFrame(); }, t));
    }
    onHotkey(() => v.toggleHotkey, () => setVM(vmMode === "desktop" ? "mobile" : "desktop"));
  }

  // ── panel templates ────────────────────────────────────────
  const keyLabel = (h) => (h.ctrl ? "Ctrl+" : "") + (h.alt ? "Alt+" : "") + (h.shift ? "Shift+" : "") + String(h.key || "").toUpperCase();

  const sw = (l, m, k) => `<div class="r"><span>${esc(l)}</span><label class="sw"><input type="checkbox" data-sw="${m}.${k}"${C[m][k] ? " checked" : ""}><span class="tk"></span></label></div>`;
  const sw2 = (l1, m1, k1, l2, m2, k2) => `<div class="r2"><span>${esc(l1)}</span><label class="sw"><input type="checkbox" data-sw="${m1}.${k1}"${C[m1][k1] ? " checked" : ""}><span class="tk"></span></label><span style="margin-left:auto">${esc(l2)}</span><label class="sw"><input type="checkbox" data-sw="${m2}.${k2}"${C[m2][k2] ? " checked" : ""}><span class="tk"></span></label></div>`;
  const num2 = (l1, m1, k1, l2, m2, k2) => `<div class="r2"><span>${esc(l1)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m1}.${k1}" value="${esc(C[m1][k1])}"><span style="margin-left:auto">${esc(l2)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m2}.${k2}" value="${esc(C[m2][k2])}"></div>`;
  const time2 = (l1, m, k1, l2, k2) => `<div class="r2"><span>${esc(l1)}</span><input class="tm" type="time" data-time="${m}.${k1}" value="${esc(C[m].schedule[k1])}"><span style="margin-left:auto">${esc(l2)}</span><input class="tm" type="time" data-time="${m}.${k2}" value="${esc(C[m].schedule[k2])}"></div>`;
  const numRow = (l, m, k) => `<div class="r"><span>${esc(l)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m}.${k}" value="${esc(C[m][k])}"></div>`;
  const txtRow = (l, m, k) => `<div class="fr"><span style="font-size:12px;color:#8a8a90">${esc(l)}</span><input class="tx" type="text" autocorrect="off" autocapitalize="none" data-txt="${m}.${k}" value="${esc(C[m][k])}"></div>`;
  const hkRow = (m) => `<div class="r"><span>Shortcut</span><button class="hk" data-hk="${m}">${esc(keyLabel(C[m].toggleHotkey))}</button></div>`;

  const swGrid = (mod, pairs) => `<div class="gr">${pairs.map(([l, k]) => `<div class="r"><span>${esc(l)}</span><label class="sw"><input type="checkbox" data-sw="${mod}.${k}"${C[mod][k] ? " checked" : ""}><span class="tk"></span></label></div>`).join("")}</div>`;

  function listBlock(label, mod, key, ph) {
    const arr = C[mod][key], path = `${mod}.${key}`;
    const items = arr.length ? arr.map((d) => `<div class="it"><span title="${esc(d)}">${esc(d)}</span><button class="dl" data-dl="${path}" data-v="${esc(d)}">✕</button></div>`).join("") : `<div class="em">Empty</div>`;
    return `<div class="sc"><h2>${esc(label)}</h2>${items}<div class="ad"><input type="text" autocorrect="off" autocapitalize="none" data-ai="${path}" placeholder="${esc(ph)}"><button data-ab="${path}">+</button></div></div>`;
  }

  function packHtml(sites) {
    return `<div class="pg">${sites.map((d) => {
      const on = C.siteBlocker.allow.includes(d);
      return `<button class="pl ${on ? "al" : "bl"}" data-pk="${esc(d)}">${esc(d)}</button>`;
    }).join("")}</div>`;
  }

  const secSB = () => {
    const s = C.siteBlocker;
    return `<details data-s=sb open><summary>⛔ Site Blocker ${s.enabled ? "ON" : "OFF"}</summary>
      <div class="r"><div>Blocking<div class="cu">${esc(HOST)}</div></div><label class="sw"><input type="checkbox" data-sw="siteBlocker.enabled"${s.enabled ? " checked" : ""}><span class="tk"></span></label></div>
      ${sw2("Adult filter","siteBlocker","blockAdult","Focus mode","siteBlocker","blockFocus")}
      ${sw("Schedule (" + esc(s.schedule.from) + "–" + esc(s.schedule.to) + ")","siteBlocker","scheduleOn")}
      ${sbSnoozed() ? `<div class="cu snz">⏱ Snoozed — tap to cancel</div>` : ""}
      ${listBlock("Blocked","siteBlocker","custom","example.com")}
      ${listBlock("Allowed","siteBlocker","allow","example.com")}
      <details data-s=focus><summary>Focus pack (${FOCUS.length})</summary>${packHtml(FOCUS)}</details>
      <details data-s=adult><summary>Adult pack (${ADULT.length})</summary>${packHtml(ADULT)}</details>
      <details data-s=sb-adv><summary>Advanced</summary>${time2("From","siteBlocker","from","To","to")}${numRow("Snooze minutes","siteBlocker","snoozeMinutes")}${hkRow("siteBlocker")}</details>
    </details>`;
  };

  const secVM = () => {
    const v = C.viewMode, modes = ["desktop", "mobile", "auto"];
    const seg = (val, attr) => `<button class="${(attr === "data-vm" ? vmMode : v.newSiteDefault) === val ? "on" : ""}" ${attr}="${val}">${val[0].toUpperCase() + val.slice(1)}</button>`;
    return `<details data-s=vm><summary>🖥 View ${vmMode.toUpperCase()}</summary>
      <div class="r2"><span>Site</span><div class="sg">${modes.map((m) => seg(m, "data-vm")).join("")}</div><span style="margin-left:auto">Default</span><div class="sg">${modes.map((m) => seg(m, "data-df")).join("")}</div></div>
      ${swGrid("viewMode", [["Spoof UA", "spoofUA"], ["Spoof touch", "spoofTouch"], ["Spoof media", "spoofMedia"], ["Phone frame", "frameOnDesktop"], ["Show button", "showButton"]])}
      <details data-s=vm-adv><summary>Advanced</summary>${num2("Desktop W", "viewMode", "desktopWidth", "Mobile W", "viewMode", "mobileWidth")}${num2("Mobile H", "viewMode", "mobileHeight", "DPR", "viewMode", "mobileDpr")}${numRow("Long-press ms", "viewMode", "longPressMs")}${txtRow("Mobile UA", "viewMode", "mobileUA")}${txtRow("Desktop UA", "viewMode", "desktopUA")}${hkRow("viewMode")}</details>
    </details>`;
  };

  const secFB = () => `<details data-s=facebook><summary>🧹 Facebook ${C.facebook.enabled ? "ON" : "OFF"}</summary>
    ${swGrid("facebook", [["Enabled", "enabled"], ["Sponsored", "hideSponsored"], ["Suggested", "hideSuggested"], ["People YMKN", "hidePeopleYouMayKnow"], ["Reels/Stories", "hideReelsTrays"], ["Right sidebar", "hideRightSidebar"], ["Left sidebar", "hideLeftSidebar"], ["Composer", "hideComposer"], ["Top bar", "hideTopBar"], ["Strip tracking", "stripTracking"], ["Skip Reel ads", "skipReelsAds"], ["Most Recent", "forceMostRecent"]])}
    ${sw("Show toggle button", "facebook", "showToggleButton")}
    ${listBlock("Extra junk phrases", "facebook", "extraJunkPhrases", "phrase")}
    <details data-s=fb-adv><summary>Advanced</summary>${hkRow("facebook")}</details></details>`;

  const secYT = () => `<details data-s=youtube><summary>⏭ YouTube ${C.youtube.enabled ? "ON" : "OFF"}</summary>
    ${swGrid("youtube", [["Enabled", "enabled"], ["Skip video ads", "skipVideoAds"], ["Skip Shorts ads", "skipShortsAds"], ["Hide feed ads", "hideFeedAds"], ["Hide banners", "hideBanners"], ["Mute ads", "muteAds"], ["Anti-adblock", "dismissAntiAdblock"], ["Show button", "showToggleButton"]])}
    <details data-s=yt-adv><summary>Advanced</summary>${hkRow("youtube")}</details></details>`;

  // ── panel CSS ──────────────────────────────────────────────
  const PCSS = `:host{all:initial}*{box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}.bk{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:2147483646;-webkit-tap-highlight-color:transparent}.cd{position:fixed;inset:0;margin:auto;width:min(480px,calc(100vw - 16px));height:fit-content;max-height:min(92dvh,880px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#17181b;color:#e9e9ea;border-radius:20px;padding:16px 14px;box-shadow:0 20px 60px rgba(0,0,0,.8);z-index:2147483647;font-size:14px;line-height:1.4}.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.hd h1{font-size:17px;font-weight:700;margin:0}.x{background:#2b2b30;border:0;color:#e9e9ea;font-size:16px;cursor:pointer;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:0 0 auto;-webkit-appearance:none}.r{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 0;border-top:1px solid #26272c;min-height:44px}.r>span{flex:1;line-height:1.25;font-size:13px}.r2{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid #26272c;min-height:44px;flex-wrap:wrap}.r2>span{font-size:13px;flex:0 0 auto}.fr{display:flex;flex-direction:column;gap:5px;padding:8px 0;border-top:1px solid #26272c}.cu{font-size:11px;color:#8a8a90;margin-top:2px}.snz{cursor:pointer;text-decoration:underline;text-underline-offset:2px}.gr{display:grid;grid-template-columns:1fr 1fr;gap:0}.gr .r{border-right:1px solid #26272c;padding-right:6px}.gr .r:nth-child(2n){border-right:0;padding-left:6px;padding-right:0}.sc{margin-top:10px}.sc>h2{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7a7a80;margin:0 0 2px}.it{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:6px 0;border-top:1px solid #26272c;min-height:40px}.it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:13px}.dl{background:none;border:0;color:#ff6b6b;cursor:pointer;padding:0;width:30px;height:30px;font-size:16px;display:flex;align-items:center;justify-content:center;flex:0 0 auto;-webkit-appearance:none;border-radius:50%}.dl:active{background:#2b2b30}.ad{display:flex;gap:6px;margin-top:6px}.ad input{flex:1;min-width:0;background:#0e0f11;border:1.5px solid #303138;color:#e9e9ea;border-radius:12px;padding:10px 12px;font-size:14px;-webkit-appearance:none;min-height:44px}.ad input:focus{border-color:#3a7afe;outline:none}.ad button{background:#3a7afe;border:0;color:#fff;border-radius:12px;cursor:pointer;padding:0 16px;font-size:16px;flex:0 0 auto;-webkit-appearance:none;min-height:44px;font-weight:700}.em{color:#6a6a70;font-style:italic;padding:6px 0;border-top:1px solid #26272c;font-size:13px}.sw{position:relative;display:inline-block;width:46px;height:28px;flex:0 0 auto}.sw input{opacity:0;width:0;height:0;position:absolute}.tk{position:absolute;inset:0;background:#3a3b42;border-radius:999px;transition:.2s;cursor:pointer}.tk::before{content:"";position:absolute;width:24px;height:24px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 4px rgba(0,0,0,.3)}.sw input:checked+.tk{background:#34c759}.sw input:checked+.tk::before{transform:translateX(18px)}details{margin-top:4px}summary{cursor:pointer;padding:8px 0;color:#b0b0b6;border-top:1px solid #26272c;list-style:none;user-select:none;font-weight:600;font-size:13px;min-height:40px;display:flex;align-items:center;gap:4px}summary::-webkit-details-marker{display:none}details[open]>summary::after{content:"▲";font-size:8px;color:#6a6a70;margin-left:auto}details:not([open])>summary::after{content:"▼";font-size:8px;color:#6a6a70;margin-left:auto}.pl{border:0;border-radius:8px;cursor:pointer;padding:4px 10px;font-size:11px;flex:0 0 auto;-webkit-appearance:none;min-height:30px;font-weight:500}.bl{background:#3a2b2b;color:#ff9a9a}.al{background:#1e3020;color:#7ee89a}.pg{display:flex;flex-wrap:wrap;gap:4px;padding:6px 0}.nm{width:80px;background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:6px 8px;font-size:13px;text-align:right;-webkit-appearance:none;min-height:36px}.tm{background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:6px 8px;font-size:13px;-webkit-appearance:none;min-height:36px;width:100px}.tx{background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:8px 10px;font-size:12px;width:100%;-webkit-appearance:none;min-height:36px}.nm:focus,.tm:focus,.tx:focus{border-color:#3a7afe;outline:none}.hk{background:#2b2b30;border:0;color:#e9e9ea;border-radius:8px;cursor:pointer;padding:6px 12px;font-size:12px;-webkit-appearance:none;min-height:36px}.hk.arm{background:#3a7afe;color:#fff}.sg{display:flex;gap:4px;flex:0 0 auto}.sg button{flex:1;background:#2b2b30;border:0;color:#c9c9cf;border-radius:8px;cursor:pointer;padding:6px 8px;font-size:12px;-webkit-appearance:none;min-height:36px;white-space:nowrap}.sg button.on{background:#3a7afe;color:#fff;font-weight:600}`;

  // ── panel logic ────────────────────────────────────────────
  const Panel = (() => {
    let root = null, capFn = null, armed = null;
    const affects = (m) => m === "siteBlocker" ? "block" : m === "facebook" ? isFB : m === "youtube" ? isYT : m === "viewMode" ? vmActive() : false;
    const edit = (m, fn) => { armed = null; applyEdit(m, fn, affects(m)); };
    const onEsc = (e) => { if (!armed && e.key === "Escape") { e.preventDefault(); close(); } };

    function render() {
      const sh = root.shadowRoot, openMap = {};
      qa("details[data-s]", sh).forEach((d) => { openMap[d.getAttribute("data-s")] = d.open; });

      const html = `<style>${PCSS}</style>
        <div class="bk" data-x></div>
        <div class="cd" role="dialog" aria-modal="true">
          <div class="hd"><h1>🧼 Web Cleaner</h1><button class="x" data-x>✕</button></div>
          ${secSB()}${secVM()}${isFB ? secFB() : ""}${isYT ? secYT() : ""}
        </div>`;

      safeSetHTML(sh, html);

      qa("details[data-s]", sh).forEach((d) => { if (openMap[d.getAttribute("data-s")]) d.open = true; });
      wire(sh);
    }

    function wire(sh) {
      qa("[data-x]", sh).forEach((e) => e.addEventListener("click", close));
      sh.querySelector(".snz")?.addEventListener("click", () => { storeSet("snz", 0); location.reload(); });

      qa("[data-sw]", sh).forEach((e) => e.addEventListener("change", () => {
        const [m, k] = e.getAttribute("data-sw").split(".");
        if (m === "facebook" && k === "enabled") { toggleFB(e.checked); render(); return; }
        if (m === "youtube" && k === "enabled") { toggleYT(e.checked); render(); return; }
        edit(m, () => { C[m][k] = e.checked; });
      }));

      qa("[data-num]", sh).forEach((e) => e.addEventListener("change", () => {
        const [m, k] = e.getAttribute("data-num").split(".");
        let v = parseFloat(e.value);
        if (!isFinite(v) || v <= 0) { render(); return; }
        if (BOUNDS[k]) v = clamp(v, BOUNDS[k][0], BOUNDS[k][1]);
        edit(m, () => { C[m][k] = v; });
      }));

      qa("[data-txt]", sh).forEach((e) => e.addEventListener("change", () => {
        const [m, k] = e.getAttribute("data-txt").split(".");
        const v = e.value.trim(); if (!v) { render(); return; }
        edit(m, () => { C[m][k] = v; });
      }));

      qa("[data-time]", sh).forEach((e) => e.addEventListener("change", () => {
        const k = e.getAttribute("data-time").split(".")[1];
        if (!/^\d{2}:\d{2}$/.test(e.value)) { render(); return; }
        edit("siteBlocker", () => { C.siteBlocker.schedule[k] = e.value; });
      }));

      qa("[data-dl]", sh).forEach((e) => e.addEventListener("click", () => {
        const [m, k] = e.getAttribute("data-dl").split(".");
        edit(m, () => { C[m][k] = C[m][k].filter((d) => d !== e.getAttribute("data-v")); });
      }));

      qa("[data-ab]", sh).forEach((btn) => {
        const path = btn.getAttribute("data-ab"), [m, k] = path.split(".");
        const inp = sh.querySelector(`[data-ai="${path}"]`);
        const go = () => {
          const v = m === "facebook" ? inp.value.trim().toLowerCase() : cleanHost(inp.value);
          if (!v) return; inp.value = "";
          edit(m, () => {
            if (!C[m][k].includes(v)) C[m][k].push(v);
            if (m === "siteBlocker") {
              if (k === "custom") C.siteBlocker.allow = C.siteBlocker.allow.filter((d) => d !== v);
              if (k === "allow") C.siteBlocker.custom = C.siteBlocker.custom.filter((d) => d !== v);
            }
          });
        };
        btn.addEventListener("click", go);
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
        inp.addEventListener("keyup", (e) => { if (e.key === "Enter") go(); });
      });

      qa("[data-pk]", sh).forEach((b) => b.addEventListener("click", () => {
        const v = b.getAttribute("data-pk");
        edit("siteBlocker", () => { const a = C.siteBlocker.allow; C.siteBlocker.allow = a.includes(v) ? a.filter((d) => d !== v) : [...a, v]; });
      }));

      qa("[data-vm]", sh).forEach((b) => b.addEventListener("click", () => setVM(b.getAttribute("data-vm"))));
      qa("[data-df]", sh).forEach((b) => b.addEventListener("click", () => edit("viewMode", () => { C.viewMode.newSiteDefault = b.getAttribute("data-df"); })));

      qa("[data-hk]", sh).forEach((b) => b.addEventListener("click", () => {
        const m = b.getAttribute("data-hk");
        armed = m; b.textContent = "Press keys…"; b.classList.add("arm");
        if (capFn) { window.removeEventListener("keydown", capFn, true); capFn = null; }
        capFn = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
          window.removeEventListener("keydown", capFn, true); capFn = null; armed = null;
          if (e.metaKey || !(e.altKey || e.ctrlKey || e.shiftKey)) { render(); return; }
          applyEdit(m, () => { C[m].toggleHotkey = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, key: e.key.toLowerCase() }; }, false);
        };
        window.addEventListener("keydown", capFn, true);
      }));
    }

    function open() {
      if (root) { close(); return; }
      if (!document.body) return;
      root = mk("div", { id: "wc-panel", style: "all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:all" });
      root.attachShadow({ mode: "open" });
      document.body.appendChild(root);
      render();
      document.addEventListener("keydown", onEsc, true);
    }

    function close() {
      if (capFn) { window.removeEventListener("keydown", capFn, true); capFn = null; }
      armed = null; root?.remove(); root = null;
      document.removeEventListener("keydown", onEsc, true);
    }

    return { open, close, refresh: () => { if (root?.shadowRoot) render(); } };
  })();

  // ── button cluster ─────────────────────────────────────────
  const CBTN = "width:42px;height:42px;border-radius:50%;border:none;cursor:pointer;font-size:18px;line-height:42px;padding:0;text-align:center;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.4);transition:transform .1s,opacity .2s;-webkit-appearance:none;";

  function initCluster() {
    if (!document.body || document.getElementById("wc-cl")) return;
    const cl = mk("div", { id: "wc-cl", style: "position:fixed;z-index:2147483647;display:flex;flex-direction:column;gap:6px;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;padding:4px;border-radius:28px;background:rgba(0,0,0,.15)" });

    const saved = (() => { try { return JSON.parse(localStorage.getItem(PFX + "clpos") || "null"); } catch (_) { return null; } })();
    if (saved?.l != null) {
      cl.style.left = clamp(saved.l, 0, innerWidth - 52) + "px";
      cl.style.top = clamp(saved.t, 0, innerHeight - 200) + "px";
      cl.style.right = cl.style.bottom = "auto";
    } else {
      cl.style.right = "8px";
      cl.style.bottom = `calc(24px + env(safe-area-inset-bottom))`;
    }

    const addBtn = (icon, bg, color, opacity, id) => {
      const b = mk("button", { style: `${CBTN}background:${bg};color:${color};opacity:${opacity}`, "aria-label": icon }, icon);
      if (id) b.id = id;
      cl.appendChild(b);
      return b;
    };

    let startX = 0, startY = 0, isDragging = false, activePtr = null;

    cl.addEventListener("pointerdown", (e) => {
      startX = e.clientX; startY = e.clientY;
      isDragging = false; activePtr = e.pointerId;
    });

    cl.addEventListener("pointermove", (e) => {
      if (activePtr === null) return;
      if (!isDragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
        isDragging = true;
        try { cl.setPointerCapture(e.pointerId); } catch (_) {}
      }
      if (isDragging) {
        e.preventDefault();
        cl.style.left = clamp(e.clientX - 26, 0, innerWidth - 52) + "px";
        cl.style.top = clamp(e.clientY - 26, 0, innerHeight - 60) + "px";
        cl.style.right = cl.style.bottom = "auto";
      }
    });

    cl.addEventListener("pointerup", (e) => {
      if (isDragging) {
        try { cl.releasePointerCapture(e.pointerId); } catch (_) {}
        try { localStorage.setItem(PFX + "clpos", JSON.stringify({ l: parseInt(cl.style.left), t: parseInt(cl.style.top) })); } catch (_) {}
      }
      activePtr = null; isDragging = false;
    });

    cl.addEventListener("pointercancel", () => { activePtr = null; isDragging = false; });

    // 🧼 settings
    addBtn("🧼", "#1c1c2e", "#fff", ".85", "").addEventListener("click", () => { if (!isDragging) Panel.open(); });

    // view mode
    if (C.viewMode.showButton) {
      const icon = vmMode === "desktop" ? "🖥" : vmMode === "mobile" ? "📱" : "🔄";
      const vmBtn = addBtn(icon, "rgba(20,20,34,.85)", "#fff", ".75", "");
      let longTimer = null;
      vmBtn.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        longTimer = setTimeout(() => { longTimer = null; setVM("auto"); }, C.viewMode.longPressMs);
      });
      vmBtn.addEventListener("pointerup", () => {
        if (longTimer) { clearTimeout(longTimer); longTimer = null; if (!isDragging) setVM(vmMode === "desktop" ? "mobile" : "desktop"); }
      });
      vmBtn.addEventListener("pointercancel", () => { if (longTimer) { clearTimeout(longTimer); longTimer = null; } });
      vmBtn.addEventListener("pointermove", (e) => e.stopPropagation());
    }

    // facebook
    if (isFB && C.facebook.showToggleButton)
      addBtn("🧹", "#fff", "#111", C.facebook.enabled ? "1" : ".3", "fcf-btn").addEventListener("click", () => { if (!isDragging) toggleFB(!C.facebook.enabled); });

    // youtube
    if (isYT && C.youtube.showToggleButton)
      addBtn("⏭", "#fff", "#111", C.youtube.enabled ? "1" : ".3", "yt-btn").addEventListener("click", () => { if (!isDragging) toggleYT(!C.youtube.enabled); });

    document.body.appendChild(cl);
  }

  // ── site blocker ───────────────────────────────────────────
  function initSB() {
    function showBlock(why) {
      try { window.stop(); } catch (_) {}
      document.documentElement.innerHTML = `<head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Blocked</title></head><body></body>`;
      const b = document.body; b.id = "wc-blk";
      Object.assign(b.style, { margin: "0", minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px", textAlign: "center", padding: `32px 24px calc(32px + env(safe-area-inset-bottom)) 24px`, fontFamily: "-apple-system,system-ui,sans-serif", background: "#0b0b0c", color: "#e9e9ea" });
      const btn = (text, bg, fg = "#e9e9ea") => mk("button", { style: `padding:14px 28px;border:0;border-radius:16px;cursor:pointer;font-size:17px;font-weight:600;min-height:52px;-webkit-appearance:none;background:${bg};color:${fg};width:min(280px,100%)` }, text);
      const ab = btn(`Allow for ${C.siteBlocker.snoozeMinutes} min`, "#2b2b30"); ab.onclick = () => { sbSnooze(C.siteBlocker.snoozeMinutes); location.reload(); };
      const mb = btn("⚙ Manage", "#1c1c22", "#9a9aa0"); mb.style.fontSize = "15px"; mb.onclick = Panel.open;
      b.append(mk("div", { style: "font-size:72px;line-height:1;margin-bottom:4px" }, "⛔"), mk("div", { style: "font-size:26px;font-weight:700" }, "Blocked"), mk("div", { style: "opacity:.6;max-width:26rem;line-height:1.6;font-size:16px" }, `${bare()} — ${why}.`), ab, mb);
    }
    const check = () => { const w = blockReason(); if (w && !document.getElementById("wc-blk")) showBlock(w); };
    check(); setInterval(check, 5000);
    onHotkey(() => C.siteBlocker.toggleHotkey, () => applyEdit("siteBlocker", () => { C.siteBlocker.enabled = !C.siteBlocker.enabled; }, "block"));
  }

  // ── facebook ───────────────────────────────────────────────
  function toggleFB(on) {
    C.facebook.enabled = on; save("facebook");
    document.documentElement.classList.toggle("fcf-off", !on);
    const b = document.getElementById("fcf-btn"); if (b) b.style.opacity = on ? "1" : ".3";
  }

  function initFB() {
    const f = C.facebook;
    if (!f.enabled) document.documentElement.classList.add("fcf-off");
    if (!isMFB && f.forceMostRecent && (location.pathname === "/" || location.pathname === "/home.php") && !/[?&]sk=/.test(location.search)) { location.replace(location.origin + "/?sk=h_chr"); return; }

    const SPON = "sponsored paidpartnership publicidad patrocinado sponsoris commandit gesponsert sponsorizzat gesponsord bersponsor sponsorlu sponsorowan sponsrad sponset sponsoreret ممول ממומן реклама 広告 광고 赞助 贊助 χορηγούμενη".split(" ").map(norm);
    const MARKS = [...(f.hideSponsored ? SPON : []), ...(f.hideSuggested ? ["suggestedforyou", "suggestedpost", "pagesforyou", "pagesyoumaylike", "groupsyoumaylike"] : []), ...(f.hidePeopleYouMayKnow ? ["peopleyoumayknow"] : []), ...f.extraJunkPhrases.map(norm)];
    const EXACT = f.hideReelsTrays ? ["reels", "reelsandshortvideos", "stories"] : [];
    const STRIP = /[\u200b-\u200f\u202a-\u202e\ufeff\u00ad\u2060]/g;

    (() => {
      const R = ["html:not(.fcf-off) [data-fcf]{display:none!important}"];
      if (!isMFB) {
        const X = "html.fcf-s:not(.fcf-off) ";
        if (f.hideRightSidebar) R.push(`${X}[role="complementary"]{display:none!important}`);
        if (f.hideLeftSidebar) R.push(`${X}[role="navigation"][aria-label="Shortcuts"]{display:none!important}`, `html:not(.fcf-off) [data-fcf-ln]{display:none!important}`);
        if (f.hideComposer) R.push(`${X}[role="region"][aria-label="Create a post"]{display:none!important}`);
        if (f.hideTopBar) R.push(`${X}[role="banner"],${X}[role="navigation"][aria-label="Facebook"],${X}[role="navigation"][aria-label="Account Controls and Settings"]{display:none!important}`);
        if (f.hideReelsTrays) R.push(`${X}[aria-label="Stories"],${X}[aria-label="Reels"]{display:none!important}`);
        R.push(`${X}[role="main"]{margin-left:auto!important;margin-right:auto!important}`);
        if (f.hideTopBar) R.push(`${X}body{padding-top:0!important}`);
      }
      addStyle("fcf-css", R.join("\n"));
    })();

    function readText(scope, bt, bb) {
      const g = []; let budget = 600;
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null); let n;
      while ((n = walker.nextNode()) && budget-- > 0) {
        const s = n.nodeValue; if (!s?.trim()) continue;
        const p = n.parentElement; if (!p || p.closest('[aria-hidden="true"]')) continue;
        const cs = getComputedStyle(p);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0" || cs.fontSize === "0px") continue;
        const pr = p.getBoundingClientRect();
        if (!pr.width || !pr.height || pr.right <= 0 || pr.bottom < bt || pr.top > bb) continue;
        const rng = document.createRange(); rng.selectNodeContents(n);
        const r = rng.getBoundingClientRect();
        if (!r.width || !r.height || r.right <= 0 || r.top < bt || r.top > bb) continue;
        g.push({ c: s.trim(), t: Math.round(r.top), l: Math.round(r.left) });
      }
      const seen = new Set(), kept = [];
      for (const x of g) { const k = `${x.t}:${x.l}`; if (!seen.has(k)) { seen.add(k); kept.push(x); } }
      kept.sort((a, b) => (a.t - b.t) || (a.l - b.l));
      return kept.map((x) => x.c).join("").replace(STRIP, "").replace(/\s+/g, " ").trim();
    }

    const isJunk = (c) => MARKS.some((m) => c.includes(m)) || EXACT.includes(c);
    let _feed = null, _skipEl = null, _skipN = 0;
    interceptNav(() => { _feed = null; _skipEl = null; _skipN = 0; });

    function feedBox() {
      if (_feed?.isConnected) return _feed;
      const main = q('[role="main"]'); if (!main) return null;
      let best = null, bn = 1;
      for (const d of main.querySelectorAll("div")) {
        let n = 0; for (const c of d.children) { const r = c.getBoundingClientRect(); if (r.width >= 500 && r.width <= 720 && r.height > 60) n++; }
        if (n > bn) { bn = n; best = d; }
      }
      return (_feed = best);
    }

    function processDesktop() {
      const fd = feedBox(); if (!fd) return; const vh = innerHeight;
      for (const st of fd.children) {
        if (st._wc === "h" || st._wc === "c") continue;
        const r = st.getBoundingClientRect();
        if (r.height < 60 || r.bottom < -500 || r.top > vh + 500) continue;
        const hdr = readText(st, r.top - 2, r.top + 130); if (!hdr) continue;
        if (isJunk(norm(hdr)) || (f.hideReelsTrays && st.querySelectorAll('a[href*="/reel/"]').length > 3)) { st.setAttribute("data-fcf", ""); st._wc = "h"; }
        else if ((st._wcN = (st._wcN || 0) + 1) >= 4) st._wc = "c";
      }
    }

    function processMobile() {
      for (const p of document.querySelectorAll("[data-tracking-duration-id]")) {
        if (p._wc) continue; let junk = false;
        for (const e of p.querySelectorAll('span,a[role="link"],h3,h4,div[role="heading"]')) {
          if (junk) break; const raw = (e.textContent || "").trim(); if (!raw || raw.length > 40) continue;
          const t = norm(raw); if (!t) continue;
          if (MARKS.some((m) => t === m || t.startsWith(m)) || EXACT.includes(t)) junk = true;
        }
        if (junk) { p.setAttribute("data-fcf", ""); p._wc = "h"; } else if ((p._wcN = (p._wcN || 0) + 1) >= 4) p._wc = "c";
      }
    }

    function hideLeftNav() {
      if (!f.hideLeftSidebar) return;
      for (const n of document.querySelectorAll('[role="navigation"]:not([data-fcf-ln])')) {
        const r = n.getBoundingClientRect();
        if (r.height > 350 && r.width >= 120 && r.width <= 460 && r.left <= 24) n.setAttribute("data-fcf-ln", "");
      }
    }

    const _reelSt = new WeakMap(); let _skipT = 0;
    function handleReels() {
      if (!f.skipReelsAds || !/^\/reels?(\/|$)/.test(location.pathname)) return;
      const cy = innerHeight / 2; let act = null, best = 1e9;
      for (const v of document.querySelectorAll("video")) { const r = v.getBoundingClientRect(); if (r.height < 200) continue; const d = Math.abs((r.top + r.bottom) / 2 - cy); if (d < best) { best = d; act = v; } }
      if (!act) return;
      let rl = act; for (let i = 0; i < 12 && rl.parentElement; i++) { rl = rl.parentElement; if (rl.querySelector('[aria-label="Like"],[aria-label^="Comment"],[role="button"][aria-label="Next Card"]')) break; }
      if (!reelSpon(rl, act)) { if (act !== _skipEl) { _skipEl = null; _skipN = 0; } return; }
      if (act !== _skipEl) { _skipEl = act; _skipN = 0; }
      if (Date.now() - _skipT < 600 || _skipN >= 8) return; _skipN++; _skipT = Date.now();
      const nx = q('[role="button"][aria-label="Next Card"]'); if (nx) { nx.click(); return; }
      const tg = rl.closest("[tabindex]") || rl;
      for (const tp of ["keydown", "keyup"]) tg.dispatchEvent(new KeyboardEvent(tp, { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true }));
    }

    function reelSpon(rl, key) {
      let st = _reelSt.get(key); if (!st) _reelSt.set(key, (st = { s: false, n: 0 }));
      if (st.s) return true; if (st.n >= 8) return false; st.n++;
      const r = rl.getBoundingClientRect(), c = norm(readText(rl, r.top - 2, r.bottom + 2));
      if (SPON.some((m) => c.includes(m))) st.s = true; return st.s;
    }

    const TKEYS = new Set("fbclid gclid dclid gbraid wbraid msclkid yclid twclid igshid mc_eid mc_cid _openstat vero_id oly_enc_id oly_anon_id wickedid _hsenc _hsmi mkt_tok ref refsrc refid fref hc_ref hc_location ref_src ref_url eav paipv comment_tracking av rdid".split(" "));
    const SHIMS = new Set(["l.facebook.com", "lm.facebook.com", "l.messenger.com"]);
    const isTK = (k) => TKEYS.has(k) || k.startsWith("utm_") || k.startsWith("__");

    function cleanUrl(href) {
      let u; try { u = new URL(href, location.href); } catch (_) { return null; } let dirty = false;
      if (SHIMS.has(u.hostname) && u.pathname === "/l.php") { const real = u.searchParams.get("u"); if (real) try { const x = new URL(real); if (/^https?:$/.test(x.protocol)) { u = x; dirty = true; } } catch (_) {} }
      for (const k of [...u.searchParams.keys()]) if (isTK(k)) { u.searchParams.delete(k); dirty = true; }
      return dirty ? u.toString() : null;
    }

    function cleanLinks() {
      const h = cleanUrl(location.href); if (h) history.replaceState(history.state, "", h);
      for (const a of document.querySelectorAll('a[href^="http"]:not([data-fcf-cl])')) {
        a.setAttribute("data-fcf-cl", ""); const c = cleanUrl(a.getAttribute("data-lynx-uri") || a.href); if (c) a.href = c;
        a.removeAttribute("ping"); a.removeAttribute("data-lynx-uri");
      }
    }

    const isFeed = () => { const pp = location.pathname; return pp === "/" || pp === "/home.php"; };
    const isClean = () => { const pp = location.pathname.replace(/\/$/, ""); return isFeed() || pp === "/groups/feed" || pp === "/watch" || /^\/groups\/[^/]+$/.test(pp); };

    function sweep() {
      try { if (f.stripTracking) cleanLinks(); if (isMFB) { processMobile(); return; } hideLeftNav(); document.documentElement.classList.toggle("fcf-s", isFeed()); if (isClean()) processDesktop(); handleReels(); } catch (_) {}
    }

    let scheduled = false;
    const idle = window.requestIdleCallback?.bind(window) ?? requestAnimationFrame;
    const schedule = () => { if (!scheduled) { scheduled = true; idle(() => { scheduled = false; sweep(); }); } };
    if (!isMFB) document.documentElement.classList.toggle("fcf-s", isFeed());
    onReady(() => {
      sweep();
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      window.addEventListener("scroll", schedule, { passive: true });
      setInterval(sweep, isMFB ? 1000 : 1500);
    });
    onHotkey(() => f.toggleHotkey, () => toggleFB(!C.facebook.enabled));
  }

  // ── youtube ────────────────────────────────────────────────
  function toggleYT(on) {
    C.youtube.enabled = on; save("youtube");
    const s = document.getElementById("yt-css"); if (s) s.disabled = !on;
    const b = document.getElementById("yt-btn"); if (b) b.style.opacity = on ? "1" : ".3";
  }

  function initYT() {
    const y = C.youtube;
    const SEL = {
      ban: "#masthead-ad,#player-ads,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,.ytp-ad-overlay-slot,.ytp-ad-overlay-container,.ytp-ad-image-overlay",
      feed: "ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-video-renderer,ytd-promoted-sparkles-web-renderer,ytm-companion-slot-renderer,ytm-promoted-video-renderer,ytm-search-pyv-renderer,ytm-promoted-sparkles-web-renderer,ad-slot-renderer",
      wrap: "ytd-rich-item-renderer,ytd-rich-section-renderer,ytm-rich-item-renderer,ytm-item-section-renderer",
      skip: ".ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container button,.ytp-ad-skip-button-slot button",
      clos: ".ytp-ad-overlay-close-button,.ytp-ad-overlay-close-container button",
    };
    const AD_V = ["ad-showing", "ad-interrupting"], AD_S = ["ad-showing", "ad-interrupting", "ad-created"];
    const hasC = (el, cl) => !!el && cl.some((c) => el.classList.contains(c));
    const rules = [...(y.hideBanners ? [SEL.ban] : []), ...(y.hideFeedAds ? [SEL.feed, "[data-yt-h]"] : [])];
    if (rules.length) addStyle("yt-css", rules.join(",") + "{display:none!important}");
    if (!y.enabled) { const ss = document.getElementById("yt-css"); if (ss) ss.disabled = true; }
    let muted = false, lastShort = 0;
    interceptNav(() => { lastShort = 0; });

    function tick() {
      if (!y.enabled) return;
      try {
        if (y.dismissAntiAdblock) { const enf = q("ytd-enforcement-message-view-model"); if (enf) { (enf.closest("tp-yt-paper-dialog") || enf).remove(); q("tp-yt-iron-overlay-backdrop")?.remove(); document.body?.style.removeProperty("overflow"); const vi = q("video"); if (vi?.paused) vi.play().catch(() => {}); } }
        if (y.skipVideoAds) { const pl = q("#movie_player,.html5-video-player"), v = q(".html5-video-player video") || q("video"); if (hasC(pl, AD_V)) { const sk = q(SEL.skip); if (sk) sk.click(); if (v) { if (y.muteAds && !v.muted) { v.muted = true; muted = true; } if (!sk && isFinite(v.duration) && v.duration > 1) v.currentTime = v.duration - .1; } q(SEL.clos)?.click(); } else if (v && muted) { v.muted = false; muted = false; } }
        if (y.skipShortsAds && /^\/shorts/.test(location.pathname)) { const sp = q("#shorts-player"), adOn = hasC(sp, AD_S) || !!q("ytd-reel-video-renderer ad-slot-renderer,ytd-reel-video-renderer ytd-ad-slot-renderer,ytd-shorts ytd-ad-slot-renderer,ytd-shorts ad-slot-renderer"); if (adOn && Date.now() - lastShort > 700) { lastShort = Date.now(); const nx = q('#navigation-button-down button,button[aria-label="Next video"],button[aria-label="Next Short"]'); nx ? nx.click() : document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })); } }
      } catch (_) {}
    }

    function hideFeedAds() { if (!y.hideFeedAds) return; for (const ad of document.querySelectorAll(SEL.feed)) { const w = ad.closest(SEL.wrap); if (w) w.setAttribute("data-yt-h", ""); } }

    let sch = false;
    const schedule = () => { if (!sch) { sch = true; requestAnimationFrame(() => { sch = false; tick(); hideFeedAds(); }); } };
    onReady(() => { tick(); hideFeedAds(); new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); setInterval(tick, 1000); });
    onHotkey(() => y.toggleHotkey, () => toggleYT(!C.youtube.enabled));
  }

  // ── GM menu ────────────────────────────────────────────────
  function regMenu() {
    if (typeof GM_registerMenuCommand !== "function") return;
    const h = bare();
    GM_registerMenuCommand("⚙ Web Cleaner", Panel.open);
    GM_registerMenuCommand(`${C.siteBlocker.enabled ? "⛔ ON" : "✅ OFF"} toggle`, () => applyEdit("siteBlocker", () => { C.siteBlocker.enabled = !C.siteBlocker.enabled; }, "block"));
    GM_registerMenuCommand(`➕ Block ${h}`, () => applyEdit("siteBlocker", () => { if (!C.siteBlocker.custom.includes(h)) C.siteBlocker.custom.push(h); C.siteBlocker.allow = C.siteBlocker.allow.filter((d) => d !== h); }, "block"));
    GM_registerMenuCommand(`➖ Allow ${h}`, () => applyEdit("siteBlocker", () => { if (!C.siteBlocker.allow.includes(h)) C.siteBlocker.allow.push(h); C.siteBlocker.custom = C.siteBlocker.custom.filter((d) => d !== h); }, "block"));
    if (isFB) GM_registerMenuCommand(`🧹 FB ${C.facebook.enabled ? "ON" : "OFF"}`, () => toggleFB(!C.facebook.enabled));
    if (isYT) GM_registerMenuCommand(`⏭ YT ${C.youtube.enabled ? "ON" : "OFF"}`, () => toggleYT(!C.youtube.enabled));
    GM_registerMenuCommand("🖥 Desktop", () => setVM("desktop"));
    GM_registerMenuCommand("📱 Mobile", () => setVM("mobile"));
    GM_registerMenuCommand("↺ Auto", () => setVM("auto"));
  }

  // ── boot ───────────────────────────────────────────────────
  const run = (fn) => { try { fn(); } catch (_) {} };
  run(initSB);
  run(initVM);
  onReady(initCluster);
  if (isFB) run(initFB);
  if (isYT) run(initYT);
  regMenu();
})();