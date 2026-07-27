// ==UserScript==
// @name         Web Cleaner
// @namespace    https://local/webcleaner
// @version      2.0.0
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

  var D = document,
    W = window,
    L = location,
    N = navigator,
    H = L.hostname,
    P = L.pathname;

  var FB = new Set(["www.facebook.com", "web.facebook.com", "m.facebook.com"]);
  var YT = new Set(["www.youtube.com", "m.youtube.com", "music.youtube.com"]);
  var isFB = FB.has(H),
    isYT = YT.has(H),
    isMFB = H === "m.facebook.com";

  var FOCUS = "facebook.com youtube.com instagram.com tiktok.com x.com twitter.com reddit.com snapchat.com threads.net pinterest.com tumblr.com linkedin.com twitch.tv netflix.com hulu.com dailymotion.com news.ycombinator.com cnn.com bbc.com dailymail.co.uk foxnews.com buzzfeed.com 9gag.com imgur.com boredpanda.com amazon.com ebay.com aliexpress.com temu.com shein.com".split(" ");
  var ADULT = "pornhub.com xvideos.com xnxx.com xhamster.com redtube.com youporn.com spankbang.com onlyfans.com chaturbate.com stripchat.com".split(" ");
  var ADULT_RE = /(porn|xvideos|xhamster|hentai|camsoda|chaturbate|brazzers|onlyfans|nsfw|sexcam|sextube|camgirl)/i;

  var BOUNDS = {
    snoozeMinutes: [1, 1440],
    desktopWidth: [320, 7680],
    mobileWidth: [240, 1080],
    mobileHeight: [400, 2400],
    mobileDpr: [0.5, 5],
    longPressMs: [100, 5e3],
  };

  var DEF = {
    facebook: {
      enabled: 1, hideSponsored: 1, hideSuggested: 1, hidePeopleYouMayKnow: 1,
      hideReelsTrays: 1, stripTracking: 1, showToggleButton: 1, hideRightSidebar: 1,
      hideLeftSidebar: 1, hideComposer: 1, hideTopBar: 1, skipReelsAds: 1,
      forceMostRecent: 1, extraJunkPhrases: [],
      toggleHotkey: { ctrl: 0, alt: 1, shift: 1, key: "f" },
    },
    youtube: {
      enabled: 1, skipVideoAds: 1, skipShortsAds: 1, hideFeedAds: 1, hideBanners: 1,
      muteAds: 1, dismissAntiAdblock: 1, showToggleButton: 1,
      toggleHotkey: { ctrl: 0, alt: 1, shift: 1, key: "y" },
    },
    siteBlocker: {
      enabled: 1, blockAdult: 1, blockFocus: 0, scheduleOn: 1, snoozeMinutes: 5,
      schedule: { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" },
      custom: [], allow: [],
      toggleHotkey: { ctrl: 0, alt: 1, shift: 1, key: "b" },
    },
    viewMode: {
      newSiteDefault: "auto", showButton: 1, spoofUA: 1, spoofTouch: 1,
      spoofMedia: 1, frameOnDesktop: 0, longPressMs: 500, desktopWidth: 1280,
      mobileWidth: 412, mobileHeight: 915, mobileDpr: 2.625,
      mobileUA: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      desktopUA: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      toggleHotkey: { ctrl: 0, alt: 1, shift: 1, key: "v" },
    },
  };

  // ── storage ──

  var gmOk = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  var gGet = (k, d) => (gmOk ? GM_getValue(k, d) : d);
  var gSet = (k, v) => gmOk && GM_setValue(k, v);

  function deepMerge(d, o) {
    var r = JSON.parse(JSON.stringify(d));
    if (!o || typeof o !== "object") return r;
    for (var k in o)
      if (k in r && !Array.isArray(r[k]) && typeof r[k] === "object" && typeof o[k] === "object" && !Array.isArray(o[k]))
        r[k] = deepMerge(r[k], o[k]);
      else r[k] = o[k];
    return r;
  }

  var C = {};
  for (var mod in DEF) C[mod] = deepMerge(DEF[mod], gGet("wc_" + mod, {}));
  var save = (m) => gSet("wc_" + m, C[m]);

  // ── tiny helpers ──

  var clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  var bare = () => H.replace(/^www\./, "");
  var esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  var q = (sel, root) => (root || D).querySelector(sel);
  var qa = (sel, root) => (root || D).querySelectorAll(sel);
  var el = (tag, attrs, text) => { var e = D.createElement(tag); if (attrs) for (var k in attrs) k === "style" ? (e.style.cssText = attrs[k]) : e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  var addStyle = (id, css) => { if (!q("#" + id)) { var s = el("style", { id: id }); s.textContent = css; (D.head || D.documentElement).appendChild(s); } };
  var ls = (k, v) => { try { return v === undefined ? localStorage.getItem("wc_" + k) : localStorage.setItem("wc_" + k, v); } catch (_) { return null; } };

  function cleanHost(raw) {
    try {
      var s = String(raw).trim();
      return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : "https://" + s).hostname.replace(/^www\./, "").toLowerCase();
    } catch (_) {
      return String(raw).trim().replace(/^[a-z]+:\/\//i, "").replace(/[/:?#].*$/, "").replace(/^www\./, "").toLowerCase();
    }
  }

  function inject(fn, payload) {
    try {
      var s = el("script");
      s.textContent = "(" + fn + ")(" + JSON.stringify(payload).replace(/<\//g, "<\\/") + ");";
      (D.head || D.documentElement).appendChild(s);
      s.remove();
    } catch (_) {}
  }

  function onReady(fn) {
    D.body ? fn() : D.addEventListener("DOMContentLoaded", fn);
  }

  function onHotkey(getSpec, handler) {
    W.addEventListener("keydown", function (e) {
      var h = getSpec();
      if (e.metaKey || e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift) return;
      if ((e.key || "").toLowerCase() !== String(h.key).toLowerCase()) return;
      var t = e.target;
      if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ""))) return;
      e.preventDefault();
      handler();
    }, true);
  }

  // ── draggable floating button factory ──

  var BTN = "position:fixed;z-index:2147483647;width:40px;height:40px;border-radius:50%;" +
    "border:none;cursor:pointer;font-size:18px;line-height:40px;padding:0;" +
    "box-shadow:0 2px 10px rgba(0,0,0,.35);touch-action:none;transition:transform .1s";

  function floatBtn(id, icon, style, storeKey, onTap, longPressFn, longPressMs) {
    if (!D.body || q("#" + id)) return;
    var b = el("button", { id: id, style: BTN + ";" + style }, icon);
    var lk = "btn_" + storeKey, pos = null;
    try { pos = JSON.parse(ls(lk) || "null"); } catch (_) {}
    if (pos && typeof pos.l === "number") {
      b.style.left = clamp(pos.l, 0, innerWidth - 40) + "px";
      b.style.top = clamp(pos.t, 0, innerHeight - 40) + "px";
      b.style.right = b.style.bottom = "auto";
    }
    var pr = null;
    b.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
      b.style.transform = "scale(.9)";
      pr = { sx: e.clientX, sy: e.clientY, moved: 0, long: 0, timer: null };
      if (longPressFn)
        pr.timer = setTimeout(function () { if (pr && !pr.moved) { pr.long = 1; longPressFn(); } }, longPressMs || 500);
    });
    b.addEventListener("pointermove", function (e) {
      if (!pr) return;
      if (!pr.moved && Math.hypot(e.clientX - pr.sx, e.clientY - pr.sy) > 6) {
        pr.moved = 1;
        if (pr.timer) { clearTimeout(pr.timer); pr.timer = null; }
      }
      if (pr.moved) {
        b.style.left = clamp(e.clientX - 20, 0, innerWidth - 40) + "px";
        b.style.top = clamp(e.clientY - 20, 0, innerHeight - 40) + "px";
        b.style.right = b.style.bottom = "auto";
      }
    });
    b.addEventListener("pointerup", function (e) {
      b.style.transform = "";
      if (!pr) return;
      if (pr.timer) clearTimeout(pr.timer);
      var p = pr; pr = null;
      try { b.releasePointerCapture(e.pointerId); } catch (_) {}
      if (p.long) return;
      if (p.moved) { try { ls(lk, JSON.stringify({ l: parseInt(b.style.left), t: parseInt(b.style.top) })); } catch (_) {} return; }
      onTap();
    });
    D.body.appendChild(b);
    return b;
  }

  // ── site blocker ──

  var sbMatch = (list) => { var h = bare(); return list.some(function (d) { return h === d || h.endsWith("." + d); }); };
  var sbSnoozed = () => Date.now() < gGet("wc_snz", 0);
  var sbSnooze = (m) => gSet("wc_snz", Date.now() + m * 6e4);

  function sbInSchedule() {
    var s = C.siteBlocker, c = s.schedule;
    if (!s.scheduleOn || !c.days.includes(new Date().getDay())) return 0;
    var now = new Date(), cur = now.getHours() * 60 + now.getMinutes();
    var f = +(c.from.split(":")[0]) * 60 + +(c.from.split(":")[1]);
    var t = +(c.to.split(":")[0]) * 60 + +(c.to.split(":")[1]);
    return f <= t ? cur >= f && cur < t : cur >= f || cur < t;
  }

  function blockReason() {
    var s = C.siteBlocker;
    if (!s.enabled || sbSnoozed()) return null;
    if (sbMatch(s.allow)) return null;
    if (sbMatch(s.custom)) return "on your block list";
    if (s.blockAdult && (sbMatch(ADULT) || ADULT_RE.test(bare()))) return "blocked by adult filter";
    if ((s.blockFocus || sbInSchedule()) && sbMatch(FOCUS)) return s.blockFocus ? "blocked by focus filter" : "blocked during focus hours";
    return null;
  }

  function applyEdit(mod, mutate, affects) {
    var before = affects === "block" ? !!blockReason() : null;
    mutate();
    save(mod);
    (affects === "block" ? before !== !!blockReason() : !!affects) ? L.reload() : Panel.refresh();
  }

  // ── view mode state ──

  var vmStored = ls("vm") || "";
  var vmMode = vmStored || C.viewMode.newSiteDefault;
  var vmActive = () => vmMode !== "auto";
  var setVM = (m) => { ls("vm", m); L.reload(); };

  // ── panel ──

  var keyLabel = (h) => (h.ctrl ? "Ctrl+" : "") + (h.alt ? "Alt+" : "") + (h.shift ? "Shift+" : "") + String(h.key || "").toUpperCase();

  var row = (label, type, mod, key) => {
    if (type === "sw")
      return '<div class="r"><span>' + esc(label) + '</span><label class="sw"><input type="checkbox" data-sw="' + mod + "." + key + '"' + (C[mod][key] ? " checked" : "") + '><span class="tk"></span></label></div>';
    if (type === "num")
      return '<div class="r"><span>' + esc(label) + '</span><input class="nm" type="number" data-nm="' + mod + "." + key + '" value="' + esc(C[mod][key]) + '"></div>';
    if (type === "txt")
      return '<div class="fr"><span>' + esc(label) + '</span><input class="tx" type="text" data-tx="' + mod + "." + key + '" value="' + esc(C[mod][key]) + '"></div>';
    if (type === "time")
      return '<div class="r"><span>' + esc(label) + '</span><input class="tm" type="time" data-tm="' + mod + "." + key + '" value="' + esc(C[mod].schedule[key]) + '"></div>';
    if (type === "hk")
      return '<div class="r"><span>Shortcut</span><button class="hk" data-hk="' + mod + '">' + esc(keyLabel(C[mod].toggleHotkey)) + "</button></div>";
    return "";
  };

  function listBlock(label, mod, key, ph) {
    var arr = C[mod][key], p = mod + "." + key;
    var items = arr.length
      ? arr.map(function (d) { return '<div class="it"><span title="' + esc(d) + '">' + esc(d) + '</span><button class="dl" data-dl="' + p + '" data-v="' + esc(d) + '">Remove</button></div>'; }).join("")
      : '<div class="em">None yet.</div>';
    return '<div class="sc"><h2>' + esc(label) + "</h2>" + items + '<div class="ad"><input type="text" data-ai="' + p + '" placeholder="' + esc(ph) + '"><button data-ab="' + p + '">Add</button></div></div>';
  }

  function packHtml(sites) {
    return sites.map(function (d) {
      var on = C.siteBlocker.allow.includes(d);
      return '<div class="it"><span>' + esc(d) + '</span><button class="pl ' + (on ? "al" : "bl") + '" data-pk="' + esc(d) + '">' + (on ? "Allowed" : "Blocked") + "</button></div>";
    }).join("");
  }

  function secFB() {
    return "<details data-s=facebook><summary>🧹 Facebook " + (C.facebook.enabled ? "ON" : "OFF") + "</summary>" +
      [["Enabled", "enabled"], ["Hide Sponsored", "hideSponsored"], ["Hide Suggested", "hideSuggested"],
        ["Hide People You May Know", "hidePeopleYouMayKnow"], ["Hide Reels/Stories", "hideReelsTrays"],
        ["Hide right sidebar", "hideRightSidebar"], ["Hide left sidebar", "hideLeftSidebar"],
        ["Hide composer", "hideComposer"], ["Hide top bar", "hideTopBar"],
        ["Strip tracking", "stripTracking"], ["Skip Reel ads", "skipReelsAds"],
        ["Force Most Recent", "forceMostRecent"], ["Show button", "showToggleButton"],
      ].map(function (r) { return row(r[0], "sw", "facebook", r[1]); }).join("") +
      listBlock("Extra junk phrases", "facebook", "extraJunkPhrases", "phrase") +
      "<details data-s=fb-adv><summary>Advanced</summary>" + row("", "hk", "facebook") + "</details></details>";
  }

  function secYT() {
    return "<details data-s=youtube><summary>⏭ YouTube " + (C.youtube.enabled ? "ON" : "OFF") + "</summary>" +
      [["Enabled", "enabled"], ["Skip video ads", "skipVideoAds"], ["Skip Shorts ads", "skipShortsAds"],
        ["Hide feed ads", "hideFeedAds"], ["Hide banners", "hideBanners"], ["Mute ads", "muteAds"],
        ["Dismiss anti-adblock", "dismissAntiAdblock"], ["Show button", "showToggleButton"],
      ].map(function (r) { return row(r[0], "sw", "youtube", r[1]); }).join("") +
      "<details data-s=yt-adv><summary>Advanced</summary>" + row("", "hk", "youtube") + "</details></details>";
  }

  function secSB() {
    var s = C.siteBlocker;
    return '<details data-s=sb open><summary>⛔ Site Blocker ' + (s.enabled ? "ON" : "OFF") + "</summary>" +
      '<div class="r"><div>Blocking<div class="cu">' + esc(H) + '</div></div><label class="sw"><input type="checkbox" data-sw="siteBlocker.enabled"' + (s.enabled ? " checked" : "") + '><span class="tk"></span></label></div>' +
      row("Adult filter", "sw", "siteBlocker", "blockAdult") +
      row("Focus mode", "sw", "siteBlocker", "blockFocus") +
      row("Schedule (" + esc(s.schedule.from) + "–" + esc(s.schedule.to) + ")", "sw", "siteBlocker", "scheduleOn") +
      (sbSnoozed() ? '<div class="cu">⏱ Snoozed</div>' : "") +
      listBlock("Blocked sites", "siteBlocker", "custom", "example.com") +
      listBlock("Allowed", "siteBlocker", "allow", "example.com") +
      '<div class="sc"><h2>Packs</h2><details data-s=focus><summary>Focus (' + FOCUS.length + ")</summary>" + packHtml(FOCUS) +
      '</details><details data-s=adult><summary>Adult (' + ADULT.length + ")</summary>" + packHtml(ADULT) + "</details></div>" +
      "<details data-s=sb-adv><summary>Advanced</summary>" +
      row("From", "time", "siteBlocker", "from") + row("To", "time", "siteBlocker", "to") +
      row("Snooze min", "num", "siteBlocker", "snoozeMinutes") + row("", "hk", "siteBlocker") +
      "</details></details>";
  }

  function secVM() {
    var seg = function (v, attr) {
      var cur = attr === "data-vm" ? vmMode : C.viewMode.newSiteDefault;
      return '<button class="' + (cur === v ? "on" : "") + '" ' + attr + '="' + v + '">' + v[0].toUpperCase() + v.slice(1) + "</button>";
    };
    return "<details data-s=vm><summary>🖥 View Mode " + vmMode.toUpperCase() + "</summary>" +
      '<div class="r"><span>This site</span><div class="sg">' + ["desktop", "mobile", "auto"].map(function (v) { return seg(v, "data-vm"); }).join("") + "</div></div>" +
      '<div class="r"><span>Default</span><div class="sg">' + ["desktop", "mobile", "auto"].map(function (v) { return seg(v, "data-df"); }).join("") + "</div></div>" +
      [["Spoof UA", "spoofUA"], ["Spoof touch", "spoofTouch"], ["Spoof matchMedia", "spoofMedia"],
        ["Phone frame", "frameOnDesktop"], ["Show button", "showButton"],
      ].map(function (r) { return row(r[0], "sw", "viewMode", r[1]); }).join("") +
      "<details data-s=vm-adv><summary>Advanced</summary>" +
      [["Desktop width", "desktopWidth"], ["Mobile width", "mobileWidth"], ["Mobile height", "mobileHeight"],
        ["Mobile DPR", "mobileDpr"], ["Long-press ms", "longPressMs"],
      ].map(function (r) { return row(r[0], "num", "viewMode", r[1]); }).join("") +
      row("Mobile UA", "txt", "viewMode", "mobileUA") + row("Desktop UA", "txt", "viewMode", "desktopUA") +
      row("", "hk", "viewMode") + "</details></details>";
  }

  var CSS_PANEL = ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}' +
    '.bk{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646}' +
    '.cd{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 28px));max-height:min(86vh,820px);overflow:auto;background:#17181b;color:#e9e9ea;border-radius:14px;padding:18px;box-shadow:0 12px 48px rgba(0,0,0,.6);z-index:2147483647;font-size:14px;line-height:1.4}' +
    '.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}.hd h1{font-size:16px;font-weight:700;margin:0}' +
    '.x{background:none;border:0;color:#9a9aa0;font-size:24px;cursor:pointer;line-height:1;padding:0 4px}' +
    '.r{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #26272c}' +
    '.fr{display:flex;flex-direction:column;gap:5px;padding:9px 0;border-top:1px solid #26272c}' +
    '.cu{font-size:12px;color:#8a8a90;margin-top:2px}' +
    '.sc{margin-top:14px}.sc>h2{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8a8a90;margin:0 0 2px}' +
    '.it{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid #26272c}.it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.dl{background:#2b2b30;border:0;color:#ff8a8a;border-radius:8px;cursor:pointer;padding:4px 10px;font-size:13px;flex:0 0 auto}' +
    '.ad{display:flex;gap:8px;margin-top:8px}.ad input{flex:1;min-width:0;background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:8px 10px;font-size:13px}' +
    '.ad button{background:#3a7afe;border:0;color:#fff;border-radius:8px;cursor:pointer;padding:8px 14px;font-size:13px;flex:0 0 auto}' +
    '.em{color:#6a6a70;font-style:italic;padding:7px 0;border-top:1px solid #26272c}' +
    '.sw{position:relative;display:inline-block;width:44px;height:26px;flex:0 0 auto}.sw input{opacity:0;width:0;height:0;position:absolute}' +
    '.tk{position:absolute;inset:0;background:#3a3b42;border-radius:999px;transition:.15s;cursor:pointer}' +
    '.tk::before{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.15s}' +
    '.sw input:checked+.tk{background:#2ecc71}.sw input:checked+.tk::before{transform:translateX(18px)}' +
    'details{margin-top:6px}summary{cursor:pointer;padding:9px 0;color:#c9c9cf;border-top:1px solid #26272c;list-style:none;user-select:none;font-weight:600}summary::-webkit-details-marker{display:none}' +
    '.pl{border:0;border-radius:8px;cursor:pointer;padding:4px 12px;font-size:12px;flex:0 0 auto}' +
    '.bl{background:#3a2b2b;color:#ff9a9a}.al{background:#243024;color:#9be79b}' +
    '.nm{width:96px;background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:6px 8px;font-size:13px;text-align:right}' +
    '.tm{background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:6px 8px;font-size:13px}' +
    '.tx{background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:8px 10px;font-size:12px;width:100%}' +
    '.hk{background:#2b2b30;border:0;color:#e9e9ea;border-radius:8px;cursor:pointer;padding:5px 12px;font-size:13px}.hk.arm{background:#3a7afe;color:#fff}' +
    '.sg{display:flex;gap:6px}.sg button{flex:1;background:#2b2b30;border:0;color:#c9c9cf;border-radius:8px;cursor:pointer;padding:6px 0;font-size:13px}.sg button.on{background:#3a7afe;color:#fff}';

  var Panel = (function () {
    var root = null, capFn = null, armed = null;

    function affects(m) {
      return m === "siteBlocker" ? "block" : m === "facebook" ? isFB : m === "youtube" ? isYT : m === "viewMode" ? vmActive() : 0;
    }
    function edit(m, fn) { armed = null; applyEdit(m, fn, affects(m)); }

    function onEsc(e) { if (!armed && e.key === "Escape") { e.preventDefault(); close(); } }

    function render() {
      var sh = root.shadowRoot, open = {};
      qa("details[data-s]", sh).forEach(function (d) { open[d.getAttribute("data-s")] = d.open; });
      sh.innerHTML = "<style>" + CSS_PANEL + '</style><div class="bk" data-x></div><div class="cd" role="dialog">' +
        '<div class="hd"><h1>🧼 Web Cleaner</h1><button class="x" data-x>×</button></div>' +
        secSB() + secVM() + secFB() + secYT() + "</div>";
      qa("details[data-s]", sh).forEach(function (d) { if (open[d.getAttribute("data-s")]) d.open = 1; });
      wire(sh);
    }

    function wire(sh) {
      qa("[data-x]", sh).forEach(function (e) { e.addEventListener("click", close); });

      qa("[data-sw]", sh).forEach(function (e) {
        e.addEventListener("change", function () {
          var p = e.getAttribute("data-sw").split("."), m = p[0], k = p[1];
          if (m === "facebook" && k === "enabled") { toggleFB(e.checked); render(); return; }
          if (m === "youtube" && k === "enabled") { toggleYT(e.checked); render(); return; }
          edit(m, function () { C[m][k] = e.checked; });
        });
      });

      qa("[data-nm]", sh).forEach(function (e) {
        e.addEventListener("change", function () {
          var p = e.getAttribute("data-nm").split("."), m = p[0], k = p[1], v = parseFloat(e.value);
          if (!isFinite(v) || v <= 0) { render(); return; }
          if (BOUNDS[k]) v = clamp(v, BOUNDS[k][0], BOUNDS[k][1]);
          edit(m, function () { C[m][k] = v; });
        });
      });

      qa("[data-tx]", sh).forEach(function (e) {
        e.addEventListener("change", function () {
          var p = e.getAttribute("data-tx").split("."), v = e.value.trim();
          if (!v) { render(); return; }
          edit(p[0], function () { C[p[0]][p[1]] = v; });
        });
      });

      qa("[data-tm]", sh).forEach(function (e) {
        e.addEventListener("change", function () {
          var k = e.getAttribute("data-tm").split(".")[1];
          if (!/^\d{2}:\d{2}$/.test(e.value)) { render(); return; }
          edit("siteBlocker", function () { C.siteBlocker.schedule[k] = e.value; });
        });
      });

      qa("[data-dl]", sh).forEach(function (e) {
        e.addEventListener("click", function () {
          var p = e.getAttribute("data-dl").split("."), v = e.getAttribute("data-v");
          edit(p[0], function () { C[p[0]][p[1]] = C[p[0]][p[1]].filter(function (d) { return d !== v; }); });
        });
      });

      qa("[data-ab]", sh).forEach(function (btn) {
        var path = btn.getAttribute("data-ab"), p = path.split("."), m = p[0], k = p[1];
        var inp = sh.querySelector('[data-ai="' + path + '"]');
        var go = function () {
          var v = m === "facebook" ? inp.value.trim().toLowerCase() : cleanHost(inp.value);
          if (!v) return;
          edit(m, function () {
            if (!C[m][k].includes(v)) C[m][k].push(v);
            if (m === "siteBlocker" && k === "custom") C.siteBlocker.allow = C.siteBlocker.allow.filter(function (d) { return d !== v; });
            if (m === "siteBlocker" && k === "allow") C.siteBlocker.custom = C.siteBlocker.custom.filter(function (d) { return d !== v; });
          });
        };
        btn.addEventListener("click", go);
        inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); go(); } });
      });

      qa("[data-pk]", sh).forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-pk");
          edit("siteBlocker", function () {
            var a = C.siteBlocker.allow;
            C.siteBlocker.allow = a.includes(v) ? a.filter(function (d) { return d !== v; }) : a.concat(v);
          });
        });
      });

      qa("[data-vm]", sh).forEach(function (b) { b.addEventListener("click", function () { setVM(b.getAttribute("data-vm")); }); });
      qa("[data-df]", sh).forEach(function (b) {
        b.addEventListener("click", function () { edit("viewMode", function () { C.viewMode.newSiteDefault = b.getAttribute("data-df"); }); });
      });

      qa("[data-hk]", sh).forEach(function (b) {
        b.addEventListener("click", function () {
          var m = b.getAttribute("data-hk");
          armed = m; b.textContent = "Press keys…"; b.classList.add("arm");
          if (capFn) { W.removeEventListener("keydown", capFn, true); capFn = null; }
          capFn = function (e) {
            e.preventDefault(); e.stopPropagation();
            if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
            W.removeEventListener("keydown", capFn, true); capFn = null; armed = null;
            if (e.metaKey || !(e.altKey || e.ctrlKey || e.shiftKey)) { render(); return; }
            applyEdit(m, function () { C[m].toggleHotkey = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, key: e.key.toLowerCase() }; }, 0);
          };
          W.addEventListener("keydown", capFn, true);
        });
      });
    }

    function open() {
      if (root) { close(); return; }
      if (!D.body) return;
      root = el("div", { id: "wc-p", style: "all:initial" });
      root.attachShadow({ mode: "open" });
      D.body.appendChild(root);
      render();
      D.addEventListener("keydown", onEsc, true);
    }

    function close() {
      if (capFn) { W.removeEventListener("keydown", capFn, true); capFn = null; }
      armed = null;
      if (root) { root.remove(); root = null; }
      D.removeEventListener("keydown", onEsc, true);
    }

    return { open: open, close: close, refresh: function () { if (root) render(); } };
  })();

  // ── site blocker init ──

  function initSB() {
    function show(why) {
      try { W.stop(); } catch (_) {}
      D.documentElement.innerHTML = "<head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Blocked</title></head><body></body>";
      var b = D.body;
      b.id = "wc-blk";
      Object.assign(b.style, { margin: "0", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px", textAlign: "center", padding: "24px", fontFamily: "system-ui,sans-serif", background: "#0b0b0c", color: "#e9e9ea" });
      var ic = el("div", { style: "font-size:56px" }, "⛔");
      var ti = el("div", { style: "font-size:22px;font-weight:600" }, "Blocked");
      var ds = el("div", { style: "opacity:.65;max-width:30rem" }, bare() + " – " + why + ".");
      var ab = el("button", { style: "margin-top:6px;padding:10px 18px;border:0;border-radius:10px;cursor:pointer;font-size:14px;background:#2b2b30;color:#e9e9ea" }, "Allow for " + C.siteBlocker.snoozeMinutes + " min");
      ab.onclick = function () { sbSnooze(C.siteBlocker.snoozeMinutes); L.reload(); };
      var mb = el("button", { style: "padding:8px 16px;border:0;border-radius:10px;cursor:pointer;font-size:13px;background:#1c1c20;color:#9a9aa0" }, "⚙ Manage");
      mb.onclick = Panel.open;
      b.append(ic, ti, ds, ab, mb);
    }
    var check = function () { var w = blockReason(); if (w && !q("#wc-blk")) show(w); };
    check();
    setInterval(check, 5e3);
    onHotkey(function () { return C.siteBlocker.toggleHotkey; }, function () { applyEdit("siteBlocker", function () { C.siteBlocker.enabled = !C.siteBlocker.enabled; }, "block"); });
  }

  // ── view mode init ──

  function vmSpoof(p) {
    var d = function (o, k, g) { try { Object.defineProperty(o, k, { configurable: 1, get: g }); } catch (_) {} };
    var tm = p.tm, c = p.c;
    if (c.spoofUA) {
      var u = tm ? c.mUA : c.dUA;
      d(navigator, "userAgent", function () { return u; });
      d(navigator, "appVersion", function () { return u.replace(/^Mozilla\//, ""); });
      d(navigator, "platform", function () { return tm ? "Linux armv8l" : "Win32"; });
      d(navigator, "vendor", function () { return "Google Inc."; });
      try {
        var br = navigator.userAgentData ? navigator.userAgentData.brands : [];
        d(navigator, "userAgentData", function () {
          return { mobile: tm, platform: tm ? "Android" : "Windows", brands: br,
            getHighEntropyValues: function () { return Promise.resolve({ mobile: tm, platform: tm ? "Android" : "Windows" }); },
            toJSON: function () { return { mobile: tm, platform: tm ? "Android" : "Windows", brands: br }; } };
        });
      } catch (_) {}
    }
    if (c.spoofTouch) { d(navigator, "maxTouchPoints", function () { return tm ? 5 : 0; }); try { if (tm && !("ontouchstart" in window)) window.ontouchstart = null; } catch (_) {} }
    if (c.spoofMedia) {
      var ew = tm ? c.mW : c.dW, nat = window.matchMedia ? window.matchMedia.bind(window) : null;
      window.matchMedia = function (query) {
        var s = String(query).toLowerCase(), r = null, f = function (v) { if (r !== false) r = v; }, m;
        if ((m = s.match(/min-width:\s*(\d+(?:\.\d+)?)px/))) f(ew >= parseFloat(m[1]));
        if ((m = s.match(/max-width:\s*(\d+(?:\.\d+)?)px/))) f(ew <= parseFloat(m[1]));
        if (s.includes("pointer: coarse") || s.includes("any-pointer: coarse")) f(tm);
        if (s.includes("pointer: fine") || s.includes("any-pointer: fine")) f(!tm);
        if (s.includes("hover: none")) f(tm);
        if (s.includes("hover: hover")) f(!tm);
        if (r === null && nat) return nat(query);
        return { matches: !!r, media: String(query), onchange: null, addEventListener: function () {}, removeEventListener: function () {}, addListener: function () {}, removeListener: function () {}, dispatchEvent: function () { return false; } };
      };
      if (p.uf) {
        d(window, "innerWidth", function () { return c.mW; }); d(window, "innerHeight", function () { return c.mH; });
        d(screen, "width", function () { return c.mW; }); d(screen, "height", function () { return c.mH; });
        d(screen, "availWidth", function () { return c.mW; }); d(screen, "availHeight", function () { return c.mH; });
        d(window, "devicePixelRatio", function () { return c.mD; });
      }
    }
  }

  function initVM() {
    var v = C.viewMode;
    var realMobile = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(N.userAgent) || /iPad/.test(N.userAgent) || (/Macintosh/.test(N.userAgent) && N.maxTouchPoints > 1) || (N.userAgentData && N.userAgentData.mobile === true);
    var toM = vmMode === "mobile", useF = toM && !realMobile && v.frameOnDesktop;
    if (vmMode !== "auto")
      inject(vmSpoof, { tm: toM, uf: useF, c: { spoofUA: v.spoofUA, spoofTouch: v.spoofTouch, spoofMedia: v.spoofMedia, mUA: v.mobileUA, dUA: v.desktopUA, mW: v.mobileWidth, dW: v.desktopWidth, mH: v.mobileHeight, mD: v.mobileDpr } });

    function applyVP() {
      if (vmMode === "auto") return;
      qa('meta[name="viewport"]').forEach(function (e) { if (!e.hasAttribute("data-vm")) e.remove(); });
      var m = q('meta[name="viewport"][data-vm]');
      if (!m) { m = el("meta", { name: "viewport", "data-vm": "1" }); (D.head || D.documentElement).appendChild(m); }
      m.setAttribute("content", vmMode === "desktop" ? "width=" + v.desktopWidth : "width=device-width,initial-scale=1");
    }

    function applyFrame() {
      if (!useF) return;
      addStyle("vm-fs", "html.vm-f{background:#202124!important;overflow-x:hidden!important}" +
        "html.vm-f>body{width:" + v.mobileWidth + "px!important;min-width:" + v.mobileWidth + "px!important;max-width:" + v.mobileWidth + "px!important;margin:0 auto!important;min-height:100vh!important;overflow-x:hidden!important;box-shadow:0 0 0 100vmax #202124,0 0 40px rgba(0,0,0,.6)!important}");
      D.documentElement.classList.add("vm-f");
    }

    applyVP();
    if (vmMode !== "auto") {
      var ra = function () { applyVP(); applyFrame(); };
      D.addEventListener("DOMContentLoaded", ra);
      [200, 600, 1500, 3500].forEach(function (t) { setTimeout(ra, t); });
    }

    var toggle = function () { setVM(vmMode === "desktop" ? "mobile" : "desktop"); };
    onReady(function () {
      if (v.showButton) {
        var b = floatBtn("vm-btn", vmMode === "desktop" ? "🖥" : vmMode === "mobile" ? "📱" : "🔄",
          "background:rgba(0,0,0,.55);color:#fff;opacity:.55;left:10px;bottom:10px",
          "vm", toggle, function () { setVM("auto"); }, v.longPressMs);
        if (b) {
          b.addEventListener("mouseenter", function () { b.style.opacity = "1"; });
          b.addEventListener("mouseleave", function () { b.style.opacity = ".55"; });
        }
      }
    });
    onHotkey(function () { return v.toggleHotkey; }, toggle);
  }

  // ── facebook ──

  function toggleFB(on) {
    C.facebook.enabled = on; save("facebook");
    D.documentElement.classList.toggle("fcf-off", !on);
    var b = q("#fcf-btn"); if (b) b.style.opacity = on ? "1" : ".4";
  }

  function initFB() {
    var f = C.facebook;
    if (!f.enabled) D.documentElement.classList.add("fcf-off");
    if (!isMFB && f.forceMostRecent && (P === "/" || P === "/home.php") && !/[?&]sk=/.test(L.search)) { L.replace(L.origin + "/?sk=h_chr"); return; }

    var norm = function (s) { return String(s).normalize("NFKC").toLowerCase().replace(/[^\p{L}]/gu, ""); };
    var SPON = "sponsored paidpartnership publicidad patrocinado sponsoris commandit gesponsert sponsorizzat gesponsord bersponsor sponsorlu sponsorowan sponsrad sponset sponsoreret ممول ממומן реклама 広告 광고 赞助 贊助 χορηγούμενη".split(" ").map(norm);
    var MARKS = [].concat(
      f.hideSponsored ? SPON : [],
      f.hideSuggested ? ["suggestedforyou", "suggestedpost", "pagesforyou", "pagesyoumaylike", "groupsyoumaylike"] : [],
      f.hidePeopleYouMayKnow ? ["peopleyoumayknow"] : [],
      f.extraJunkPhrases.map(norm)
    );
    var EXACT = f.hideReelsTrays ? ["reels", "reelsandshortvideos", "stories"] : [];
    var STRIP = /[​-‏-﻿­⁠]/g;

    // style
    (function () {
      var R = ["html:not(.fcf-off) [data-fcf]{display:none!important}"];
      if (!isMFB) {
        var X = "html.fcf-s:not(.fcf-off) ";
        if (f.hideRightSidebar) R.push(X + '[role="complementary"]{display:none!important}');
        if (f.hideLeftSidebar) R.push(X + '[role="navigation"][aria-label="Shortcuts"]{display:none!important}', 'html:not(.fcf-off) [data-fcf-ln]{display:none!important}');
        if (f.hideComposer) R.push(X + '[role="region"][aria-label="Create a post"]{display:none!important}');
        if (f.hideTopBar) R.push(X + '[role="banner"],' + X + '[role="navigation"][aria-label="Facebook"],' + X + '[role="navigation"][aria-label="Account Controls and Settings"]{display:none!important}');
        if (f.hideReelsTrays) R.push(X + '[aria-label="Stories"],' + X + '[aria-label="Reels"]{display:none!important}');
        R.push(X + '[role="main"]{margin-left:auto!important;margin-right:auto!important}');
        if (f.hideTopBar) R.push(X + "body{padding-top:0!important}");
      }
      addStyle("fcf-css", R.join("\n"));
    })();

    function readText(scope, bt, bb) {
      var g = [], w = D.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null), n, bud = 600;
      while ((n = w.nextNode()) && bud-- > 0) {
        var s = n.nodeValue; if (!s || !s.trim()) continue;
        var p = n.parentElement; if (!p || p.closest('[aria-hidden="true"]')) continue;
        var cs = getComputedStyle(p);
        if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0" || cs.fontSize === "0px") continue;
        var pr = p.getBoundingClientRect();
        if (!pr.width || !pr.height || pr.right <= 0 || pr.bottom < bt || pr.top > bb) continue;
        var rng = D.createRange(); rng.selectNodeContents(n);
        var r = rng.getBoundingClientRect();
        if (!r.width || !r.height || r.right <= 0 || r.top < bt || r.top > bb) continue;
        g.push({ c: s.trim(), t: Math.round(r.top), l: Math.round(r.left) });
      }
      var seen = new Set(), k = [];
      for (var i = 0; i < g.length; i++) { var key = g[i].t + ":" + g[i].l; if (!seen.has(key)) { seen.add(key); k.push(g[i]); } }
      k.sort(function (a, b) { return (a.t - b.t) || (a.l - b.l); });
      return k.map(function (x) { return x.c; }).join("").replace(STRIP, "").replace(/\s+/g, " ").trim();
    }

    function isJunk(c) {
      if (!c) return 0;
      for (var i = 0; i < MARKS.length; i++) if (c.includes(MARKS[i])) return 1;
      return EXACT.includes(c);
    }

    var _feed = null, _path = P;
    function resetNav() { if (P !== _path) { _path = P; _feed = null; _skipEl = null; _skipN = 0; } }

    function feedBox() {
      if (_feed && _feed.isConnected) return _feed;
      var main = q('[role="main"]'); if (!main) return null;
      var best = null, bn = 1;
      for (var ch of main.querySelectorAll("div")) {
        var n = 0;
        for (var c of ch.children) { var r = c.getBoundingClientRect(); if (r.width >= 500 && r.width <= 720 && r.height > 60) n++; }
        if (n > bn) { bn = n; best = ch; }
      }
      return (_feed = best);
    }

    function processDesktop() {
      var fd = feedBox(); if (!fd) return;
      var vh = innerHeight;
      for (var st of fd.children) {
        if (st._wc === "h" || st._wc === "c") continue;
        var r = st.getBoundingClientRect();
        if (r.height < 60 || r.bottom < -500 || r.top > vh + 500) continue;
        var hdr = readText(st, r.top - 2, r.top + 130); if (!hdr) continue;
        if (isJunk(norm(hdr)) || (f.hideReelsTrays && qa('a[href*="/reel/"]', st).length > 3)) {
          st.setAttribute("data-fcf", ""); st._wc = "h";
        } else if ((st._wcN = (st._wcN || 0) + 1) >= 4) st._wc = "c";
      }
    }

    function processMobile() {
      for (var p of qa("[data-tracking-duration-id]")) {
        if (p._wc) continue;
        var junk = 0;
        for (var e of qa('span,a[role="link"],h3,h4,div[role="heading"]', p)) {
          var raw = (e.textContent || "").trim(); if (!raw || raw.length > 40) continue;
          var t = norm(raw); if (!t) continue;
          if (MARKS.some(function (m) { return t === m || t.startsWith(m); }) || EXACT.includes(t)) { junk = 1; break; }
        }
        if (junk) { p.setAttribute("data-fcf", ""); p._wc = "h"; }
        else if ((p._wcN = (p._wcN || 0) + 1) >= 4) p._wc = "c";
      }
    }

    function hideLeftNav() {
      if (!f.hideLeftSidebar) return;
      for (var n of qa('[role="navigation"]:not([data-fcf-ln])')) {
        var r = n.getBoundingClientRect();
        if (r.height > 350 && r.width >= 120 && r.width <= 460 && r.left <= 24) n.setAttribute("data-fcf-ln", "");
      }
    }

    // reel ad skipping
    var _reelSt = new WeakMap(), _skipEl = null, _skipT = 0, _skipN = 0;
    function handleReels() {
      if (!f.skipReelsAds || !/^\/reels?(\/|$)/.test(P)) return;
      var cy = innerHeight / 2, act = null, best = 1e9;
      for (var v of qa("video")) {
        var r = v.getBoundingClientRect(); if (r.height < 200) continue;
        var d = Math.abs((r.top + r.bottom) / 2 - cy); if (d < best) { best = d; act = v; }
      }
      if (!act) return;
      var rl = act;
      for (var i = 0; i < 12 && rl.parentElement; i++) {
        rl = rl.parentElement;
        if (rl.querySelector('[aria-label="Like"],[aria-label^="Comment"],[role="button"][aria-label="Next Card"]')) break;
      }
      if (!reelSpon(rl, act)) { if (act !== _skipEl) { _skipEl = null; _skipN = 0; } return; }
      if (act !== _skipEl) { _skipEl = act; _skipN = 0; }
      if (Date.now() - _skipT < 600 || _skipN >= 8) return;
      _skipN++; _skipT = Date.now();
      var nx = q('[role="button"][aria-label="Next Card"]');
      if (nx) { nx.click(); return; }
      var tg = rl.closest("[tabindex]") || rl;
      ["keydown", "keyup"].forEach(function (tp) { tg.dispatchEvent(new KeyboardEvent(tp, { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: 1 })); });
    }

    function reelSpon(rl, key) {
      var st = _reelSt.get(key);
      if (!st) _reelSt.set(key, (st = { s: 0, n: 0 }));
      if (st.s) return 1;
      if (st.n >= 8) return 0;
      st.n++;
      var r = rl.getBoundingClientRect(), c = norm(readText(rl, r.top - 2, r.bottom + 2));
      if (SPON.some(function (m) { return c.includes(m); })) st.s = 1;
      return st.s;
    }

    // tracking cleanup
    var TKEYS = new Set("fbclid gclid dclid gbraid wbraid msclkid yclid twclid igshid mc_eid mc_cid _openstat vero_id oly_enc_id oly_anon_id wickedid _hsenc _hsmi mkt_tok ref refsrc refid fref hc_ref hc_location ref_src ref_url eav paipv comment_tracking av rdid".split(" "));
    var SHIMS = new Set(["l.facebook.com", "lm.facebook.com", "l.messenger.com"]);

    function cleanUrl(href) {
      var u; try { u = new URL(href, L.href); } catch (_) { return null; }
      var dirty = 0;
      if (SHIMS.has(u.hostname) && u.pathname === "/l.php") {
        var real = u.searchParams.get("u");
        if (real) try { var x = new URL(real); if (x.protocol === "https:" || x.protocol === "http:") { u = x; dirty = 1; } } catch (_) {}
      }
      for (var k of [...u.searchParams.keys()]) if (TKEYS.has(k) || k.startsWith("utm_") || k.startsWith("__")) { u.searchParams.delete(k); dirty = 1; }
      return dirty ? u.toString() : null;
    }

    function cleanLinks() {
      var h = cleanUrl(L.href); if (h) history.replaceState(history.state, "", h);
      for (var a of qa('a[href^="http"]:not([data-fcf-cl])')) {
        a.setAttribute("data-fcf-cl", "");
        var c = cleanUrl(a.getAttribute("data-lynx-uri") || a.href); if (c) a.href = c;
        a.removeAttribute("ping"); a.removeAttribute("data-lynx-uri");
      }
    }

    var isFeed = function () { return P === "/" || P === "/home.php"; };
    var isClean = function () { var p = P.replace(/\/$/, ""); return isFeed() || p === "/groups/feed" || p === "/watch" || /^\/groups\/[^/]+$/.test(p); };

    function sweep() {
      try {
        resetNav();
        if (f.stripTracking) cleanLinks();
        if (isMFB) { processMobile(); return; }
        hideLeftNav();
        D.documentElement.classList.toggle("fcf-s", isFeed());
        if (isClean()) processDesktop();
        handleReels();
      } catch (_) {}
    }

    var sch = 0, idle = W.requestIdleCallback || requestAnimationFrame;
    function schedule() { if (!sch) { sch = 1; idle(function () { sch = 0; sweep(); }); } }

    if (!isMFB) D.documentElement.classList.toggle("fcf-s", isFeed());
    onReady(function () {
      sweep();
      if (f.showToggleButton) {
        var b = floatBtn("fcf-btn", "🧹", "background:#fff;color:#111;right:16px;bottom:16px", "fcf", function () { toggleFB(!C.facebook.enabled); });
        if (b && !f.enabled) b.style.opacity = ".4";
      }
      new MutationObserver(schedule).observe(D.documentElement, { childList: 1, subtree: 1 });
      W.addEventListener("scroll", schedule, { passive: 1 });
      setInterval(sweep, isMFB ? 1e3 : 1500);
      setInterval(resetNav, 500);
    });
    onHotkey(function () { return f.toggleHotkey; }, function () { toggleFB(!C.facebook.enabled); });
  }

  // ── youtube ──

  function toggleYT(on) {
    C.youtube.enabled = on; save("youtube");
    var s = q("#yt-css"); if (s) s.disabled = !on;
    var b = q("#yt-btn"); if (b) b.style.opacity = on ? "1" : ".4";
  }

  function initYT() {
    var y = C.youtube;
    var BAN = "#masthead-ad,#player-ads,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,.ytp-ad-overlay-slot,.ytp-ad-overlay-container,.ytp-ad-image-overlay";
    var FEED = "ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-video-renderer,ytd-promoted-sparkles-web-renderer,ytm-companion-slot-renderer,ytm-promoted-video-renderer,ytm-search-pyv-renderer,ytm-promoted-sparkles-web-renderer,ad-slot-renderer";
    var WRAP = "ytd-rich-item-renderer,ytd-rich-section-renderer,ytm-rich-item-renderer,ytm-item-section-renderer";
    var SKIP = ".ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container button,.ytp-ad-skip-button-slot button,.ytp-ad-skip-button-slot";
    var CLOSE = ".ytp-ad-overlay-close-button,.ytp-ad-overlay-close-container button";

    var rules = [];
    if (y.hideBanners) rules.push(BAN);
    if (y.hideFeedAds) rules.push(FEED, "[data-yt-h]");
    if (rules.length) addStyle("yt-css", rules.join(",") + "{display:none!important}");
    if (!y.enabled) { var ss = q("#yt-css"); if (ss) ss.disabled = 1; }

    var hasClass = function (el, cl) { return !!el && cl.some(function (c) { return el.classList.contains(c); }); };
    var muted = 0, lastShort = 0;

    function tick() {
      if (!y.enabled) return;
      try {
        // anti-adblock
        if (y.dismissAntiAdblock) {
          var enf = q("ytd-enforcement-message-view-model");
          if (enf) {
            var dlg = enf.closest("tp-yt-paper-dialog"); (dlg || enf).remove();
            var bk = q("tp-yt-iron-overlay-backdrop"); if (bk) bk.remove();
            if (D.body) D.body.style.removeProperty("overflow");
            var vid = q("video"); if (vid && vid.paused) vid.play().catch(function () {});
          }
        }
        // video ads
        if (y.skipVideoAds) {
          var pl = q("#movie_player,.html5-video-player");
          var v = q(".html5-video-player video") || q("video");
          if (hasClass(pl, ["ad-showing", "ad-interrupting"])) {
            var sk = q(SKIP); if (sk) sk.click();
            if (v) {
              if (y.muteAds && !v.muted) { v.muted = 1; muted = 1; }
              if (!sk && isFinite(v.duration) && v.duration > 1) v.currentTime = v.duration - 0.1;
            }
            var cl = q(CLOSE); if (cl) cl.click();
          } else if (v && muted) { v.muted = 0; muted = 0; }
        }
        // shorts ads
        if (y.skipShortsAds && /^\/shorts/.test(P)) {
          var sp = q("#shorts-player");
          var ad = hasClass(sp, ["ad-showing", "ad-interrupting", "ad-created"]) || !!q("ytd-reel-video-renderer ad-slot-renderer,ytd-reel-video-renderer ytd-ad-slot-renderer,ytd-shorts ytd-ad-slot-renderer,ytd-shorts ad-slot-renderer");
          if (ad && Date.now() - lastShort > 700) {
            lastShort = Date.now();
            var nx = q('#navigation-button-down button,button[aria-label="Next video"],button[aria-label="Next Short"]');
            if (nx) nx.click(); else D.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: 1 }));
          }
        }
        // feed wrappers
        if (y.hideFeedAds) qa(FEED).forEach(function (a) { var w = a.closest(WRAP); if (w) w.setAttribute("data-yt-h", ""); });
      } catch (_) {}
    }

    var sch = 0;
    function schedule() { if (!sch) { sch = 1; requestAnimationFrame(function () { sch = 0; tick(); }); } }

    onReady(function () {
      tick();
      if (y.showToggleButton) {
        var b = floatBtn("yt-btn", "⏭", "background:#fff;color:#111;right:16px;bottom:16px", "yt", function () { toggleYT(!C.youtube.enabled); });
        if (b && !y.enabled) b.style.opacity = ".4";
      }
      new MutationObserver(schedule).observe(D.documentElement, { childList: 1, subtree: 1 });
      setInterval(tick, 1e3);
    });
    onHotkey(function () { return y.toggleHotkey; }, function () { toggleYT(!C.youtube.enabled); });
  }

  // ── GM menu ──

  function regMenu() {
    if (typeof GM_registerMenuCommand !== "function") return;
    var h = bare();
    GM_registerMenuCommand("⚙ Web Cleaner", Panel.open);
    GM_registerMenuCommand((C.siteBlocker.enabled ? "⛔ ON" : "✅ OFF") + " toggle", function () { applyEdit("siteBlocker", function () { C.siteBlocker.enabled = !C.siteBlocker.enabled; }, "block"); });
    GM_registerMenuCommand("➕ Block " + h, function () { applyEdit("siteBlocker", function () { if (!C.siteBlocker.custom.includes(h)) C.siteBlocker.custom.push(h); C.siteBlocker.allow = C.siteBlocker.allow.filter(function (d) { return d !== h; }); }, "block"); });
    GM_registerMenuCommand("➖ Allow " + h, function () { applyEdit("siteBlocker", function () { if (!C.siteBlocker.allow.includes(h)) C.siteBlocker.allow.push(h); C.siteBlocker.custom = C.siteBlocker.custom.filter(function (d) { return d !== h; }); }, "block"); });
    if (isFB) GM_registerMenuCommand("🧹 FB " + (C.facebook.enabled ? "ON" : "OFF"), function () { toggleFB(!C.facebook.enabled); });
    if (isYT) GM_registerMenuCommand("⏭ YT " + (C.youtube.enabled ? "ON" : "OFF"), function () { toggleYT(!C.youtube.enabled); });
    GM_registerMenuCommand("🖥 Desktop", function () { setVM("desktop"); });
    GM_registerMenuCommand("📱 Mobile", function () { setVM("mobile"); });
    GM_registerMenuCommand("↺ Auto", function () { setVM("auto"); });
  }

  // ── boot ──

  try { initSB(); } catch (_) {}
  try { initVM(); } catch (_) {}
  if (isFB) try { initFB(); } catch (_) {}
  if (isYT) try { initYT(); } catch (_) {}
  regMenu();
})();