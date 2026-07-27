// ==UserScript==
// @name         Web Cleaner
// @namespace    https://local/webcleaner
// @version      4.0.0
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

  // ── site identity ──────────────────────────────────────────
  const HOST  = location.hostname;
  const isFB  = /^(www\.|web\.|m\.)?facebook\.com$/.test(HOST);
  const isYT  = /^(www\.|m\.)?youtube\.com$|^music\.youtube\.com$/.test(HOST);
  const isMFB = HOST === "m.facebook.com";

  // ── data ───────────────────────────────────────────────────
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
  const gmOk = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  const gGet = (k, d) => gmOk ? GM_getValue(k, d) : d;
  const gSet = (k, v) => { if (gmOk) GM_setValue(k, v); };

  function deepMerge(def, ov) {
    const r = JSON.parse(JSON.stringify(def));
    if (!ov || typeof ov !== "object") return r;
    for (const k of Object.keys(ov)) {
      if (k in r && !Array.isArray(r[k]) && typeof r[k] === "object" &&
          !Array.isArray(ov[k]) && typeof ov[k] === "object")
        r[k] = deepMerge(r[k], ov[k]);
      else r[k] = ov[k];
    }
    return r;
  }

  const C = {};
  for (const m of Object.keys(DEF)) C[m] = deepMerge(DEF[m], gGet("wc_" + m, {}));
  const save = (m) => gSet("wc_" + m, C[m]);

  // ── core helpers ───────────────────────────────────────────
  const clamp   = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const bare    = () => location.hostname.replace(/^www\./, "");
  const norm    = (s) => String(s).normalize("NFKC").toLowerCase().replace(/[^\p{L}]/gu, "");
  const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc     = (s) => String(s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
  const q       = (sel, root) => (root || document).querySelector(sel);
  const qa      = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const mk      = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs)) k === "style" ? (e.style.cssText = attrs[k]) : e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };
  const onReady = (fn) => document.body ? fn() : document.addEventListener("DOMContentLoaded", fn);

  // addStyle: deduplicates by id; works in both document and shadow root
  const addStyle = (id, css, container) => {
    const root = container || document.head || document.documentElement;
    if ((root.querySelector || root.getElementById) && root.querySelector?.("#" + id)) return;
    const s = mk("style", { id });
    s.textContent = css;
    root.appendChild(s);
  };

  const lsGet = (k) => { try { return localStorage.getItem("wc_" + k); } catch (_) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem("wc_" + k, v); } catch (_) {} };

  function cleanHost(raw) {
    try {
      const s = String(raw).trim();
      return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : "https://" + s)
        .hostname.replace(/^www\./, "").toLowerCase();
    } catch (_) {
      return String(raw).trim().replace(/^[a-z]+:\/\//i, "").replace(/[/:?#].*$/, "").replace(/^www\./, "").toLowerCase();
    }
  }

  function inject(fn, payload) {
    try {
      const s = document.createElement("script");
      s.textContent = "(" + fn + ")(" + JSON.stringify(payload).replace(/<\//g, "<\\/") + ");";
      (document.head || document.documentElement).appendChild(s);
      s.remove();
    } catch (_) {}
  }

  function onHotkey(getSpec, handler) {
    window.addEventListener("keydown", (e) => {
      if (e.metaKey) return;
      const h = getSpec();
      if (e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift) return;
      if ((e.key || "").toLowerCase() !== String(h.key || "").toLowerCase()) return;
      const t = e.target;
      if (t?.isContentEditable || /^(input|textarea|select)$/i.test(t?.tagName || "")) return;
      e.preventDefault();
      handler();
    }, true);
  }

  // ── SPA navigation detection ───────────────────────────────
  // Intercepts history.pushState/replaceState and fires a custom "wcnav" event.
  // Both Facebook and YouTube use pushState for SPA routing.
  function interceptNav(callback) {
    const wrap = (orig) => function (...args) {
      const result = orig.apply(this, args);
      callback();
      return result;
    };
    history.pushState    = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener("popstate", callback);
  }

  // ── draggable floating button ──────────────────────────────
  const BTNCSS = "position:fixed;z-index:2147483647;width:44px;height:44px;border-radius:50%;" +
    "border:none;cursor:pointer;font-size:20px;line-height:44px;padding:0;text-align:center;" +
    "box-shadow:0 2px 12px rgba(0,0,0,.4);touch-action:none;-webkit-touch-callout:none;" +
    "-webkit-user-select:none;user-select:none;transition:transform .1s,opacity .2s";

  function floatBtn(id, icon, extraStyle, storeKey, onTap, onLong, longMs = 500) {
    if (!document.body || document.getElementById(id)) return null;
    const b = mk("button", { id, "aria-label": id, style: BTNCSS + ";" + (extraStyle || "") }, icon);

    const saved = (() => { try { return JSON.parse(lsGet("btn_" + storeKey) || "null"); } catch (_) { return null; } })();
    if (saved?.l != null) {
      b.style.left   = clamp(saved.l, 0, innerWidth  - 44) + "px";
      b.style.top    = clamp(saved.t, 0, innerHeight - 44) + "px";
      b.style.right  = b.style.bottom = "auto";
    }

    let pr = null;
    const start = (cx, cy) => {
      b.style.transform = "scale(.88)";
      pr = { sx: cx, sy: cy, moved: false, long: false, timer: null };
      if (onLong) pr.timer = setTimeout(() => { if (pr && !pr.moved) { pr.long = true; b.style.transform = ""; onLong(); } }, longMs);
    };
    const move = (cx, cy) => {
      if (!pr) return;
      if (!pr.moved && Math.hypot(cx - pr.sx, cy - pr.sy) > 8) { pr.moved = true; clearTimeout(pr.timer); }
      if (pr.moved) {
        b.style.left   = clamp(cx - 22, 0, innerWidth  - 44) + "px";
        b.style.top    = clamp(cy - 22, 0, innerHeight - 44) + "px";
        b.style.right  = b.style.bottom = "auto";
      }
    };
    const end = () => {
      b.style.transform = "";
      if (!pr) return;
      clearTimeout(pr.timer);
      const p = pr; pr = null;
      if (p.long) return;
      if (p.moved) { lsSet("btn_" + storeKey, JSON.stringify({ l: parseInt(b.style.left), t: parseInt(b.style.top) })); return; }
      onTap();
    };
    const cancel = () => { if (pr) { clearTimeout(pr.timer); pr = null; } b.style.transform = ""; };

    b.addEventListener("pointerdown",  (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} start(e.clientX, e.clientY); });
    b.addEventListener("pointermove",  (e) => move(e.clientX, e.clientY));
    b.addEventListener("pointerup",    (e) => { try { b.releasePointerCapture(e.pointerId); } catch (_) {} end(); });
    b.addEventListener("pointercancel", cancel);

    document.body.appendChild(b);
    return b;
  }

  // ── panel-open FAB (always visible, essential on iOS) ──────
  function initPanelFAB() {
    onReady(() => {
      const b = floatBtn("wc-fab", "🧼", "background:#1a1a2e;color:#fff;opacity:.7;left:10px;top:120px", "fab", Panel.open);
      if (b) {
        b.addEventListener("mouseenter", () => { b.style.opacity = "1"; });
        b.addEventListener("mouseleave", () => { b.style.opacity = ".7"; });
      }
    });
  }

  // ── site blocker helpers ───────────────────────────────────
  const sbMatch   = (list) => { const h = bare(); return list.some((d) => h === d || h.endsWith("." + d)); };
  const sbSnoozed = () => Date.now() < gGet("wc_snz", 0);
  const sbSnooze  = (m) => gSet("wc_snz", Date.now() + m * 60000);

  function sbInSchedule() {
    const { scheduleOn, schedule: sc } = C.siteBlocker;
    if (!scheduleOn || !sc.days.includes(new Date().getDay())) return false;
    const now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    const [fh, fm] = sc.from.split(":").map(Number);
    const [th, tm] = sc.to.split(":").map(Number);
    const from = fh * 60 + fm, to = th * 60 + tm;
    return from <= to ? (cur >= from && cur < to) : (cur >= from || cur < to);
  }

  function blockReason() {
    const s = C.siteBlocker;
    if (!s.enabled || sbSnoozed()) return null;
    if (sbMatch(s.allow))  return null;
    if (sbMatch(s.custom)) return "on your block list";
    if (s.blockAdult && (sbMatch(ADULT) || ADULT_RE.test(bare()))) return "blocked by adult filter";
    if ((s.blockFocus || sbInSchedule()) && sbMatch(FOCUS))
      return s.blockFocus ? "blocked by focus filter" : "blocked during focus hours";
    return null;
  }

  function applyEdit(mod, mutate, affects) {
    const before = affects === "block" ? !!blockReason() : null;
    mutate();
    save(mod);
    const reload = affects === "block" ? (before !== !!blockReason()) : !!affects;
    reload ? location.reload() : Panel.refresh();
  }

  // ── view mode ──────────────────────────────────────────────
  const vmStored = lsGet("vm") || "";
  const vmMode   = vmStored || C.viewMode.newSiteDefault;
  const vmActive = () => vmMode !== "auto";
  const setVM    = (m) => { lsSet("vm", m); location.reload(); };

  // ── panel HTML builders ────────────────────────────────────
  const keyLabel = (h) => (h.ctrl ? "Ctrl+" : "") + (h.alt ? "Alt+" : "") + (h.shift ? "Shift+" : "") + String(h.key || "").toUpperCase();

  const swRow  = (label, mod, key) =>
    `<div class="r"><span>${esc(label)}</span><label class="sw"><input type="checkbox" data-sw="${mod}.${key}"${C[mod][key] ? " checked" : ""}><span class="tk"></span></label></div>`;
  const numRow = (label, mod, key) =>
    `<div class="r"><span>${esc(label)}</span><input class="nm" type="number" data-num="${mod}.${key}" value="${esc(C[mod][key])}"></div>`;
  const txtRow = (label, mod, key) =>
    `<div class="fr"><span>${esc(label)}</span><input class="tx" type="text" data-txt="${mod}.${key}" value="${esc(C[mod][key])}"></div>`;
  const timeRow = (label, mod, key) =>
    `<div class="r"><span>${esc(label)}</span><input class="tm" type="time" data-time="${mod}.${key}" value="${esc(C[mod].schedule[key])}"></div>`;
  const hkRow  = (mod) =>
    `<div class="r"><span>Shortcut</span><button class="hk" data-hk="${mod}">${esc(keyLabel(C[mod].toggleHotkey))}</button></div>`;
  const swRows = (mod, pairs) => pairs.map(([label, key]) => swRow(label, mod, key)).join("");

  function listBlock(label, mod, key, ph) {
    const arr = C[mod][key], path = `${mod}.${key}`;
    const items = arr.length
      ? arr.map((d) => `<div class="it"><span title="${esc(d)}">${esc(d)}</span><button class="dl" data-dl="${path}" data-v="${esc(d)}">Remove</button></div>`).join("")
      : `<div class="em">None yet.</div>`;
    return `<div class="sc"><h2>${esc(label)}</h2>${items}<div class="ad"><input type="text" data-ai="${path}" placeholder="${esc(ph)}"><button data-ab="${path}">Add</button></div></div>`;
  }

  function packHtml(sites) {
    return sites.map((d) => {
      const on = C.siteBlocker.allow.includes(d);
      return `<div class="it"><span>${esc(d)}</span><button class="pl ${on ? "al" : "bl"}" data-pk="${esc(d)}">${on ? "Allowed" : "Blocked"}</button></div>`;
    }).join("");
  }

  // ── panel sections ─────────────────────────────────────────
  const secFB = () => `<details data-s=facebook>
    <summary>🧹 Facebook ${C.facebook.enabled ? "ON" : "OFF"}</summary>
    ${swRows("facebook", [
      ["Enabled","enabled"],["Hide Sponsored","hideSponsored"],["Hide Suggested","hideSuggested"],
      ["Hide People You May Know","hidePeopleYouMayKnow"],["Hide Reels / Stories","hideReelsTrays"],
      ["Hide right sidebar","hideRightSidebar"],["Hide left sidebar","hideLeftSidebar"],
      ["Hide composer","hideComposer"],["Hide top bar","hideTopBar"],
      ["Strip tracking","stripTracking"],["Skip Reel ads","skipReelsAds"],
      ["Force Most Recent","forceMostRecent"],["Show button","showToggleButton"],
    ])}
    ${listBlock("Extra junk phrases","facebook","extraJunkPhrases","phrase")}
    <details data-s=fb-adv><summary>Advanced</summary>${hkRow("facebook")}</details>
  </details>`;

  const secYT = () => `<details data-s=youtube>
    <summary>⏭ YouTube ${C.youtube.enabled ? "ON" : "OFF"}</summary>
    ${swRows("youtube", [
      ["Enabled","enabled"],["Skip video ads","skipVideoAds"],["Skip Shorts ads","skipShortsAds"],
      ["Hide feed ads","hideFeedAds"],["Hide banners","hideBanners"],
      ["Mute ads","muteAds"],["Dismiss anti-adblock","dismissAntiAdblock"],["Show button","showToggleButton"],
    ])}
    <details data-s=yt-adv><summary>Advanced</summary>${hkRow("youtube")}</details>
  </details>`;

  const secSB = () => {
    const s = C.siteBlocker;
    return `<details data-s=sb open>
      <summary>⛔ Site Blocker ${s.enabled ? "ON" : "OFF"}</summary>
      <div class="r"><div>Blocking<div class="cu">${esc(HOST)}</div></div>
        <label class="sw"><input type="checkbox" data-sw="siteBlocker.enabled"${s.enabled ? " checked" : ""}><span class="tk"></span></label></div>
      ${swRow("Adult filter","siteBlocker","blockAdult")}
      ${swRow("Focus mode","siteBlocker","blockFocus")}
      ${swRow(`Schedule (${esc(s.schedule.from)}–${esc(s.schedule.to)})`, "siteBlocker", "scheduleOn")}
      ${sbSnoozed() ? `<div class="cu">⏱ Snoozed</div>` : ""}
      ${listBlock("Blocked sites","siteBlocker","custom","example.com")}
      ${listBlock("Allowed","siteBlocker","allow","example.com")}
      <div class="sc"><h2>Packs</h2>
        <details data-s=focus><summary>Focus (${FOCUS.length})</summary>${packHtml(FOCUS)}</details>
        <details data-s=adult><summary>Adult (${ADULT.length})</summary>${packHtml(ADULT)}</details>
      </div>
      <details data-s=sb-adv><summary>Advanced</summary>
        ${timeRow("From","siteBlocker","from")}${timeRow("To","siteBlocker","to")}
        ${numRow("Snooze min","siteBlocker","snoozeMinutes")}${hkRow("siteBlocker")}
      </details>
    </details>`;
  };

  const secVM = () => {
    const v = C.viewMode, modes = ["desktop", "mobile", "auto"];
    const seg = (val, attr) => {
      const cur = attr === "data-vm" ? vmMode : v.newSiteDefault;
      return `<button class="${cur === val ? "on" : ""}" ${attr}="${val}">${val[0].toUpperCase() + val.slice(1)}</button>`;
    };
    return `<details data-s=vm>
      <summary>🖥 View Mode ${vmMode.toUpperCase()}</summary>
      <div class="r"><span>This site</span><div class="sg">${modes.map((m) => seg(m, "data-vm")).join("")}</div></div>
      <div class="r"><span>Default</span><div class="sg">${modes.map((m) => seg(m, "data-df")).join("")}</div></div>
      ${swRows("viewMode", [
        ["Spoof UA","spoofUA"],["Spoof touch","spoofTouch"],["Spoof matchMedia","spoofMedia"],
        ["Phone frame","frameOnDesktop"],["Show button","showButton"],
      ])}
      <details data-s=vm-adv><summary>Advanced</summary>
        ${[["Desktop width","desktopWidth"],["Mobile width","mobileWidth"],["Mobile height","mobileHeight"],
           ["Mobile DPR","mobileDpr"],["Long-press ms","longPressMs"]].map(([l, k]) => numRow(l, "viewMode", k)).join("")}
        ${txtRow("Mobile UA","viewMode","mobileUA")}${txtRow("Desktop UA","viewMode","desktopUA")}
        ${hkRow("viewMode")}
      </details>
    </details>`;
  };

  // ── panel CSS ──────────────────────────────────────────────
  const PCSS = `
    :host{all:initial}
    *{box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    .bk{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:2147483646;-webkit-tap-highlight-color:transparent}
    .cd{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
        width:min(480px,calc(100vw - 24px));max-height:min(88vh,860px);
        overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;
        background:#17181b;color:#e9e9ea;border-radius:18px;padding:20px;
        box-shadow:0 16px 56px rgba(0,0,0,.7);z-index:2147483647;font-size:14px;line-height:1.45}
    .hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
    .hd h1{font-size:17px;font-weight:700;margin:0}
    .x{background:none;border:0;color:#9a9aa0;font-size:26px;cursor:pointer;line-height:1;padding:4px 6px;-webkit-appearance:none;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center}
    .r{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid #26272c;min-height:44px}
    .fr{display:flex;flex-direction:column;gap:6px;padding:10px 0;border-top:1px solid #26272c}
    .cu{font-size:12px;color:#8a8a90;margin-top:3px}
    .sc{margin-top:14px}
    .sc>h2{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#8a8a90;margin:0 0 2px}
    .it{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 0;border-top:1px solid #26272c;min-height:44px}
    .it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dl{background:#2b2b30;border:0;color:#ff8a8a;border-radius:10px;cursor:pointer;padding:6px 12px;font-size:13px;flex:0 0 auto;-webkit-appearance:none;min-height:36px}
    .ad{display:flex;gap:8px;margin-top:8px}
    .ad input{flex:1;min-width:0;background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:10px;padding:10px 12px;font-size:14px;-webkit-appearance:none;min-height:44px}
    .ad button{background:#3a7afe;border:0;color:#fff;border-radius:10px;cursor:pointer;padding:10px 16px;font-size:14px;flex:0 0 auto;-webkit-appearance:none;min-height:44px}
    .em{color:#6a6a70;font-style:italic;padding:8px 0;border-top:1px solid #26272c}
    .sw{position:relative;display:inline-block;width:51px;height:31px;flex:0 0 auto}
    .sw input{opacity:0;width:0;height:0;position:absolute}
    .tk{position:absolute;inset:0;background:#3a3b42;border-radius:999px;transition:.18s;cursor:pointer}
    .tk::before{content:"";position:absolute;width:27px;height:27px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.18s;box-shadow:0 1px 4px rgba(0,0,0,.3)}
    .sw input:checked+.tk{background:#2ecc71}
    .sw input:checked+.tk::before{transform:translateX(20px)}
    details{margin-top:6px}
    summary{cursor:pointer;padding:10px 0;color:#c9c9cf;border-top:1px solid #26272c;
            list-style:none;user-select:none;font-weight:600;min-height:44px;
            display:flex;align-items:center}
    summary::-webkit-details-marker{display:none}
    .pl{border:0;border-radius:10px;cursor:pointer;padding:6px 14px;font-size:12px;flex:0 0 auto;-webkit-appearance:none;min-height:36px}
    .bl{background:#3a2b2b;color:#ff9a9a}.al{background:#243024;color:#9be79b}
    .nm{width:100px;background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:10px;padding:8px 10px;font-size:13px;text-align:right;-webkit-appearance:none;min-height:40px}
    .tm{background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:10px;padding:8px 10px;font-size:13px;-webkit-appearance:none;min-height:40px}
    .tx{background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:10px;padding:10px 12px;font-size:13px;width:100%;-webkit-appearance:none;min-height:40px}
    .hk{background:#2b2b30;border:0;color:#e9e9ea;border-radius:10px;cursor:pointer;padding:8px 14px;font-size:13px;-webkit-appearance:none;min-height:40px}
    .hk.arm{background:#3a7afe;color:#fff}
    .sg{display:flex;gap:6px}
    .sg button{flex:1;background:#2b2b30;border:0;color:#c9c9cf;border-radius:10px;cursor:pointer;padding:8px 0;font-size:13px;-webkit-appearance:none;min-height:40px}
    .sg button.on{background:#3a7afe;color:#fff}
  `.replace(/\n\s*/g, "");

  // ── panel ──────────────────────────────────────────────────
  const Panel = (() => {
    let root = null, capFn = null, armed = null;

    const affects = (m) =>
      m === "siteBlocker" ? "block" :
      m === "facebook"    ? isFB   :
      m === "youtube"     ? isYT   :
      m === "viewMode"    ? vmActive() : false;

    const edit    = (m, fn) => { armed = null; applyEdit(m, fn, affects(m)); };
    const onEsc   = (e) => { if (!armed && e.key === "Escape") { e.preventDefault(); close(); } };

    function render() {
      const sh = root.shadowRoot;
      const openMap = {};
      qa("details[data-s]", sh).forEach((d) => { openMap[d.getAttribute("data-s")] = d.open; });
      sh.innerHTML = `<style>${PCSS}</style>
        <div class="bk" data-x></div>
        <div class="cd" role="dialog" aria-modal="true" aria-label="Web Cleaner settings">
          <div class="hd"><h1>🧼 Web Cleaner</h1><button class="x" data-x aria-label="Close">×</button></div>
          ${secSB()}${secVM()}${isFB ? secFB() : ""}${isYT ? secYT() : ""}
        </div>`;
      qa("details[data-s]", sh).forEach((d) => { if (openMap[d.getAttribute("data-s")]) d.open = true; });
      wire(sh);
    }

    function wire(sh) {
      // close
      qa("[data-x]", sh).forEach((e) => e.addEventListener("click", close));

      // toggles
      qa("[data-sw]", sh).forEach((e) => e.addEventListener("change", () => {
        const [m, k] = e.getAttribute("data-sw").split(".");
        if (m === "facebook" && k === "enabled") { toggleFB(e.checked); render(); return; }
        if (m === "youtube"  && k === "enabled") { toggleYT(e.checked); render(); return; }
        edit(m, () => { C[m][k] = e.checked; });
      }));

      // numbers
      qa("[data-num]", sh).forEach((e) => e.addEventListener("change", () => {
        const [m, k] = e.getAttribute("data-num").split(".");
        let v = parseFloat(e.value);
        if (!isFinite(v) || v <= 0) { render(); return; }
        if (BOUNDS[k]) v = clamp(v, BOUNDS[k][0], BOUNDS[k][1]);
        edit(m, () => { C[m][k] = v; });
      }));

      // text
      qa("[data-txt]", sh).forEach((e) => e.addEventListener("change", () => {
        const [m, k] = e.getAttribute("data-txt").split(".");
        const v = e.value.trim(); if (!v) { render(); return; }
        edit(m, () => { C[m][k] = v; });
      }));

      // time
      qa("[data-time]", sh).forEach((e) => e.addEventListener("change", () => {
        const k = e.getAttribute("data-time").split(".")[1];
        if (!/^\d{2}:\d{2}$/.test(e.value)) { render(); return; }
        edit("siteBlocker", () => { C.siteBlocker.schedule[k] = e.value; });
      }));

      // list remove
      qa("[data-dl]", sh).forEach((e) => e.addEventListener("click", () => {
        const [m, k] = e.getAttribute("data-dl").split(".");
        const v = e.getAttribute("data-v");
        edit(m, () => { C[m][k] = C[m][k].filter((d) => d !== v); });
      }));

      // list add — fire on both click and Enter/Done on iOS keyboard
      qa("[data-ab]", sh).forEach((btn) => {
        const path = btn.getAttribute("data-ab"), [m, k] = path.split(".");
        const inp = sh.querySelector(`[data-ai="${path}"]`);
        const go = () => {
          const v = m === "facebook" ? inp.value.trim().toLowerCase() : cleanHost(inp.value);
          if (!v) return;
          edit(m, () => {
            if (!C[m][k].includes(v)) C[m][k].push(v);
            if (m === "siteBlocker") {
              if (k === "custom") C.siteBlocker.allow  = C.siteBlocker.allow.filter((d) => d !== v);
              if (k === "allow")  C.siteBlocker.custom = C.siteBlocker.custom.filter((d) => d !== v);
            }
          });
        };
        btn.addEventListener("click", go);
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
        inp.addEventListener("keyup",   (e) => { if (e.key === "Enter") go(); }); // iOS fallback
      });

      // pack toggles
      qa("[data-pk]", sh).forEach((b) => b.addEventListener("click", () => {
        const v = b.getAttribute("data-pk");
        edit("siteBlocker", () => {
          const a = C.siteBlocker.allow;
          C.siteBlocker.allow = a.includes(v) ? a.filter((d) => d !== v) : [...a, v];
        });
      }));

      // view mode this site
      qa("[data-vm]", sh).forEach((b) => b.addEventListener("click", () => setVM(b.getAttribute("data-vm"))));

      // view mode default
      qa("[data-df]", sh).forEach((b) => b.addEventListener("click", () => {
        edit("viewMode", () => { C.viewMode.newSiteDefault = b.getAttribute("data-df"); });
      }));

      // hotkeys
      qa("[data-hk]", sh).forEach((b) => b.addEventListener("click", () => {
        const m = b.getAttribute("data-hk");
        armed = m; b.textContent = "Press keys…"; b.classList.add("arm");
        if (capFn) { window.removeEventListener("keydown", capFn, true); capFn = null; }
        capFn = (e) => {
          e.preventDefault(); e.stopPropagation();
          if (["Shift","Control","Alt","Meta"].includes(e.key)) return;
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
      root = mk("div", { id: "wc-panel", style: "all:initial" });
      root.attachShadow({ mode: "open" });
      document.body.appendChild(root);
      render();
      document.addEventListener("keydown", onEsc, true);
    }

    function close() {
      if (capFn) { window.removeEventListener("keydown", capFn, true); capFn = null; }
      armed = null;
      root?.remove(); root = null;
      document.removeEventListener("keydown", onEsc, true);
    }

    return { open, close, refresh: () => { if (root?.shadowRoot) render(); } };
  })();

  // ── site blocker ───────────────────────────────────────────
  function initSB() {
    function showBlock(why) {
      try { window.stop(); } catch (_) {}
      document.documentElement.innerHTML =
        `<head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">
         <title>Blocked</title></head><body></body>`;
      const b = document.body; b.id = "wc-blk";
      Object.assign(b.style, {
        margin: "0", minHeight: "100dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "16px",
        textAlign: "center", padding: "32px 24px",
        fontFamily: "-apple-system,system-ui,sans-serif", background: "#0b0b0c", color: "#e9e9ea",
      });
      const btn = (text, style) => {
        const el = mk("button", { style: `padding:14px 22px;border:0;border-radius:14px;cursor:pointer;font-size:16px;min-height:50px;-webkit-appearance:none;${style}` }, text);
        return el;
      };
      const ab = btn(`Allow for ${C.siteBlocker.snoozeMinutes} min`, "background:#2b2b30;color:#e9e9ea;margin-top:8px");
      ab.onclick = () => { sbSnooze(C.siteBlocker.snoozeMinutes); location.reload(); };
      const mb = btn("⚙ Manage", "background:#1c1c20;color:#9a9aa0");
      mb.onclick = Panel.open;
      b.append(
        mk("div", { style: "font-size:64px;line-height:1" }, "⛔"),
        mk("div", { style: "font-size:24px;font-weight:700" }, "Blocked"),
        mk("div", { style: "opacity:.6;max-width:28rem;line-height:1.5" }, `${bare()} – ${why}.`),
        ab, mb,
      );
    }
    const check = () => { const w = blockReason(); if (w && !document.getElementById("wc-blk")) showBlock(w); };
    check();
    setInterval(check, 5000);
    onHotkey(() => C.siteBlocker.toggleHotkey, () => applyEdit("siteBlocker", () => { C.siteBlocker.enabled = !C.siteBlocker.enabled; }, "block"));
  }

  // ── view mode (page-context spoof) ────────────────────────
  function vmSpoof(p) {
    const def = (obj, k, get) => { try { Object.defineProperty(obj, k, { configurable: true, get }); } catch (_) {} };
    const { toMobile: tm, useFrame, cfg: c } = p;

    if (c.spoofUA) {
      const ua = tm ? c.mobileUA : c.desktopUA;
      def(navigator, "userAgent",  () => ua);
      def(navigator, "appVersion", () => ua.replace(/^Mozilla\//, ""));
      def(navigator, "platform",   () => tm ? "Linux armv8l" : "Win32");
      def(navigator, "vendor",     () => "Google Inc.");
      try {
        const br = navigator.userAgentData?.brands ?? [];
        def(navigator, "userAgentData", () => ({
          mobile: tm, platform: tm ? "Android" : "Windows", brands: br,
          getHighEntropyValues: () => Promise.resolve({ mobile: tm, platform: tm ? "Android" : "Windows" }),
          toJSON: () => ({ mobile: tm, platform: tm ? "Android" : "Windows", brands: br }),
        }));
      } catch (_) {}
    }

    if (c.spoofTouch) {
      def(navigator, "maxTouchPoints", () => tm ? 5 : 0);
      try { if (tm && !("ontouchstart" in window)) window.ontouchstart = null; } catch (_) {}
    }

    if (c.spoofMedia) {
      const emuW = tm ? c.mobileWidth : c.desktopWidth;
      const nat  = window.matchMedia?.bind(window) ?? null;
      window.matchMedia = (query) => {
        const s = String(query).toLowerCase(); let r = null;
        const f = (v) => { if (r !== false) r = v; }; let m;
        if ((m = s.match(/min-width:\s*([\d.]+)px/))) f(emuW >= parseFloat(m[1]));
        if ((m = s.match(/max-width:\s*([\d.]+)px/))) f(emuW <= parseFloat(m[1]));
        if (s.includes("pointer: coarse") || s.includes("any-pointer: coarse")) f(tm);
        if (s.includes("pointer: fine")   || s.includes("any-pointer: fine"))   f(!tm);
        if (s.includes("hover: none"))  f(tm);
        if (s.includes("hover: hover")) f(!tm);
        if (r === null && nat) return nat(query);
        return { matches: !!r, media: String(query), onchange: null,
          addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } };
      };
      if (useFrame) {
        def(window, "innerWidth",       () => c.mobileWidth);
        def(window, "innerHeight",      () => c.mobileHeight);
        def(screen, "width",            () => c.mobileWidth);
        def(screen, "height",           () => c.mobileHeight);
        def(screen, "availWidth",       () => c.mobileWidth);
        def(screen, "availHeight",      () => c.mobileHeight);
        def(window, "devicePixelRatio", () => c.mobileDpr);
      }
    }
  }

  function initVM() {
    const v = C.viewMode;
    const uad = navigator.userAgentData;
    const realMobile =
      /Mobi|Android|iPhone|iPod|Windows Phone/i.test(navigator.userAgent) ||
      /iPad/.test(navigator.userAgent) ||
      (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ||
      (uad?.mobile === true);
    const toMobile = vmMode === "mobile";
    const useFrame = toMobile && !realMobile && v.frameOnDesktop;

    if (vmMode !== "auto") {
      inject(vmSpoof, {
        toMobile, useFrame,
        cfg: { spoofUA: v.spoofUA, spoofTouch: v.spoofTouch, spoofMedia: v.spoofMedia,
               mobileUA: v.mobileUA, desktopUA: v.desktopUA,
               mobileWidth: v.mobileWidth, desktopWidth: v.desktopWidth,
               mobileHeight: v.mobileHeight, mobileDpr: v.mobileDpr },
      });
    }

    // Viewport meta — guarded against sites re-adding their own via MutationObserver
    let vpLocked = false;
    function applyVP() {
      if (vmMode === "auto") return;
      vpLocked = true;
      qa('meta[name="viewport"]').forEach((e) => { if (!e.hasAttribute("data-wc")) e.remove(); });
      let m = q('meta[name="viewport"][data-wc]');
      if (!m) { m = mk("meta", { name: "viewport", "data-wc": "1" }); (document.head || document.documentElement).appendChild(m); }
      m.setAttribute("content", vmMode === "desktop"
        ? `width=${v.desktopWidth}`
        : "width=device-width,initial-scale=1,viewport-fit=cover");
      vpLocked = false;
    }

    function applyFrame() {
      if (!useFrame) return;
      addStyle("vm-frame",
        `html.vm-f{background:#202124!important;overflow-x:hidden!important}` +
        `html.vm-f>body{width:${v.mobileWidth}px!important;min-width:${v.mobileWidth}px!important;` +
          `max-width:${v.mobileWidth}px!important;margin:0 auto!important;min-height:100vh!important;` +
          `overflow-x:hidden!important;box-shadow:0 0 0 100vmax #202124,0 0 40px rgba(0,0,0,.6)!important}`);
      document.documentElement.classList.add("vm-f");
    }

    applyVP();
    if (vmMode !== "auto") {
      // Defend viewport meta against site re-injection
      new MutationObserver(() => { if (!vpLocked) applyVP(); })
        .observe(document.head || document.documentElement, { childList: true, subtree: true });
      document.addEventListener("DOMContentLoaded", () => { applyVP(); applyFrame(); });
      [200, 600, 1500, 3500].forEach((t) => setTimeout(() => { applyVP(); applyFrame(); }, t));
    }

    const toggle = () => setVM(vmMode === "desktop" ? "mobile" : "desktop");
    onReady(() => {
      if (v.showButton) {
        const icon = vmMode === "desktop" ? "🖥" : vmMode === "mobile" ? "📱" : "🔄";
        const b = floatBtn("vm-btn", icon,
          "background:rgba(20,20,30,.75);color:#fff;opacity:.65;right:10px;bottom:calc(72px + env(safe-area-inset-bottom))",
          "vm", toggle, () => setVM("auto"), v.longPressMs);
        if (b) {
          b.addEventListener("mouseenter", () => { b.style.opacity = "1"; });
          b.addEventListener("mouseleave", () => { b.style.opacity = ".65"; });
        }
      }
    });
    onHotkey(() => v.toggleHotkey, toggle);
  }

  // ── facebook ───────────────────────────────────────────────
  function toggleFB(on) {
    C.facebook.enabled = on; save("facebook");
    document.documentElement.classList.toggle("fcf-off", !on);
    const b = document.getElementById("fcf-btn"); if (b) b.style.opacity = on ? "1" : ".35";
  }

  function initFB() {
    const f = C.facebook;
    if (!f.enabled) document.documentElement.classList.add("fcf-off");

    if (!isMFB && f.forceMostRecent) {
      const pp = location.pathname;
      if ((pp === "/" || pp === "/home.php") && !/[?&]sk=/.test(location.search)) {
        location.replace(location.origin + "/?sk=h_chr"); return;
      }
    }

    const SPON = "sponsored paidpartnership publicidad patrocinado sponsoris commandit gesponsert sponsorizzat gesponsord bersponsor sponsorlu sponsorowan sponsrad sponset sponsoreret ممول ממומן реклама 広告 광고 赞助 贊助 χορηγούμενη".split(" ").map(norm);
    const MARKS = [
      ...(f.hideSponsored        ? SPON : []),
      ...(f.hideSuggested        ? ["suggestedforyou","suggestedpost","pagesforyou","pagesyoumaylike","groupsyoumaylike"] : []),
      ...(f.hidePeopleYouMayKnow ? ["peopleyoumayknow"] : []),
      ...f.extraJunkPhrases.map(norm),
    ];
    const EXACT = f.hideReelsTrays ? ["reels","reelsandshortvideos","stories"] : [];
    const STRIP = /[\u200b-\u200f\u202a-\u202e\ufeff\u00ad\u2060]/g;

    // inject CSS once
    (() => {
      const R = ["html:not(.fcf-off) [data-fcf]{display:none!important}"];
      if (!isMFB) {
        const X = "html.fcf-s:not(.fcf-off) ";
        if (f.hideRightSidebar) R.push(`${X}[role="complementary"]{display:none!important}`);
        if (f.hideLeftSidebar)  R.push(`${X}[role="navigation"][aria-label="Shortcuts"]{display:none!important}`,
                                        `html:not(.fcf-off) [data-fcf-ln]{display:none!important}`);
        if (f.hideComposer)     R.push(`${X}[role="region"][aria-label="Create a post"]{display:none!important}`);
        if (f.hideTopBar)       R.push(`${X}[role="banner"],${X}[role="navigation"][aria-label="Facebook"],${X}[role="navigation"][aria-label="Account Controls and Settings"]{display:none!important}`);
        if (f.hideReelsTrays)   R.push(`${X}[aria-label="Stories"],${X}[aria-label="Reels"]{display:none!important}`);
        R.push(`${X}[role="main"]{margin-left:auto!important;margin-right:auto!important}`);
        if (f.hideTopBar) R.push(`${X}body{padding-top:0!important}`);
      }
      addStyle("fcf-css", R.join("\n"));
    })();

    // text extraction with parent-rect pre-filter to reduce layout work
    function readText(scope, bt, bb) {
      const g = []; let budget = 600;
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
      let n;
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

    // SPA nav via interceptNav (pushState/replaceState/popstate)
    let _feed = null, _skipEl = null, _skipN = 0;
    const resetNav = () => { _feed = null; _skipEl = null; _skipN = 0; };
    interceptNav(resetNav);

    function feedBox() {
      if (_feed?.isConnected) return _feed;
      const main = q('[role="main"]'); if (!main) return null;
      let best = null, bn = 1;
      for (const d of main.querySelectorAll("div")) {
        let n = 0;
        for (const c of d.children) {
          const r = c.getBoundingClientRect();
          if (r.width >= 500 && r.width <= 720 && r.height > 60) n++;
        }
        if (n > bn) { bn = n; best = d; }
      }
      return (_feed = best);
    }

    function processDesktop() {
      const fd = feedBox(); if (!fd) return;
      const vh = innerHeight;
      for (const st of fd.children) {
        if (st._wc === "h" || st._wc === "c") continue;
        const r = st.getBoundingClientRect();
        if (r.height < 60 || r.bottom < -500 || r.top > vh + 500) continue;
        const hdr = readText(st, r.top - 2, r.top + 130); if (!hdr) continue;
        if (isJunk(norm(hdr)) || (f.hideReelsTrays && st.querySelectorAll('a[href*="/reel/"]').length > 3)) {
          st.setAttribute("data-fcf", ""); st._wc = "h";
        } else if ((st._wcN = (st._wcN || 0) + 1) >= 4) { st._wc = "c"; }
      }
    }

    function processMobile() {
      for (const p of document.querySelectorAll("[data-tracking-duration-id]")) {
        if (p._wc) continue;
        let junk = false;
        for (const e of p.querySelectorAll('span,a[role="link"],h3,h4,div[role="heading"]')) {
          if (junk) break;
          const raw = (e.textContent || "").trim(); if (!raw || raw.length > 40) continue;
          const t = norm(raw); if (!t) continue;
          if (MARKS.some((m) => t === m || t.startsWith(m)) || EXACT.includes(t)) junk = true;
        }
        if (junk) { p.setAttribute("data-fcf", ""); p._wc = "h"; }
        else if ((p._wcN = (p._wcN || 0) + 1) >= 4) p._wc = "c";
      }
    }

    function hideLeftNav() {
      if (!f.hideLeftSidebar) return;
      for (const n of document.querySelectorAll('[role="navigation"]:not([data-fcf-ln])')) {
        const r = n.getBoundingClientRect();
        if (r.height > 350 && r.width >= 120 && r.width <= 460 && r.left <= 24) n.setAttribute("data-fcf-ln", "");
      }
    }

    // reel ad skip — keyed on video element identity (not URL)
    const _reelSt = new WeakMap(); let _skipT = 0;

    function handleReels() {
      if (!f.skipReelsAds || !/^\/reels?(\/|$)/.test(location.pathname)) return;
      const cy = innerHeight / 2; let act = null, best = 1e9;
      for (const v of document.querySelectorAll("video")) {
        const r = v.getBoundingClientRect(); if (r.height < 200) continue;
        const d = Math.abs((r.top + r.bottom) / 2 - cy); if (d < best) { best = d; act = v; }
      }
      if (!act) return;
      let rl = act;
      for (let i = 0; i < 12 && rl.parentElement; i++) {
        rl = rl.parentElement;
        if (rl.querySelector('[aria-label="Like"],[aria-label^="Comment"],[role="button"][aria-label="Next Card"]')) break;
      }
      if (!reelSpon(rl, act)) { if (act !== _skipEl) { _skipEl = null; _skipN = 0; } return; }
      if (act !== _skipEl)    { _skipEl = act; _skipN = 0; }
      if (Date.now() - _skipT < 600 || _skipN >= 8) return;
      _skipN++; _skipT = Date.now();
      const nx = q('[role="button"][aria-label="Next Card"]');
      if (nx) { nx.click(); return; }
      const tg = rl.closest("[tabindex]") || rl;
      for (const tp of ["keydown","keyup"])
        tg.dispatchEvent(new KeyboardEvent(tp, { key:"ArrowDown", code:"ArrowDown", keyCode:40, which:40, bubbles:true }));
    }

    function reelSpon(rl, key) {
      let st = _reelSt.get(key);
      if (!st) _reelSt.set(key, (st = { s: false, n: 0 }));
      if (st.s) return true; if (st.n >= 8) return false; st.n++;
      const r = rl.getBoundingClientRect(), c = norm(readText(rl, r.top - 2, r.bottom + 2));
      if (SPON.some((m) => c.includes(m))) st.s = true;
      return st.s;
    }

    // tracking cleanup
    const TKEYS = new Set("fbclid gclid dclid gbraid wbraid msclkid yclid twclid igshid mc_eid mc_cid _openstat vero_id oly_enc_id oly_anon_id wickedid _hsenc _hsmi mkt_tok ref refsrc refid fref hc_ref hc_location ref_src ref_url eav paipv comment_tracking av rdid".split(" "));
    const SHIMS = new Set(["l.facebook.com","lm.facebook.com","l.messenger.com"]);
    const isTK  = (k) => TKEYS.has(k) || k.startsWith("utm_") || k.startsWith("__");

    function cleanUrl(href) {
      let u; try { u = new URL(href, location.href); } catch (_) { return null; }
      let dirty = false;
      if (SHIMS.has(u.hostname) && u.pathname === "/l.php") {
        const real = u.searchParams.get("u");
        if (real) try { const x = new URL(real); if (/^https?:$/.test(x.protocol)) { u = x; dirty = true; } } catch (_) {}
      }
      for (const k of [...u.searchParams.keys()]) if (isTK(k)) { u.searchParams.delete(k); dirty = true; }
      return dirty ? u.toString() : null;
    }

    function cleanLinks() {
      const h = cleanUrl(location.href); if (h) history.replaceState(history.state, "", h);
      for (const a of document.querySelectorAll('a[href^="http"]:not([data-fcf-cl])')) {
        a.setAttribute("data-fcf-cl", "");
        const c = cleanUrl(a.getAttribute("data-lynx-uri") || a.href); if (c) a.href = c;
        a.removeAttribute("ping"); a.removeAttribute("data-lynx-uri");
      }
    }

    const isFeed  = () => { const pp = location.pathname; return pp === "/" || pp === "/home.php"; };
    const isClean = () => { const pp = location.pathname.replace(/\/$/, ""); return isFeed() || pp === "/groups/feed" || pp === "/watch" || /^\/groups\/[^/]+$/.test(pp); };

    function sweep() {
      try {
        if (f.stripTracking) cleanLinks();
        if (isMFB) { processMobile(); return; }
        hideLeftNav();
        document.documentElement.classList.toggle("fcf-s", isFeed());
        if (isClean()) processDesktop();
        handleReels();
      } catch (_) {}
    }

    let scheduled = false;
    const idle = window.requestIdleCallback?.bind(window) ?? requestAnimationFrame;
    const schedule = () => { if (!scheduled) { scheduled = true; idle(() => { scheduled = false; sweep(); }); } };

    if (!isMFB) document.documentElement.classList.toggle("fcf-s", isFeed());

    onReady(() => {
      sweep();
      if (f.showToggleButton) {
        const b = floatBtn("fcf-btn", "🧹",
          "background:#fff;color:#111;right:10px;bottom:calc(72px + env(safe-area-inset-bottom))",
          "fcf", () => toggleFB(!C.facebook.enabled));
        if (b && !f.enabled) b.style.opacity = ".35";
      }
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
    const b = document.getElementById("yt-btn"); if (b) b.style.opacity = on ? "1" : ".35";
  }

  function initYT() {
    const y = C.youtube;

    const SEL = {
      ban:  "#masthead-ad,#player-ads,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,.ytp-ad-overlay-slot,.ytp-ad-overlay-container,.ytp-ad-image-overlay",
      feed: "ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-video-renderer,ytd-promoted-sparkles-web-renderer,ytm-companion-slot-renderer,ytm-promoted-video-renderer,ytm-search-pyv-renderer,ytm-promoted-sparkles-web-renderer,ad-slot-renderer",
      wrap: "ytd-rich-item-renderer,ytd-rich-section-renderer,ytm-rich-item-renderer,ytm-item-section-renderer",
      skip: ".ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container button,.ytp-ad-skip-button-slot button",
      clos: ".ytp-ad-overlay-close-button,.ytp-ad-overlay-close-container button",
    };
    const AD_V = ["ad-showing","ad-interrupting"];
    const AD_S = ["ad-showing","ad-interrupting","ad-created"];
    const hasC = (el, cl) => !!el && cl.some((c) => el.classList.contains(c));

    const rules = [...(y.hideBanners ? [SEL.ban] : []), ...(y.hideFeedAds ? [SEL.feed, "[data-yt-h]"] : [])];
    if (rules.length) addStyle("yt-css", rules.join(",") + "{display:none!important}");
    if (!y.enabled) { const ss = document.getElementById("yt-css"); if (ss) ss.disabled = true; }

    // SPA nav detection — reset shorts debounce on navigation
    let lastShort = 0;
    interceptNav(() => { lastShort = 0; });

    let muted = false;

    function tick() {
      if (!y.enabled) return;
      try {
        // anti-adblock popup
        if (y.dismissAntiAdblock) {
          const enf = q("ytd-enforcement-message-view-model");
          if (enf) {
            (enf.closest("tp-yt-paper-dialog") || enf).remove();
            q("tp-yt-iron-overlay-backdrop")?.remove();
            document.body?.style.removeProperty("overflow");
            const vi = q("video"); if (vi?.paused) vi.play().catch(() => {});
          }
        }

        // pre-roll / mid-roll ads
        if (y.skipVideoAds) {
          const pl = q("#movie_player,.html5-video-player");
          const v  = q(".html5-video-player video") || q("video");
          if (hasC(pl, AD_V)) {
            const sk = q(SEL.skip); if (sk) sk.click();
            if (v) {
              if (y.muteAds && !v.muted) { v.muted = true; muted = true; }
              if (!sk && isFinite(v.duration) && v.duration > 1) v.currentTime = v.duration - 0.1;
            }
            q(SEL.clos)?.click();
          } else if (v && muted) { v.muted = false; muted = false; }
        }

        // shorts ads — only on mutation tick, not interval
        if (y.skipShortsAds && /^\/shorts/.test(location.pathname)) {
          const sp = q("#shorts-player");
          const adOn = hasC(sp, AD_S) || !!q("ytd-reel-video-renderer ad-slot-renderer,ytd-reel-video-renderer ytd-ad-slot-renderer,ytd-shorts ytd-ad-slot-renderer,ytd-shorts ad-slot-renderer");
          if (adOn && Date.now() - lastShort > 700) {
            lastShort = Date.now();
            const nx = q('#navigation-button-down button,button[aria-label="Next video"],button[aria-label="Next Short"]');
            nx ? nx.click() : document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
          }
        }
      } catch (_) {}
    }

    // Feed ad wrappers — only on mutation, expensive to run constantly
    function hideFeedAds() {
      if (!y.hideFeedAds) return;
      for (const ad of document.querySelectorAll(SEL.feed)) {
        const w = ad.closest(SEL.wrap); if (w) w.setAttribute("data-yt-h", "");
      }
    }

    let sch = false;
    const schedule = () => { if (!sch) { sch = true; requestAnimationFrame(() => { sch = false; tick(); hideFeedAds(); }); } };

    onReady(() => {
      tick(); hideFeedAds();
      if (y.showToggleButton) {
        const b = floatBtn("yt-btn", "⏭",
          "background:#fff;color:#111;right:10px;bottom:calc(72px + env(safe-area-inset-bottom))",
          "yt", () => toggleYT(!C.youtube.enabled));
        if (b && !y.enabled) b.style.opacity = ".35";
      }
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      setInterval(tick, 1000);
    });

    onHotkey(() => y.toggleHotkey, () => toggleYT(!C.youtube.enabled));
  }

  // ── GM menu ────────────────────────────────────────────────
  function regMenu() {
    if (typeof GM_registerMenuCommand !== "function") return;
    const h = bare();
    GM_registerMenuCommand("⚙ Web Cleaner", Panel.open);
    GM_registerMenuCommand(`${C.siteBlocker.enabled ? "⛔ ON" : "✅ OFF"} – toggle`, () =>
      applyEdit("siteBlocker", () => { C.siteBlocker.enabled = !C.siteBlocker.enabled; }, "block"));
    GM_registerMenuCommand(`➕ Block ${h}`, () =>
      applyEdit("siteBlocker", () => {
        if (!C.siteBlocker.custom.includes(h)) C.siteBlocker.custom.push(h);
        C.siteBlocker.allow = C.siteBlocker.allow.filter((d) => d !== h);
      }, "block"));
    GM_registerMenuCommand(`➖ Allow ${h}`, () =>
      applyEdit("siteBlocker", () => {
        if (!C.siteBlocker.allow.includes(h)) C.siteBlocker.allow.push(h);
        C.siteBlocker.custom = C.siteBlocker.custom.filter((d) => d !== h);
      }, "block"));
    if (isFB) GM_registerMenuCommand(`🧹 FB ${C.facebook.enabled ? "ON" : "OFF"}`, () => toggleFB(!C.facebook.enabled));
    if (isYT) GM_registerMenuCommand(`⏭ YT ${C.youtube.enabled ? "ON" : "OFF"}`,  () => toggleYT(!C.youtube.enabled));
    GM_registerMenuCommand("🖥 Desktop", () => setVM("desktop"));
    GM_registerMenuCommand("📱 Mobile",  () => setVM("mobile"));
    GM_registerMenuCommand("↺ Auto",     () => setVM("auto"));
  }

  // ── boot ───────────────────────────────────────────────────
  const run = (fn) => { try { fn(); } catch (_) {} };
  run(initSB);
  run(initVM);
  run(initPanelFAB);
  if (isFB) run(initFB);
  if (isYT) run(initYT);
  regMenu();
})();