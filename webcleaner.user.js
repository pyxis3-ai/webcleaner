// ==UserScript==
// @name         Web Cleaner
// @namespace    https://local/webcleaner
// @version      8.17.0
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
  const isLI = /^(www\.|[a-z]{2}\.)?linkedin\.com$/.test(HOST);

  const FOCUS =
    "facebook.com youtube.com instagram.com tiktok.com x.com twitter.com reddit.com snapchat.com threads.net pinterest.com tumblr.com linkedin.com twitch.tv netflix.com hulu.com dailymotion.com news.ycombinator.com cnn.com bbc.com dailymail.co.uk foxnews.com buzzfeed.com 9gag.com imgur.com boredpanda.com amazon.com ebay.com aliexpress.com temu.com shein.com".split(
      " ",
    );
  const ADULT = "pornhub.com xvideos.com xnxx.com xhamster.com redtube.com youporn.com spankbang.com onlyfans.com chaturbate.com stripchat.com".split(" ");
  const ADULT_RE = /(porn|xvideos|xhamster|hentai|camsoda|chaturbate|brazzers|onlyfans|nsfw|sexcam|sextube|camgirl)/i;

  const BOUNDS = {
    snoozeMinutes: [1, 1440],
    desktopWidth: [320, 7680],
    mobileWidth: [240, 1080],
    mobileHeight: [400, 2400],
    mobileDpr: [0.5, 5],
    longPressMs: [100, 5000],
    feedMaxWidth: [500, 3000],
  };

  const DEF = {
    facebook: {
      enabled: true,
      hideSponsored: true,
      hideSuggested: true,
      hidePeopleYouMayKnow: true,
      hideFollowSuggestions: true,
      hideEmptyCards: true,
      hideAIContent: true,
      hideReelsTrays: true,
      hideComments: false,
      hideVideoAutoplay: true,
      hideLikeCounts: false,
      stripTracking: true,
      showToggleButton: true,
      hideRightSidebar: true,
      hideLeftSidebar: true,
      hideComposer: true,
      hideTopBar: true,
      skipReelsAds: true,
      forceMostRecent: true,
      widenFeed: true,
      feedMaxWidth: 1100,
      extraJunkPhrases: [],
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "f" },
    },
    youtube: {
      enabled: true,
      blockAdData: true,
      skipVideoAds: true,
      skipShortsAds: true,
      hideFeedAds: true,
      hideBanners: true,
      muteAds: true,
      dismissAntiAdblock: true,
      hideShorts: false,
      hideEndCards: true,
      hideInfoCards: true,
      hideAutoplay: false,
      hideRelated: true,
      hideComments: false,
      hideChips: true,
      hideMerch: true,
      hideLiveChat: false,
      widenPlayer: true,
      seekPastAds: true,
      showToggleButton: true,
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "y" },
    },
    linkedin: {
      enabled: true,
      hidePromoted: true,
      hideSuggested: true,
      hideTopBar: false,
      hideLeftRail: true,
      hideRightRail: true,
      widenFeed: true,
      feedMaxWidth: 900,
      showToggleButton: true,
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "l" },
    },
    siteBlocker: {
      enabled: true,
      blockAdult: true,
      blockFocus: false,
      scheduleOn: false,
      snoozeMinutes: 5,
      schedule: { days: [1, 2, 3, 4, 5], from: "09:00", to: "18:00" },
      custom: [],
      allow: [],
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "b" },
    },
    viewMode: {
      newSiteDefault: "auto",
      showButton: true,
      spoofUA: true,
      spoofTouch: true,
      spoofMedia: true,
      reflowCss: true,
      frameOnDesktop: false,
      longPressMs: 500,
      desktopWidth: 1280,
      mobileWidth: 412,
      mobileHeight: 915,
      mobileDpr: 2.625,
      mobileUA: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",
      desktopUA: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      toggleHotkey: { ctrl: false, alt: true, shift: true, key: "v" },
    },
  };

  const NEEDS_SCROLL_ANCHOR = !(window.CSS && CSS.supports && CSS.supports("overflow-anchor", "auto"));
  const ric = window.requestIdleCallback?.bind(window);
  const idle = ric ? (fn) => ric(fn, { timeout: 250 }) : requestAnimationFrame;
  const debounced = (fn) => {
    let queued = false;
    return () => {
      if (queued) return;
      queued = true;
      idle(() => {
        queued = false;
        try {
          fn();
        } catch (_) {}
      });
    };
  };

  const NODE_ST = new WeakMap();
  const rec = (el) => {
    let r = NODE_ST.get(el);
    if (!r) NODE_ST.set(el, (r = { sig: -1, keep: 0, empty: 0, v: null, hidden: false }));
    return r;
  };
  const fresh = (el, mark) => {
    const r = rec(el);
    const sig = (el.textContent || "").length;
    if (r.sig !== sig) {
      r.sig = sig;
      r.keep = 0;
      r.empty = 0;
      if (r.hidden) el.removeAttribute(mark);
      r.hidden = false;
      r.v = null;
    }
    return r;
  };

  const PFX = "wc7_";
  const VERSION = "8.17.0";
  const GMNS = typeof GM !== "undefined" && GM ? GM : null;
  const gmModern = !!(GMNS && typeof GMNS.getValue === "function" && typeof GMNS.setValue === "function");
  const gmLegacy = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  const gGet = (k, d) => {
    if (gmLegacy)
      try {
        const v = GM_getValue(PFX + k, "__M__");
        if (v !== "__M__") return v;
      } catch (_) {}
    try {
      const r = localStorage.getItem(PFX + k);
      return r === null ? d : JSON.parse(r);
    } catch (_) {
      return d;
    }
  };
  const gSet = (k, v) => {
    if (gmLegacy)
      try {
        GM_setValue(PFX + k, v);
      } catch (_) {}
    if (gmModern)
      try {
        Promise.resolve(GMNS.setValue(PFX + k, v)).catch(() => {});
      } catch (_) {}
    try {
      localStorage.setItem(PFX + k, JSON.stringify(v));
    } catch (_) {}
  };
  async function hydrateShared(keys) {
    if (!gmModern) return;
    for (const k of keys) {
      try {
        const v = await GMNS.getValue(PFX + k, "__M__");
        if (v === "__M__") continue;
        const next = JSON.stringify(v);
        if (localStorage.getItem(PFX + k) !== next) localStorage.setItem(PFX + k, next);
      } catch (_) {}
    }
  }

  function deepMerge(d, o) {
    const r = JSON.parse(JSON.stringify(d));
    if (!o || typeof o !== "object" || Array.isArray(o)) return r;
    for (const k of Object.keys(o)) {
      if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
      if (!(k in r)) continue;
      const dv = r[k],
        ov = o[k];
      if (Array.isArray(dv)) {
        if (Array.isArray(ov)) r[k] = ov.filter((x) => typeof x === "string" || typeof x === "number");
        continue;
      }
      if (dv !== null && typeof dv === "object") {
        if (ov !== null && typeof ov === "object" && !Array.isArray(ov)) r[k] = deepMerge(dv, ov);
        continue;
      }
      if (typeof ov !== typeof dv) continue;
      if (typeof ov !== "number") {
        r[k] = ov;
        continue;
      }
      if (!Number.isFinite(ov)) continue;
      r[k] = BOUNDS[k] ? clamp(ov, BOUNDS[k][0], BOUNDS[k][1]) : ov;
    }
    return r;
  }

  const C = {};
  for (const m of Object.keys(DEF)) C[m] = deepMerge(DEF[m], gGet(m, null));
  const save = (m) => gSet(m, C[m]);

  function exportSettings() {
    const data = JSON.stringify(C, null, 2);
    let url,
      revoke = false;
    try {
      url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
      revoke = true;
    } catch (_) {
      url = "data:application/json;charset=utf-8," + encodeURIComponent(data);
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = "webcleaner-settings.json";
    a.style.display = "none";
    (document.body || document.documentElement).appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        a.remove();
        if (revoke) URL.revokeObjectURL(url);
      } catch (_) {}
    }, 1000);
  }

  function importSettings(json) {
    try {
      const data = JSON.parse(json);
      for (const m of Object.keys(DEF)) {
        if (data[m]) {
          C[m] = deepMerge(DEF[m], data[m]);
          save(m);
        }
      }
      location.reload();
    } catch (_) {
      alert("Invalid settings file");
    }
  }

  function resetSettings() {
    for (const m of Object.keys(DEF)) {
      Object.assign(C[m], JSON.parse(JSON.stringify(DEF[m])));
      save(m);
    }
    location.reload();
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  const bare = () => location.hostname.replace(/^www\./, "");
  const STRIP = /[\u200b-\u200f\u202a-\u202e\ufeff\u00ad\u2060]/g;
  const norm = (s) =>
    String(s)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}]/gu, "");
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
  const q = (sel, r) => (r || document).querySelector(sel);
  const qa = (sel, r) => Array.from((r || document).querySelectorAll(sel));
  const onReady = (fn) => (document.body ? fn() : document.addEventListener("DOMContentLoaded", fn));

  const mk = (tag, attrs = {}, text) => {
    const e = document.createElement(tag);
    for (const k of Object.keys(attrs)) k === "style" ? (e.style.cssText = attrs[k]) : e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  };

  const addStyle = (id, css, root) => {
    const p = root || document.head || document.documentElement;
    if (root ? root.querySelector?.(`#${id}`) : document.getElementById(id)) return;
    const s = mk("style", { id });
    s.textContent = css;
    p.appendChild(s);
  };

  const safeHTML = ((pol = null) => {
    if (typeof trustedTypes !== "undefined")
      try {
        pol = trustedTypes.createPolicy("wc7", { createHTML: (s) => s });
      } catch (_) {}
    return (el, html) => {
      try {
        el.innerHTML = pol ? pol.createHTML(html) : html;
        return true;
      } catch (_) {
        try {
          const doc = new DOMParser().parseFromString(`<!DOCTYPE html><html><head></head><body>${html}</body></html>`, "text/html");
          el.textContent = "";
          for (const n of [...doc.head.childNodes, ...doc.body.childNodes]) el.appendChild(document.adoptNode(n));
          return true;
        } catch (_2) {
          return false;
        }
      }
    };
  })();

  const HOSTNAME = /^[\p{L}\p{N}.-]+$/u;
  function cleanHost(raw) {
    const h = (() => {
      try {
        const s = String(raw).trim();
        return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : "https://" + s).hostname.replace(/^www\./, "").toLowerCase();
      } catch (_) {
        return String(raw)
          .trim()
          .replace(/^[a-z]+:\/\//i, "")
          .replace(/[/:?#].*$/, "")
          .replace(/^www\./, "")
          .toLowerCase();
      }
    })();
    return HOSTNAME.test(h) ? h : "";
  }

  const _hotkeys = [];
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.metaKey) return;
      const t = e.target;
      if (t?.isContentEditable || /^(input|textarea|select)$/i.test(t?.tagName || "")) return;
      for (const [gs, h] of _hotkeys) {
        const k = gs();
        if (e.ctrlKey !== !!k.ctrl || e.altKey !== !!k.alt || e.shiftKey !== !!k.shift) continue;
        if ((e.key || "").toLowerCase() !== String(k.key || "").toLowerCase()) continue;
        e.preventDefault();
        h();
        break;
      }
    },
    true,
  );
  const onHotkey = (gs, h) => _hotkeys.push([gs, h]);

  let _navWrapped = false;
  const _navCbs = [];
  function interceptNav(cb) {
    _navCbs.push(cb);
    if (_navWrapped) return;
    _navWrapped = true;
    const fire = () =>
      _navCbs.forEach((fn) => {
        try {
          fn();
        } catch (_) {}
      });
    const w = (orig) =>
      function (...a) {
        const r = orig.apply(this, a);
        fire();
        return r;
      };
    try {
      history.pushState = w(history.pushState);
    } catch (_) {}
    try {
      history.replaceState = w(history.replaceState);
    } catch (_) {}
    window.addEventListener("popstate", fire);
  }

  const defProp = (obj, key, get) => {
    try {
      Object.defineProperty(obj, key, { configurable: true, get });
    } catch (_) {}
  };

  const SPON_LABELS = new Set(["sponsored", "promoted", "gesponsert", "publicidad", "patrocinado", "publicité", "anuncio", "реклама", "広告", "광고", "赞助", "贊助"]);
  const Health = { miss: 0, at: 0 };
  const healthArmed = () => (isFB && C.facebook.enabled && C.facebook.hideSponsored) || (isYT && C.youtube.enabled && C.youtube.hideFeedAds);

  function healthScan() {
    if (!healthArmed()) {
      Health.miss = 0;
      Health.at = Date.now();
      return 0;
    }
    const vh = document.documentElement.clientHeight || 600;
    let miss = 0;
    for (const el of document.querySelectorAll("badge-shape,span,div,p,h3,h4")) {
      if (el.children.length) continue;
      const txt = (el.textContent || "").trim().toLowerCase();
      if (!SPON_LABELS.has(txt)) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh) miss++;
      if (miss > 50) break;
    }
    Health.miss = miss;
    Health.at = Date.now();
    return miss;
  }

  function visText(scope, cap, bt, bb) {
    const g = [];
    let budget = cap || 400;
    const w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    const banded = bt !== undefined;
    let n;
    while ((n = w.nextNode()) && budget-- > 0) {
      const t = n.nodeValue;
      if (!t || !t.trim()) continue;
      const p = n.parentElement;
      if (!p || p.closest('[aria-hidden="true"]')) continue;
      const cs = getComputedStyle(p);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0" || cs.fontSize === "0px") continue;
      const pr = p.getBoundingClientRect();
      if (!pr.width || !pr.height) continue;
      if (banded && (pr.right <= 0 || pr.bottom < bt || pr.top > bb)) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const r = rg.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (banded && (r.right <= 0 || r.top < bt || r.top > bb)) continue;
      g.push({ c: t.trim(), t: Math.round(r.top), l: Math.round(r.left) });
    }
    const seen = new Set(),
      kept = [];
    for (const x of g) {
      const k = x.t + ":" + x.l;
      if (!seen.has(k)) {
        seen.add(k);
        kept.push(x);
      }
    }
    kept.sort((a, b) => a.t - b.t || a.l - b.l);
    return kept
      .map((x) => x.c)
      .join("")
      .replace(STRIP, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tightestMatch(el, marks, fits) {
    if (!fits(el.getBoundingClientRect())) return false;
    const txt = norm(visText(el, 400));
    if (!txt || !marks.some((m) => txt.includes(m))) return false;
    for (const c of el.children) {
      if (!fits(c.getBoundingClientRect())) continue;
      const ct = norm(visText(c, 300));
      if (ct && marks.some((m) => ct.includes(m))) return false;
    }
    return true;
  }

  function rescueSweep(marks, attr, maxHide) {
    if (Health.miss < 1) return 0;
    const vh = document.documentElement.clientHeight || 600;
    const lo = 120,
      hi = Math.max(innerWidth * 0.98, 400);
    let hid = 0;
    for (const el of document.querySelectorAll("div,article,section,li")) {
      if (hid >= (maxHide || 12)) break;
      if (el.__rq) continue;
      const fits = (rr) => rr.width >= lo && rr.width <= hi && rr.height >= 70 && rr.height <= Math.max(vh * 1.6, 900) && rr.bottom >= -400 && rr.top <= vh + 400;
      if (!tightestMatch(el, marks, fits)) continue;
      el.__rq = 1;
      el.setAttribute(attr, "");
      hid++;
    }
    return hid;
  }

  const REAL_MOBILE = (() => {
    const ua = navigator.userAgent,
      tp = navigator.maxTouchPoints;
    return /Mobi|Android|iPhone|iPod|Windows Phone/i.test(ua) || /iPad/.test(ua) || (/Macintosh/.test(ua) && tp > 1) || navigator.userAgentData?.mobile === true;
  })();

  const VM_MODES = ["desktop", "mobile", "auto"];
  const vmOf = (s) => (VM_MODES.includes(s) ? s : null);
  const vmMode =
    vmOf(
      (() => {
        try {
          return localStorage.getItem(PFX + "vm");
        } catch (_) {
          return null;
        }
      })(),
    ) ||
    vmOf(C.viewMode.newSiteDefault) ||
    "auto";
  const vmActive = () => vmMode !== "auto";
  const setVM = (m) => {
    try {
      localStorage.setItem(PFX + "vm", m);
    } catch (_) {}
    location.reload();
  };

  const MQ_TRUE = "(min-width:0px)";
  const U2PX = (n, u) => (/^px$/i.test(u) ? +n : +n * 16);

  function mqRewrite(text, vw, tm, orient) {
    if (!text) return null;
    let hit = false;
    const out = String(text)
      .split(",")
      .map((part) => {
        if (/^\s*not\b/i.test(part)) return part;
        let kill = false,
          touched = false;
        const T = () => {
          touched = true;
          return MQ_TRUE;
        };
        const F = () => {
          touched = true;
          kill = true;
          return MQ_TRUE;
        };
        let s = part;
        s = s.replace(/\(\s*(min|max)-(?:device-)?width\s*:\s*([\d.]+)(px|r?em)\s*\)/gi, (m, k, n, u) => {
          const val = U2PX(n, u);
          return (/^min$/i.test(k) ? vw >= val : vw <= val) ? T() : F();
        });
        s = s.replace(/\(\s*(?:device-)?width\s*:\s*([\d.]+)(px|r?em)\s*\)/gi, (m, n, u) => (vw === U2PX(n, u) ? T() : F()));
        s = s.replace(/\(\s*(?:device-)?width\s*(<=|>=|<|>)\s*([\d.]+)(px|r?em)\s*\)/gi, (m, o, n, u) => {
          const val = U2PX(n, u);
          return (o === "<=" ? vw <= val : o === ">=" ? vw >= val : o === "<" ? vw < val : vw > val) ? T() : F();
        });
        s = s.replace(/\(\s*([\d.]+)(px|r?em)\s*(<=|<)\s*(?:device-)?width\s*(?:(<=|<)\s*([\d.]+)(px|r?em)\s*)?\)/gi, (m, n1, u1, o1, o2, n2, u2) => {
          const a = U2PX(n1, u1);
          let ok = o1 === "<=" ? a <= vw : a < vw;
          if (ok && o2) {
            const b = U2PX(n2, u2);
            ok = o2 === "<=" ? vw <= b : vw < b;
          }
          return ok ? T() : F();
        });
        s = s.replace(/\(\s*([\d.]+)(px|r?em)\s*(>=|>)\s*(?:device-)?width\s*\)/gi, (m, n, u, o) => {
          const a = U2PX(n, u);
          return (o === ">=" ? a >= vw : a > vw) ? T() : F();
        });
        s = s.replace(/\(\s*(?:any-)?pointer\s*:\s*(coarse|fine|none)\s*\)/gi, (m, k) => (k.toLowerCase() === (tm ? "coarse" : "fine") ? T() : F()));
        s = s.replace(/\(\s*(?:any-)?hover\s*:\s*(hover|none)\s*\)/gi, (m, k) => (k.toLowerCase() === (tm ? "none" : "hover") ? T() : F()));
        if (orient) s = s.replace(/\(\s*orientation\s*:\s*(portrait|landscape)\s*\)/gi, (m, k) => (k.toLowerCase() === orient ? T() : F()));
        if (!touched) return part;
        hit = true;
        return kill ? "not all" : s;
      });
    if (!hit) return null;
    return out.every((x) => x === "not all") ? "not all" : out.join(",");
  }

  const _mqDone = new WeakSet();
  function reflowSheets(vw, tm, orient, deep) {
    let n = 0;
    const fix = (ml) => {
      try {
        const r = mqRewrite(ml.mediaText, vw, tm, orient);
        if (r !== null) {
          ml.mediaText = r;
          n++;
        }
      } catch (_) {}
    };
    const walk = (rules) => {
      for (const r of rules) {
        if (r.type === 4) {
          fix(r.media);
          try {
            walk(r.cssRules);
          } catch (_) {}
        } else if (r.type === 3) {
          try {
            walk(r.styleSheet.cssRules);
          } catch (_) {}
        }
      }
    };
    const sheet = (ss) => {
      if (!ss || _mqDone.has(ss)) return;
      let rules = null;
      try {
        rules = ss.cssRules;
      } catch (_) {
        return;
      }
      if (!rules || !rules.length) return;
      _mqDone.add(ss);
      try {
        if (ss.media) fix(ss.media);
      } catch (_) {}
      try {
        walk(rules);
      } catch (_) {}
    };
    const scope = (r) => {
      try {
        for (const ss of Array.from(r.styleSheets || [])) sheet(ss);
      } catch (_) {}
      try {
        for (const ss of Array.from(r.adoptedStyleSheets || [])) sheet(ss);
      } catch (_) {}
    };
    scope(document);
    for (const el of qa('link[rel~="stylesheet"][media],style[media]')) {
      if (el.__mqd) continue;
      el.__mqd = 1;
      const r = mqRewrite(el.getAttribute("media"), vw, tm, orient);
      if (r !== null) el.setAttribute("media", r);
    }
    if (deep) {
      let all = [];
      try {
        all = document.getElementsByTagName("*");
      } catch (_) {}
      for (const el of all) {
        if (el.shadowRoot) scope(el.shadowRoot);
      }
    }
    return n;
  }

  function applyVMSpoof() {
    const v = C.viewMode;
    if (vmMode === "auto") return;
    const tm = vmMode === "mobile";
    if (v.spoofUA) {
      const ua = tm ? v.mobileUA : v.desktopUA;
      defProp(navigator, "userAgent", () => ua);
      defProp(navigator, "appVersion", () => ua.replace(/^Mozilla\//, ""));
      defProp(navigator, "platform", () => (tm ? "Linux armv8l" : "Win32"));
      defProp(navigator, "vendor", () => "Google Inc.");
      try {
        const br = navigator.userAgentData?.brands ?? [];
        defProp(navigator, "userAgentData", () => ({
          mobile: tm,
          platform: tm ? "Android" : "Windows",
          brands: br,
          getHighEntropyValues: () => Promise.resolve({ mobile: tm, platform: tm ? "Android" : "Windows" }),
          toJSON: () => ({ mobile: tm, platform: tm ? "Android" : "Windows", brands: br }),
        }));
      } catch (_) {}
    }
    if (v.spoofTouch) {
      defProp(navigator, "maxTouchPoints", () => (tm ? 5 : 0));
      try {
        if (tm && !("ontouchstart" in window)) window.ontouchstart = null;
      } catch (_) {}
    }
    if (v.spoofMedia) {
      const ew = tm ? v.mobileWidth : v.desktopWidth,
        nat = window.matchMedia?.bind(window) ?? null;
      const orient = tm && !REAL_MOBILE ? (v.mobileWidth <= v.mobileHeight ? "portrait" : "landscape") : null;
      window.matchMedia = (query) => {
        const rw = mqRewrite(query, ew, tm, orient);
        if (!nat)
          return {
            matches: false,
            media: String(query),
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent() {
              return false;
            },
          };
        const mql = nat(rw === null ? query : rw);
        if (rw === null) return mql;
        try {
          return new Proxy(mql, {
            get(t, p) {
              if (p === "media") return String(query);
              const val = t[p];
              return typeof val === "function" ? val.bind(t) : val;
            },
          });
        } catch (_) {
          return mql;
        }
      };
      if (tm && !REAL_MOBILE && v.frameOnDesktop) {
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

  const sbMatch = (list) => {
    if (!Array.isArray(list)) return false;
    const h = bare();
    return list.some((d) => typeof d === "string" && d && (h === d || h.endsWith("." + d)));
  };
  const sbSnoozed = () => Date.now() < gGet("snz", 0);
  const sbSnooze = (m) => gSet("snz", Date.now() + m * 60000);

  const hhmm = (s, dflt) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
    if (!m) return dflt;
    const h = +m[1],
      mi = +m[2];
    return h > 23 || mi > 59 ? dflt : h * 60 + mi;
  };

  function sbInSchedule() {
    const { scheduleOn, schedule: sc } = C.siteBlocker;
    if (!scheduleOn || !sc || !Array.isArray(sc.days) || !sc.days.includes(new Date().getDay())) return false;
    const now = new Date(),
      cur = now.getHours() * 60 + now.getMinutes();
    const from = hhmm(sc.from, null),
      to = hhmm(sc.to, null);
    if (from === null || to === null || from === to) return false;
    return from < to ? cur >= from && cur < to : cur >= from || cur < to;
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
    mutate();
    save(mod);
    (affects === "block" ? before !== !!blockReason() : !!affects) ? location.reload() : Panel.refresh();
  }

  function initVM() {
    const v = C.viewMode;
    onHotkey(
      () => v.toggleHotkey,
      () => setVM(vmMode === "desktop" ? "mobile" : "desktop"),
    );
    if (vmMode === "auto") return;
    const deskMob = vmMode === "mobile" && !REAL_MOBILE;
    const useFrame = deskMob && v.frameOnDesktop;
    const doReflow = deskMob && v.reflowCss;
    const vw = v.mobileWidth;
    const orient = v.mobileWidth <= v.mobileHeight ? "portrait" : "landscape";

    function applyVP() {
      if (!REAL_MOBILE) return;
      const root = document.head || document.documentElement;
      if (!root) return;
      const want = vmMode === "desktop" ? `width=${v.desktopWidth}` : "width=device-width,initial-scale=1,viewport-fit=cover";
      const foreign = qa('meta[name="viewport"]').filter((e) => !e.hasAttribute("data-wc"));
      let m = q('meta[name="viewport"][data-wc]');
      if (!foreign.length && m && m.getAttribute("content") === want) return;
      foreign.forEach((e) => e.remove());
      if (!m) {
        m = mk("meta", { name: "viewport", "data-wc": "1" });
        root.appendChild(m);
      }
      if (m.getAttribute("content") !== want) m.setAttribute("content", want);
    }

    function applyFrame() {
      if (!useFrame || !document.documentElement) return;
      const w = v.mobileWidth;
      addStyle(
        "vm-frame",
        `html.vm-f{width:${w}px!important;min-width:${w}px!important;max-width:${w}px!important;margin:0 auto!important;min-height:100vh!important;overflow-x:hidden!important;transform:translateZ(0)!important;transform-origin:top center!important;box-shadow:0 0 0 100vmax #202124,0 0 40px rgba(0,0,0,.6)!important}html.vm-f>body{width:${w}px!important;min-width:${w}px!important;max-width:${w}px!important;margin:0!important;min-height:100vh!important;overflow-x:hidden!important}`,
      );
      document.documentElement.classList.add("vm-f");
    }

    const beat = (deep) => {
      try {
        applyVP();
      } catch (_) {}
      try {
        applyFrame();
      } catch (_) {}
      try {
        if (doReflow) reflowSheets(vw, true, orient, deep);
      } catch (_) {}
    };
    const pump = debounced(() => beat(false));
    const deepBeat = () => beat(true);

    beat(true);
    const root = document.head || document.documentElement;
    if (root && window.MutationObserver) new MutationObserver(pump).observe(root, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", deepBeat);
    window.addEventListener("load", deepBeat);
    [100, 300, 600, 1200, 2500, 4000].forEach((t) => setTimeout(deepBeat, t));
    if (!root) {
      let observing = false;
      [0, 16, 50].forEach((t) =>
        setTimeout(() => {
          const r = document.head || document.documentElement;
          if (r && window.MutationObserver && !observing) {
            observing = true;
            new MutationObserver(pump).observe(r, { childList: true, subtree: true });
          }
          deepBeat();
        }, t),
      );
    }
  }

  const keyLabel = (h) => (h.ctrl ? "Ctrl+" : "") + (h.alt ? "Alt+" : "") + (h.shift ? "Shift+" : "") + String(h.key || "").toUpperCase();
  const sw = (l, m, k) => `<div class="r"><span>${esc(l)}</span><label class="sw"><input type="checkbox" data-sw="${m}.${k}"${C[m][k] ? " checked" : ""}><span class="tk"></span></label></div>`;
  const sw2 = (l1, m1, k1, l2, m2, k2) =>
    `<div class="r2"><span>${esc(l1)}</span><label class="sw"><input type="checkbox" data-sw="${m1}.${k1}"${C[m1][k1] ? " checked" : ""}><span class="tk"></span></label><span style="margin-left:auto">${esc(l2)}</span><label class="sw"><input type="checkbox" data-sw="${m2}.${k2}"${C[m2][k2] ? " checked" : ""}><span class="tk"></span></label></div>`;
  const num2 = (l1, m1, k1, l2, m2, k2) =>
    `<div class="r2"><span>${esc(l1)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m1}.${k1}" value="${esc(C[m1][k1])}"><span style="margin-left:auto">${esc(l2)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m2}.${k2}" value="${esc(C[m2][k2])}"></div>`;
  const time2 = (l1, m, k1, l2, k2) =>
    `<div class="r2"><span>${esc(l1)}</span><input class="tm" type="time" data-time="${m}.${k1}" value="${esc(C[m].schedule[k1])}"><span style="margin-left:auto">${esc(l2)}</span><input class="tm" type="time" data-time="${m}.${k2}" value="${esc(C[m].schedule[k2])}"></div>`;
  const numR = (l, m, k) => `<div class="r"><span>${esc(l)}</span><input class="nm" type="number" inputmode="decimal" data-num="${m}.${k}" value="${esc(C[m][k])}"></div>`;
  const txtR = (l, m, k) =>
    `<div class="fr"><span style="font-size:11px;color:#888">${esc(l)}</span><input class="tx" type="text" autocorrect="off" autocapitalize="none" data-txt="${m}.${k}" value="${esc(C[m][k])}"></div>`;
  const hkR = (m) => `<div class="r"><span>Shortcut</span><button class="hk" data-hk="${m}">${esc(keyLabel(C[m].toggleHotkey))}</button></div>`;
  const swG = (mod, pairs) => `<div class="gr">${pairs.map(([l, k]) => sw(l, mod, k)).join("")}</div>`;

  function listBlock(label, mod, key, ph) {
    const arr = C[mod][key],
      path = `${mod}.${key}`;
    const items = arr.length
      ? arr.map((d) => `<div class="it"><span title="${esc(d)}">${esc(d)}</span><button class="dl" data-dl="${path}" data-v="${esc(d)}">✕</button></div>`).join("")
      : `<div class="em">Empty</div>`;
    return `<div class="sc"><h2>${esc(label)}</h2>${items}<div class="ad"><input type="text" autocorrect="off" autocapitalize="none" data-ai="${path}" placeholder="${esc(ph)}"><button data-ab="${path}">+</button></div></div>`;
  }

  function packHtml(sites) {
    return `<div class="pg">${sites
      .map((d) => {
        const on = C.siteBlocker.allow.includes(d);
        return `<button class="pl ${on ? "al" : "bl"}" data-pk="${esc(d)}">${esc(d)}</button>`;
      })
      .join("")}</div>`;
  }

  function focusState() {
    const s = C.siteBlocker;
    const inSched = sbInSchedule();
    const active = s.blockFocus || inSched;
    const why = s.blockFocus
      ? "Focus switch is on"
      : inSched
        ? `inside schedule ${esc(s.schedule.from)}–${esc(s.schedule.to)}`
        : s.scheduleOn
          ? `outside schedule ${esc(s.schedule.from)}–${esc(s.schedule.to)}`
          : "Focus switch off and schedule off";
    const hereBlocked = active && sbMatch(FOCUS) && !sbMatch(s.allow);
    const col = active ? "#e6b34d" : "#7a7a7a";
    return `<div class="cu" style="color:${col};padding:3px 0">${active ? "●" : "○"} Focus pack ${active ? "BLOCKING NOW" : "not blocking"} (${why})${hereBlocked ? ` — <b>${esc(bare())} is blocked</b>` : sbMatch(FOCUS) ? ` — ${esc(bare())} is in the pack` : ""}</div>`;
  }

  const secSB = () => {
    const s = C.siteBlocker;
    return `<details data-s=sb open><summary>⛔ Blocker ${s.enabled ? "ON" : "OFF"}</summary>${sw(HOST, "siteBlocker", "enabled")}${sw2("Adult", "siteBlocker", "blockAdult", "Focus", "siteBlocker", "blockFocus")}${sw("Schedule (" + esc(s.schedule.from) + "–" + esc(s.schedule.to) + ")", "siteBlocker", "scheduleOn")}${focusState()}${sbSnoozed() ? `<div class="cu snz">⏱ Snoozed — tap cancel</div>` : ""}${listBlock("Blocked", "siteBlocker", "custom", "example.com")}${listBlock("Allowed", "siteBlocker", "allow", "example.com")}<details data-s=focus><summary>Focus (${FOCUS.length})</summary>${packHtml(FOCUS)}</details><details data-s=adult><summary>Adult (${ADULT.length})</summary>${packHtml(ADULT)}</details><details data-s=sb-adv><summary>Advanced</summary>${time2("From", "siteBlocker", "from", "To", "to")}${numR("Snooze min", "siteBlocker", "snoozeMinutes")}${hkR("siteBlocker")}</details></details>`;
  };

  const secVM = () => {
    const v = C.viewMode,
      modes = VM_MODES;
    const seg = (val, attr) => `<button class="${(attr === "data-vm" ? vmMode : v.newSiteDefault) === val ? "on" : ""}" ${attr}="${val}">${val[0].toUpperCase() + val.slice(1)}</button>`;
    return `<details data-s=vm><summary>🖥 View ${vmMode.toUpperCase()}</summary><div class="r2"><span>Site</span><div class="sg">${modes.map((m) => seg(m, "data-vm")).join("")}</div><span style="margin-left:auto">Def</span><div class="sg">${modes.map((m) => seg(m, "data-df")).join("")}</div></div>${swG(
      "viewMode",
      [
        ["UA", "spoofUA"],
        ["Touch", "spoofTouch"],
        ["Media", "spoofMedia"],
        ["Reflow CSS", "reflowCss"],
        ["Frame", "frameOnDesktop"],
        ["Button", "showButton"],
      ],
    )}<details data-s=vm-adv><summary>Advanced</summary>${num2("DeskW", "viewMode", "desktopWidth", "MobW", "viewMode", "mobileWidth")}${num2("MobH", "viewMode", "mobileHeight", "DPR", "viewMode", "mobileDpr")}${numR("Long-press ms", "viewMode", "longPressMs")}${txtR("Mobile UA", "viewMode", "mobileUA")}${txtR("Desktop UA", "viewMode", "desktopUA")}${hkR("viewMode")}</details></details>`;
  };

  const secFB = () =>
    `<details data-s=facebook><summary>🧹 FB ${C.facebook.enabled ? "ON" : "OFF"}</summary>${swG("facebook", [
      ["On", "enabled"],
      ["Sponsored", "hideSponsored"],
      ["Suggested", "hideSuggested"],
      ["People YMKN", "hidePeopleYouMayKnow"],
      ["Follow suggestions", "hideFollowSuggestions"],
      ["Empty cards", "hideEmptyCards"],
      ["AI content", "hideAIContent"],
      ["Reels/Stories", "hideReelsTrays"],
      ["Comments", "hideComments"],
      ["Video autoplay", "hideVideoAutoplay"],
      ["Like counts", "hideLikeCounts"],
      ["R.sidebar", "hideRightSidebar"],
      ["L.sidebar", "hideLeftSidebar"],
      ["Composer", "hideComposer"],
      ["Top bar", "hideTopBar"],
      ["Tracking", "stripTracking"],
      ["Reel ads", "skipReelsAds"],
      ["Most Recent", "forceMostRecent"],
      ["Widen feed", "widenFeed"],
      ["Button", "showToggleButton"],
    ])}${listBlock("Junk phrases", "facebook", "extraJunkPhrases", "phrase")}<details data-s=fb-adv><summary>Advanced</summary>${numR("Feed max width", "facebook", "feedMaxWidth")}${hkR("facebook")}</details></details>`;

  const secYT = () =>
    `<details data-s=youtube><summary>⏭ YT ${C.youtube.enabled ? "ON" : "OFF"}</summary>${swG("youtube", [
      ["On", "enabled"],
      ["Block ad data", "blockAdData"],
      ["Video ads", "skipVideoAds"],
      ["Shorts ads", "skipShortsAds"],
      ["Feed ads", "hideFeedAds"],
      ["Banners", "hideBanners"],
      ["Mute ads", "muteAds"],
      ["Anti-AB", "dismissAntiAdblock"],
      ["Hide Shorts", "hideShorts"],
      ["End cards", "hideEndCards"],
      ["Info cards", "hideInfoCards"],
      ["Autoplay", "hideAutoplay"],
      ["Related", "hideRelated"],
      ["Comments", "hideComments"],
      ["Chips", "hideChips"],
      ["Merch/promos", "hideMerch"],
      ["Live chat", "hideLiveChat"],
      ["Widen player", "widenPlayer"],
      ["Seek past ads", "seekPastAds"],
      ["Button", "showToggleButton"],
    ])}<details data-s=yt-adv><summary>Advanced</summary>${hkR("youtube")}</details></details>`;

  const secLI = () =>
    `<details data-s=linkedin><summary>💼 LinkedIn ${C.linkedin.enabled ? "ON" : "OFF"}</summary>${swG("linkedin", [
      ["On", "enabled"],
      ["Promoted", "hidePromoted"],
      ["Suggested", "hideSuggested"],
      ["Top bar", "hideTopBar"],
      ["L.rail", "hideLeftRail"],
      ["R.rail", "hideRightRail"],
      ["Widen feed", "widenFeed"],
      ["Button", "showToggleButton"],
    ])}<details data-s=li-adv><summary>Advanced</summary>${numR("Feed max width", "linkedin", "feedMaxWidth")}${hkR("linkedin")}</details></details>`;

  const secIO = () =>
    `<details data-s=io><summary>⚙ Import / Export</summary><div class="r"><span>Export settings</span><button class="hk" data-export>Save file</button></div><div class="fr"><span style="font-size:11px;color:#888">Import settings (paste JSON)</span><textarea class="tx" rows="3" style="resize:vertical" data-import placeholder="Paste exported JSON here…"></textarea><button class="hk" style="margin-top:4px;width:100%" data-importbtn>Import</button></div><div class="r"><span>Reset all to defaults</span><button class="hk" style="color:#f66" data-reset>Reset</button></div></details>`;

  const PCSS = `:host{all:initial}*{box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}.bk{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646;-webkit-tap-highlight-color:transparent}.cd{position:fixed;inset:0;margin:auto;width:min(600px,calc(100vw - 16px));height:fit-content;max-height:min(92dvh,900px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#18191c;color:#ddd;border-radius:14px;padding:12px 10px;box-shadow:0 12px 40px rgba(0,0,0,.7);z-index:2147483647;font-size:13px;line-height:1.35}.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}.hd h1{font-size:15px;font-weight:700;margin:0}.x{background:#2a2a2f;border:0;color:#ccc;font-size:14px;cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;-webkit-appearance:none}.r{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 0;border-top:1px solid #27282c}.r>span{flex:1;font-size:12px;line-height:1.2}.r2{display:flex;align-items:center;gap:6px;padding:5px 0;border-top:1px solid #27282c;flex-wrap:wrap}.r2>span{font-size:12px}.fr{display:flex;flex-direction:column;gap:3px;padding:5px 0;border-top:1px solid #27282c}.cu{font-size:10px;color:#888;margin-top:1px}.snz{cursor:pointer;text-decoration:underline}.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));column-gap:12px}.gr .r{min-width:0}.gr .r>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc{margin-top:6px}.sc>h2{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#777;margin:0 0 1px}.it{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4px 0;border-top:1px solid #27282c}.it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px}.dl{background:none;border:0;color:#f66;cursor:pointer;padding:0;width:24px;height:24px;font-size:13px;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;border-radius:50%}.dl:active{background:#2a2a2f}.ad{display:flex;gap:4px;margin-top:4px}.ad input{flex:1;min-width:0;background:#111;border:1px solid #333;color:#ddd;border-radius:8px;padding:6px 8px;font-size:13px;-webkit-appearance:none}.ad input:focus{border-color:#3a7afe;outline:none}.ad button{background:#3a7afe;border:0;color:#fff;border-radius:8px;cursor:pointer;padding:0 12px;font-size:14px;-webkit-appearance:none;font-weight:700}.em{color:#666;font-style:italic;padding:4px 0;border-top:1px solid #27282c;font-size:11px}.sw{position:relative;display:inline-block;width:36px;height:20px;flex:0 0 auto}.sw input{opacity:0;width:0;height:0;position:absolute}.tk{position:absolute;inset:0;background:#3a3b42;border-radius:999px;transition:.15s;cursor:pointer}.tk::before{content:"";position:absolute;width:16px;height:16px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.15s;box-shadow:0 1px 3px rgba(0,0,0,.25)}.sw input:checked+.tk{background:#34c759}.sw input:checked+.tk::before{transform:translateX(16px)}details{margin-top:2px}summary{cursor:pointer;padding:5px 0;color:#aaa;border-top:1px solid #27282c;list-style:none;user-select:none;font-weight:600;font-size:12px;display:flex;align-items:center;gap:3px}summary::-webkit-details-marker{display:none}details[open]>summary::after{content:"▲";font-size:7px;color:#666;margin-left:auto}details:not([open])>summary::after{content:"▼";font-size:7px;color:#666;margin-left:auto}.pl{border:0;border-radius:6px;cursor:pointer;padding:2px 7px;font-size:10px;-webkit-appearance:none;font-weight:500}.bl{background:#3a2b2b;color:#f99}.al{background:#1e3020;color:#7e9}.pg{display:flex;flex-wrap:wrap;gap:3px;padding:4px 0}.nm{width:64px;background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:4px 6px;font-size:12px;text-align:right;-webkit-appearance:none}.tm{background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:4px 6px;font-size:12px;-webkit-appearance:none;width:80px}.tx{background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:5px 7px;font-size:11px;width:100%;-webkit-appearance:none}.nm:focus,.tm:focus,.tx:focus{border-color:#3a7afe;outline:none}.hk{background:#2a2a2f;border:0;color:#ddd;border-radius:6px;cursor:pointer;padding:4px 8px;font-size:11px;-webkit-appearance:none}.hk.arm{background:#3a7afe;color:#fff}.sg{display:flex;gap:3px;flex:0 0 auto}.sg button{flex:1;background:#2a2a2f;border:0;color:#bbb;border-radius:6px;cursor:pointer;padding:4px 6px;font-size:11px;-webkit-appearance:none;white-space:nowrap}.sg button.on{background:#3a7afe;color:#fff;font-weight:600}`;

  const Panel = (() => {
    let root = null,
      capFn = null,
      armed = null;
    const affects = (m) => (m === "siteBlocker" ? "block" : m === "facebook" ? isFB : m === "youtube" ? isYT : m === "linkedin" ? isLI : m === "viewMode" ? vmActive() : false);
    const edit = (m, fn) => {
      armed = null;
      applyEdit(m, fn, affects(m));
    };
    const onEsc = (e) => {
      if (!armed && e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };

    function degraded(sh) {
      sh.textContent = "";
      root.style.pointerEvents = "none";
      const box = mk("div", {
        style:
          "position:fixed;right:12px;bottom:64px;max-width:300px;pointer-events:auto;background:#18191c;color:#ddd;padding:12px 14px;border-radius:12px;font:13px -apple-system,system-ui,sans-serif;line-height:1.4;box-shadow:0 8px 30px rgba(0,0,0,.6)",
      });
      box.appendChild(mk("div", { style: "font-weight:700;margin-bottom:5px" }, "🧼 Web Cleaner"));
      box.appendChild(mk("div", { style: "opacity:.75" }, "This site's security policy blocks the settings panel. Use your userscript manager menu or the keyboard shortcuts instead."));
      const b = mk("button", { style: "margin-top:9px;padding:5px 11px;border:0;border-radius:8px;background:#2a2a2f;color:#ddd;cursor:pointer;font-size:12px" }, "Close");
      b.addEventListener("click", close);
      box.appendChild(b);
      sh.appendChild(box);
    }

    function render() {
      const sh = root.shadowRoot,
        om = {};
      qa("details[data-s]", sh).forEach((d) => {
        om[d.getAttribute("data-s")] = d.open;
      });
      const hm = healthScan();
      const warn =
        hm > 0
          ? `<div class="cu" style="color:#e6b34d;padding:4px 0;border-top:1px solid #27282c">⚠ ${hm} sponsored label${hm > 1 ? "s" : ""} still visible — this site's markup may have changed. Filtering is degraded, not broken.</div>`
          : "";
      const ok = safeHTML(
        sh,
        `<style>${PCSS}</style><div class="bk" data-x></div><div class="cd" role="dialog"><div class="hd"><h1>🧼 Web Cleaner <span style="font-size:10px;font-weight:400;color:#777">v${esc(VERSION)}</span></h1><button class="x" data-x>✕</button></div>${warn}${secSB()}${secVM()}${isFB ? secFB() : ""}${isYT ? secYT() : ""}${isLI ? secLI() : ""}${secIO()}</div>`,
      );
      if (!ok) {
        degraded(sh);
        return;
      }
      qa("details[data-s]", sh).forEach((d) => {
        if (om[d.getAttribute("data-s")]) d.open = true;
      });
      wire(sh);
    }

    function wire(sh) {
      qa("[data-x]", sh).forEach((e) => e.addEventListener("click", close));
      sh.querySelector(".snz")?.addEventListener("click", () => {
        gSet("snz", 0);
        location.reload();
      });

      qa("[data-sw]", sh).forEach((e) =>
        e.addEventListener("change", () => {
          const [m, k] = e.getAttribute("data-sw").split(".");
          if (m === "facebook" && k === "enabled") {
            toggleFB(e.checked);
            render();
            return;
          }
          if (m === "youtube" && k === "enabled") {
            toggleYT(e.checked);
            render();
            return;
          }
          if (m === "linkedin" && k === "enabled") {
            toggleLI(e.checked);
            render();
            return;
          }
          edit(m, () => {
            C[m][k] = e.checked;
          });
        }),
      );

      qa("[data-num]", sh).forEach((e) =>
        e.addEventListener("change", () => {
          const [m, k] = e.getAttribute("data-num").split(".");
          let v = parseFloat(e.value);
          if (!isFinite(v) || v <= 0) {
            render();
            return;
          }
          if (BOUNDS[k]) v = clamp(v, BOUNDS[k][0], BOUNDS[k][1]);
          edit(m, () => {
            C[m][k] = v;
          });
        }),
      );

      qa("[data-txt]", sh).forEach((e) =>
        e.addEventListener("change", () => {
          const [m, k] = e.getAttribute("data-txt").split(".");
          const v = e.value.trim();
          if (!v) {
            render();
            return;
          }
          edit(m, () => {
            C[m][k] = v;
          });
        }),
      );

      qa("[data-time]", sh).forEach((e) =>
        e.addEventListener("change", () => {
          const k = e.getAttribute("data-time").split(".")[1];
          if (!/^\d{2}:\d{2}$/.test(e.value)) {
            render();
            return;
          }
          edit("siteBlocker", () => {
            C.siteBlocker.schedule[k] = e.value;
          });
        }),
      );

      qa("[data-dl]", sh).forEach((e) =>
        e.addEventListener("click", () => {
          const [m, k] = e.getAttribute("data-dl").split(".");
          edit(m, () => {
            C[m][k] = C[m][k].filter((d) => d !== e.getAttribute("data-v"));
          });
        }),
      );

      qa("[data-ab]", sh).forEach((btn) => {
        const path = btn.getAttribute("data-ab"),
          [m, k] = path.split(".");
        const inp = sh.querySelector(`[data-ai="${path}"]`);
        const go = () => {
          const v = m === "facebook" ? inp.value.trim().toLowerCase() : cleanHost(inp.value);
          if (!v) return;
          inp.value = "";
          edit(m, () => {
            if (!C[m][k].includes(v)) C[m][k].push(v);
            if (m === "siteBlocker") {
              if (k === "custom") C.siteBlocker.allow = C.siteBlocker.allow.filter((d) => d !== v);
              if (k === "allow") C.siteBlocker.custom = C.siteBlocker.custom.filter((d) => d !== v);
            }
          });
        };
        btn.addEventListener("click", go);
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            go();
          }
        });
        inp.addEventListener("keyup", (e) => {
          if (e.key === "Enter") go();
        });
      });

      qa("[data-pk]", sh).forEach((b) =>
        b.addEventListener("click", () => {
          const v = b.getAttribute("data-pk");
          edit("siteBlocker", () => {
            const a = C.siteBlocker.allow;
            C.siteBlocker.allow = a.includes(v) ? a.filter((d) => d !== v) : [...a, v];
          });
        }),
      );

      qa("[data-vm]", sh).forEach((b) => b.addEventListener("click", () => setVM(b.getAttribute("data-vm"))));
      qa("[data-df]", sh).forEach((b) =>
        b.addEventListener("click", () =>
          edit("viewMode", () => {
            C.viewMode.newSiteDefault = b.getAttribute("data-df");
          }),
        ),
      );

      qa("[data-hk]", sh).forEach((b) =>
        b.addEventListener("click", () => {
          const m = b.getAttribute("data-hk");
          armed = m;
          b.textContent = "Press…";
          b.classList.add("arm");
          if (capFn) {
            window.removeEventListener("keydown", capFn, true);
            capFn = null;
          }
          capFn = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
            window.removeEventListener("keydown", capFn, true);
            capFn = null;
            armed = null;
            if (e.metaKey || !(e.altKey || e.ctrlKey || e.shiftKey)) {
              render();
              return;
            }
            applyEdit(
              m,
              () => {
                C[m].toggleHotkey = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, key: e.key.toLowerCase() };
              },
              false,
            );
          };
          window.addEventListener("keydown", capFn, true);
        }),
      );

      sh.querySelector("[data-export]")?.addEventListener("click", exportSettings);

      const importBtn = sh.querySelector("[data-importbtn]");
      const importArea = sh.querySelector("[data-import]");
      importBtn?.addEventListener("click", () => {
        if (importArea?.value.trim()) importSettings(importArea.value.trim());
      });

      sh.querySelector("[data-reset]")?.addEventListener("click", () => {
        if (confirm("Reset all settings to defaults?")) resetSettings();
      });
    }

    function open() {
      if (root) {
        close();
        return;
      }
      if (!document.body) return;
      root = mk("div", { id: "wc-panel", style: "all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:all" });
      root.attachShadow({ mode: "open" });
      document.body.appendChild(root);
      render();
      document.addEventListener("keydown", onEsc, true);
    }
    function close() {
      if (capFn) {
        window.removeEventListener("keydown", capFn, true);
        capFn = null;
      }
      armed = null;
      root?.remove();
      root = null;
      document.removeEventListener("keydown", onEsc, true);
    }
    return {
      open,
      close,
      refresh: () => {
        if (root?.shadowRoot) render();
      },
    };
  })();

  const CBTN =
    "width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;font-size:15px;line-height:32px;padding:0;text-align:center;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(0,0,0,.35);transition:transform .1s,opacity .15s;-webkit-appearance:none;";

  function initCluster() {
    if (!document.body || document.getElementById("wc-cl")) return;
    const cl = mk("div", {
      id: "wc-cl",
      style:
        "position:fixed;z-index:2147483647;display:flex;flex-direction:column;gap:3px;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;padding:3px;border-radius:20px;background:rgba(0,0,0,.12)",
    });
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem(PFX + "clpos") || "null");
      } catch (_) {
        return null;
      }
    })();
    if (saved?.l != null) {
      cl.style.left = clamp(saved.l, 0, innerWidth - 38) + "px";
      cl.style.top = clamp(saved.t, 0, innerHeight - 120) + "px";
      cl.style.right = cl.style.bottom = "auto";
    } else {
      cl.style.right = "6px";
      cl.style.bottom = `calc(16px + env(safe-area-inset-bottom))`;
    }

    const addBtn = (icon, bg, color, opacity, id) => {
      const b = mk("button", { style: `${CBTN}background:${bg};color:${color};opacity:${opacity}`, "aria-label": icon }, icon);
      if (id) b.id = id;
      cl.appendChild(b);
      return b;
    };
    let sx = 0,
      sy = 0,
      drag = false,
      aptr = null,
      dragEndAt = 0,
      lt = null;
    const clearLT = () => {
      if (lt) {
        clearTimeout(lt);
        lt = null;
      }
    };
    const tapOk = () => !drag && Date.now() - dragEndAt > 250;

    cl.addEventListener("pointerdown", (e) => {
      sx = e.clientX;
      sy = e.clientY;
      drag = false;
      aptr = e.pointerId;
    });
    cl.addEventListener("pointermove", (e) => {
      if (aptr === null) return;
      if (!drag && Math.hypot(e.clientX - sx, e.clientY - sy) > 6) {
        drag = true;
        clearLT();
        try {
          cl.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      if (drag) {
        e.preventDefault();
        cl.style.left = clamp(e.clientX - 19, 0, innerWidth - 38) + "px";
        cl.style.top = clamp(e.clientY - 19, 0, innerHeight - 38) + "px";
        cl.style.right = cl.style.bottom = "auto";
      }
    });
    cl.addEventListener("pointerup", (e) => {
      if (drag) {
        dragEndAt = Date.now();
        try {
          cl.releasePointerCapture(e.pointerId);
        } catch (_) {}
        try {
          localStorage.setItem(PFX + "clpos", JSON.stringify({ l: parseInt(cl.style.left), t: parseInt(cl.style.top) }));
        } catch (_) {}
      }
      aptr = null;
      drag = false;
      clearLT();
    });
    cl.addEventListener("pointercancel", () => {
      aptr = null;
      drag = false;
      clearLT();
    });

    addBtn("🧼", "#1c1c2e", "#fff", ".8", "").addEventListener("click", () => {
      if (tapOk()) Panel.open();
    });

    if (C.viewMode.showButton) {
      const icon = vmMode === "desktop" ? "🖥" : vmMode === "mobile" ? "📱" : "🔄";
      const vb = addBtn(icon, "rgba(20,20,34,.8)", "#fff", ".7", "");
      vb.addEventListener("pointerdown", () => {
        clearLT();
        lt = setTimeout(() => {
          lt = null;
          if (!drag) setVM("auto");
        }, C.viewMode.longPressMs);
      });
      vb.addEventListener("pointerup", () => {
        const armed = !!lt;
        clearLT();
        if (armed && tapOk()) setVM(vmMode === "desktop" ? "mobile" : "desktop");
      });
      vb.addEventListener("pointercancel", clearLT);
    }

    if (isFB && C.facebook.showToggleButton)
      addBtn("🧹", "#fff", "#111", C.facebook.enabled ? "1" : ".3", "fcf-btn").addEventListener("click", () => {
        if (tapOk()) toggleFB(!C.facebook.enabled);
      });
    if (isYT && C.youtube.showToggleButton)
      addBtn("⏭", "#fff", "#111", C.youtube.enabled ? "1" : ".3", "yt-btn").addEventListener("click", () => {
        if (tapOk()) toggleYT(!C.youtube.enabled);
      });
    if (isLI && C.linkedin.showToggleButton)
      addBtn("💼", "#fff", "#111", C.linkedin.enabled ? "1" : ".3", "li-btn").addEventListener("click", () => {
        if (tapOk()) toggleLI(!C.linkedin.enabled);
      });

    document.body.appendChild(cl);
  }

  function initSB() {
    function showBlock(why) {
      try {
        window.stop();
      } catch (_) {}
      const de = document.documentElement;
      while (de.firstChild) de.removeChild(de.firstChild);
      const hd = document.createElement("head");
      hd.appendChild(mk("meta", { charset: "utf-8" }));
      hd.appendChild(mk("meta", { name: "viewport", content: "width=device-width,initial-scale=1,viewport-fit=cover" }));
      hd.appendChild(mk("title", {}, "Blocked"));
      de.appendChild(hd);
      de.appendChild(document.createElement("body"));
      const b = document.body;
      b.id = "wc-blk";
      Object.assign(b.style, {
        margin: "0",
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        textAlign: "center",
        padding: "24px 20px",
        fontFamily: "-apple-system,system-ui,sans-serif",
        background: "#0c0c0e",
        color: "#ddd",
      });
      const ab = mk(
        "button",
        { style: "padding:8px 18px;border:0;border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;-webkit-appearance:none;background:#2a2a30;color:#ddd" },
        `Allow ${C.siteBlocker.snoozeMinutes} min`,
      );
      ab.onclick = () => {
        sbSnooze(C.siteBlocker.snoozeMinutes);
        location.reload();
      };
      const mb = mk("button", { style: "padding:6px 14px;border:0;border-radius:10px;cursor:pointer;font-size:12px;-webkit-appearance:none;background:#1a1a1e;color:#888" }, "⚙ Manage");
      mb.onclick = Panel.open;
      b.append(
        mk("div", { style: "font-size:40px" }, "⛔"),
        mk("div", { style: "font-size:18px;font-weight:700" }, "Blocked"),
        mk("div", { style: "opacity:.55;max-width:22rem;font-size:13px;line-height:1.4" }, `${bare()} — ${why}.`),
        ab,
        mb,
      );
    }
    const check = () => {
      try {
        const w = blockReason();
        if (w && !document.getElementById("wc-blk")) showBlock(w);
      } catch (_) {}
    };
    check();
    setInterval(check, 5000);
    onHotkey(
      () => C.siteBlocker.toggleHotkey,
      () =>
        applyEdit(
          "siteBlocker",
          () => {
            C.siteBlocker.enabled = !C.siteBlocker.enabled;
          },
          "block",
        ),
    );
  }

  const MODULES = {
    facebook: { style: "fcf-css", btn: "fcf-btn" },
    youtube: { style: "yt-css", btn: "yt-btn" },
    linkedin: { style: "li-css", btn: "li-btn" },
  };
  const toggleModule = (name, on) => {
    C[name].enabled = on;
    save(name);
    const m = MODULES[name];
    const ss = document.getElementById(m.style);
    if (ss) ss.disabled = !on;
    const b = document.getElementById(m.btn);
    if (b) b.style.opacity = on ? "1" : ".3";
  };
  const toggleFB = (on) => toggleModule("facebook", on);
  const toggleYT = (on) => toggleModule("youtube", on);
  const toggleLI = (on) => toggleModule("linkedin", on);

  function initFB() {
    const f = C.facebook;
    if (f.forceMostRecent && (location.pathname === "/" || location.pathname === "/home.php") && !/[?&]sk=/.test(location.search)) {
      let tried = false;
      try {
        tried = sessionStorage.getItem(PFX + "chr") === "1";
      } catch (_) {}
      if (!tried) {
        try {
          sessionStorage.setItem(PFX + "chr", "1");
        } catch (_) {}
        location.replace(location.origin + "/?sk=h_chr");
        return;
      }
    }
    const SPON =
      "sponsored paidpartnership publicidad patrocinado sponsoris commandit gesponsert sponsorizzat gesponsord bersponsor sponsorlu sponsorowan sponsrad sponset sponsoreret ممول ממומן реклама 広告 광고 赞助 贊助 χορηγούμενη"
        .split(" ")
        .map(norm);
    const AI_MARKS =
      "aigenerated generatedbyai imaginedwithai madewithai createdwithai aiinfo metaai askmetaai trymetaai aistudio poweredbyai chatwithai aiimage aigeneratedcontent contenidogeneradoconia genereparlia mitkigeneriert محتوىمولدبالذكاءالاصطناعي"
        .split(" ")
        .map(norm);
    const MARKS = [
      ...(f.hideAIContent ? AI_MARKS : []),
      ...(f.hideSponsored ? SPON : []),
      ...(f.hideSuggested
        ? ["suggestedforyou", "suggestedpost", "pagesforyou", "pagesyoumaylike", "groupsyoumaylike", "suggestedaccounts", "peopletofollow", "accountstofollow", "pagestofollow"]
        : []),
      ...(f.hidePeopleYouMayKnow ? ["peopleyoumayknow"] : []),
      ...f.extraJunkPhrases.map(norm),
    ];
    const AD_LABELS =
      "ad ads anuncio anuncios annonce anzeige werbung pubblicita annuncio advertentie reklam reklama reklame hirdetes mainos διαφημιση إعلان اعلان реклама 広告 광고 广告 廣告 প্রচারিত publicidade patrocinado"
        .split(" ")
        .map(norm);
    const EXACT = [...(f.hideSponsored ? AD_LABELS : []), ...(f.hideReelsTrays ? ["reels", "reelsandshortvideos", "stories"] : [])];

    (() => {
      const X = "html.fcf-s ";
      const R = ["[data-fcf]{display:none!important}"];
      if (f.hideRightSidebar) R.push(`${X}[role="complementary"]{display:none!important}`);
      if (f.hideLeftSidebar) R.push(`${X}[role="navigation"][aria-label="Shortcuts"]{display:none!important}`, `[data-fcf-ln]{display:none!important}`);
      if (f.hideComposer) R.push(`${X}[role="region"][aria-label="Create a post"]{display:none!important}`);
      if (f.hideTopBar)
        R.push(
          `${X}[role="banner"],${X}[role="navigation"][aria-label="Facebook"],${X}[role="navigation"][aria-label="Account Controls and Settings"]{display:none!important}`,
          `${X}body{padding-top:0!important}`,
        );
      if (f.hideReelsTrays) R.push(`${X}[aria-label="Stories"],${X}[aria-label="Reels"]{display:none!important}`);
      if (f.hideComments) R.push(`${X}[aria-label="Leave a comment"],${X}[aria-label^="Comment"]{display:none!important}`);
      if (f.hideLikeCounts) R.push(`${X}[aria-label^="Like:"],${X}[aria-label*="reaction"],${X}[aria-label*="reacted"]{display:none!important}`);
      if (f.widenFeed) {
        const W = f.feedMaxWidth;
        R.push(
          `${X}[role="main"]{max-width:none!important;width:100%!important;margin:0 auto!important}`,
          `${X}[data-fcf-w]{width:auto!important;max-width:none!important;min-width:0!important}`,
          `${X}[data-fcf-feed]{width:min(${W}px,97vw)!important;max-width:none!important;min-width:0!important;margin:0 auto!important}`,
          `${X}[data-fcf-feed]>*{width:100%!important;max-width:none!important;min-width:0!important}`,
        );
      } else {
        R.push(`${X}[role="main"]{margin-left:auto!important;margin-right:auto!important}`);
      }
      if (f.hideVideoAutoplay) R.push(`video{pointer-events:auto}`);
      addStyle("fcf-css", R.join("\n"));
      if (!f.enabled) document.getElementById("fcf-css").disabled = true;
      if (f.hideVideoAutoplay) {
        let vsch = false;
        const muteVids = () => {
          vsch = false;
          for (const v of document.querySelectorAll("video:not([data-fcf-muted])")) {
            v.setAttribute("data-fcf-muted", "");
            v.muted = true;
            v.autoplay = false;
            try {
              v.pause();
            } catch (_) {}
          }
        };
        const vschedule = () => {
          if (!vsch) {
            vsch = true;
            requestAnimationFrame(muteVids);
          }
        };
        onReady(muteVids);
        new MutationObserver(vschedule).observe(document.documentElement, { childList: true, subtree: true });
      }
    })();

    const isJunk = (c) => MARKS.some((m) => c.includes(m)) || EXACT.includes(c);
    const AD_SET = new Set(EXACT);
    const hasAdToken = (text) => {
      if (!text) return false;
      for (const w of String(text).split(/[^\p{L}]+/u)) {
        if (!w) continue;
        const t = norm(w);
        if (t && t.length <= 12 && AD_SET.has(t)) return true;
      }
      return false;
    };

    const FOLLOW = new Set(
      [
        ...["follow", "seguir", "suivre", "folgen", "segui", "volgen", "takip et", "följ", "følg", "obserwuj", "متابعة", "подписаться", "フォロー", "팔로우", "关注", "關注"],
        ...f.extraJunkPhrases,
      ].map(norm),
    );
    const onReelsRoute = () => /^\/reels?(\/|$)/.test(location.pathname);
    function hasFollowBtn(post, top) {
      if (!f.hideFollowSuggestions) return false;
      const overlaid = !!post.querySelector("video") || onReelsRoute();
      for (const e of post.querySelectorAll('span,a,div[role="button"]')) {
        const t = (e.textContent || "").trim();
        if (!t || t.length > 14 || !FOLLOW.has(norm(t))) continue;
        if (e.querySelector("span,a,div")) continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (!overlaid && (r.top < top - 4 || r.top > top + 130)) continue;
        return true;
      }
      return false;
    }

    let _feed = null,
      _skipEl = null,
      _skipN = 0;
    interceptNav(() => {
      _feed = null;
      _skipEl = null;
      _skipN = 0;
      _composerDone = false;
    });

    function tagWiden(fd) {
      if (!f.widenFeed || !fd) return;
      if (fd.getAttribute("data-fcf-feed") === null) fd.setAttribute("data-fcf-feed", "");
      const main = q('[role="main"]');
      for (let n = fd.parentElement; n && n !== main; n = n.parentElement) if (n.getAttribute("data-fcf-w") === null) n.setAttribute("data-fcf-w", "");
    }

    function feedBox() {
      if (_feed?.isConnected && _feed.children.length > 1) return _feed;
      const main = q('[role="main"]');
      if (!main) return null;
      const lo = Math.min(400, innerWidth * 0.5),
        hi = Math.max(innerWidth * 0.99, 760);
      let best = null,
        bn = 1;
      for (const d of main.querySelectorAll("div")) {
        const kids = d.children,
          kn = kids.length;
        if (kn < 2 || kn > 80) continue;
        let n = 0;
        for (const c of kids) {
          const r = c.getBoundingClientRect();
          if (r.width >= lo && r.width <= hi && r.height > 60) n++;
        }
        if (n > bn) {
          bn = n;
          best = d;
        }
      }
      _feed = best;
      tagWiden(best);
      return best;
    }

    function processDesktop() {
      const fd = feedBox();
      if (!fd) return;
      const vh = innerHeight;
      for (const st of fd.children) {
        const r0 = fresh(st, "data-fcf");
        if (r0.v) continue;
        const r = st.getBoundingClientRect();
        if (r.height < 60 || r.bottom < -500 || r.top > vh + 500) continue;
        const hdr = visText(st, 600, r.top - 2, r.top + 130);
        if (!hdr) continue;
        if (isJunk(norm(hdr)) || hasAdToken(hdr) || junkIn(st, r.top - 2, r.top + 130) || hasFollowBtn(st, r.top) || (f.hideReelsTrays && st.querySelectorAll('a[href*="/reel/"]').length > 3)) {
          st.setAttribute("data-fcf", "");
          r0.v = "junk";
          r0.hidden = true;
        } else if (++r0.keep >= 6) r0.v = "keep";
      }
    }

    // Facebook paints the desktop label from ~60 one-character spans in scrambled DOM
    // order, padded with decoys stacked at a single x on a second line. The characters
    // that actually render sit on the topmost line at distinct x, so reading the boxes
    // recovers the real word where textContent and naive text walking cannot.
    const ZW = /[\u034F\u200b-\u200f\u202a-\u202e\ufeff\u00ad\u2060]/g;
    const HAS_ZW = /[\u034F\u200b-\u200f\u202a-\u202e\ufeff\u00ad\u2060]/;
    function paintedLabel(el) {
      const pts = [];
      for (const sp of el.querySelectorAll("span")) {
        if (sp.children.length) continue;
        const t = (sp.textContent || "").replace(ZW, "");
        if (t.length !== 1) continue;
        const cs = getComputedStyle(sp);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const rs = sp.getClientRects();
        if (!rs.length || rs[0].width <= 0) continue;
        pts.push({ c: t, x: Math.round(rs[0].left), y: Math.round(rs[0].top) });
      }
      if (pts.length < 2) return "";
      let minY = pts[0].y;
      for (const p of pts) if (p.y < minY) minY = p.y;
      const line = pts.filter((p) => Math.abs(p.y - minY) <= 3).sort((a, b) => a.x - b.x);
      const seen = new Set(),
        keep = [];
      for (const p of line) {
        if (seen.has(p.x)) continue;
        seen.add(p.x);
        keep.push(p.c);
      }
      return keep.join("").trim();
    }
    const OBFUSCATED = (el) => {
      const t = el.textContent || "";
      return t.length >= 20 && t.length <= 220 && HAS_ZW.test(t) && el.querySelectorAll("span").length >= 15;
    };

    function hideLabelledAds() {
      const main = q('[role="main"]');
      if (!main) return;
      const vh = innerHeight;
      let hid = 0;
      const obf = [...main.querySelectorAll("span,a,div")].filter(OBFUSCATED);
      for (const e of [...main.querySelectorAll('span,a,h3,h4,div[role="heading"]'), ...obf]) {
        if (hid >= 12) break;
        const raw = (e.textContent || "").trim();
        if (OBFUSCATED(e)) {
          const seen = norm(paintedLabel(e));
          if (!seen || seen.length > 30 || !(EXACT.includes(seen) || MARKS.some((m) => m && seen.includes(m)))) continue;
        } else {
          if (!raw || raw.length > 40) continue;
          const t = norm(raw);
          if (!t || !(EXACT.includes(t) || MARKS.some((m) => m && t.includes(m)))) continue;
        }
        if (e.closest('[role="complementary"]')) continue;
        const er = e.getBoundingClientRect();
        if (!er.height || er.bottom < -400 || er.top > vh + 400) continue;
        let n = e,
          story = null;
        for (let i = 0; i < 18 && n.parentElement; i++) {
          n = n.parentElement;
          if (n === main || n === document.body) break;
          const r = n.getBoundingClientRect();
          if (r.width >= 400 && r.height >= 150 && er.top - r.top <= 160) {
            story = n;
            break;
          }
        }
        if (!story || rec(story).v) continue;
        story.setAttribute("data-fcf", "");
        Object.assign(rec(story), { v: "junk", hidden: true });
        hid++;
      }
    }

    function processCards() {
      const scope = q('[role="main"]');
      if (!scope) return;
      const vh = innerHeight,
        lim = Math.min(560, innerWidth * 0.55);
      const fits = (rr) => rr.width >= 120 && rr.width <= lim && rr.height >= 80 && rr.height <= 620 && rr.bottom >= -500 && rr.top <= vh + 500;
      for (const el of scope.querySelectorAll("div,a")) {
        if (rec(el).v) continue;
        const r = el.getBoundingClientRect();
        if (!fits(r)) continue;
        const raw = norm(el.textContent || "");
        if (!raw || !MARKS.some((m) => raw.includes(m))) continue;
        let tighter = false;
        for (const c of el.children) {
          if (!fits(c.getBoundingClientRect())) continue;
          if (MARKS.some((m) => norm(c.textContent || "").includes(m))) {
            tighter = true;
            break;
          }
        }
        if (tighter) continue;
        el.setAttribute("data-fcf", "");
        Object.assign(rec(el), { v: "junk", hidden: true });
      }
    }

    const MOB_CANDIDATES = ["[data-tracking-duration-id]", "[data-sigil~='m-feed-voice-subtitle']", "div[data-testid='story-subtitle']", "article[role='article']", "div[role='article']"];

    function mobilePostNodes() {
      for (const sel of MOB_CANDIDATES) {
        const found = document.querySelectorAll(sel);
        if (found.length > 1) return found;
      }
      return [];
    }

    const SLOT_H = /^\d+px$/;
    const LOADER_ZONE = 1200;
    const hasContent = (el) => !!(el.textContent || "").trim() || !!el.querySelector("img,video,canvas,[data-tracking-duration-id]");
    const fixedH = (el) => SLOT_H.test((el.style && el.style.height) || "");

    function slotOf(el) {
      let n = el,
        t = el;
      for (let i = 0; i < 3; i++) {
        const p = n.parentElement;
        if (!p || p === document.body || p.children.length !== 1) break;
        n = p;
        if (fixedH(p)) t = p;
      }
      return t;
    }

    function reelScroller() {
      return onReelsRoute() ? document.querySelector('[class*="vscroller"]') : null;
    }

    function feedSlots() {
      const sc = reelScroller();
      if (sc) return [...sc.children].filter((e) => !/filler/.test(String(e.className || "")));
      if (hasDesktopShell()) return [];
      const out = new Set();
      for (const p of mobilePostNodes()) out.add(slotOf(p));
      for (const w of document.querySelectorAll("div.displayed")) if (fixedH(w)) out.add(w);
      return out;
    }

    function retire(el, r0) {
      if (hasDesktopShell()) {
        el.setAttribute("data-fcf", "");
        r0.hidden = true;
        return;
      }
      // Both mobile surfaces need the node gone rather than hidden: the feed virtualiser
      // keeps a display:none slot in its height bookkeeping as a zero-height row and stops
      // loading, and in Reels a display:none child of the scroll-snap container loses its
      // snap point, so the scroller cannot advance past it.
      try {
        el.remove();
      } catch (_) {
        el.setAttribute("data-fcf", "");
        r0.hidden = true;
      }
    }

    function junkIn(el, bt, bb) {
      const banded = bt !== undefined;
      for (const e of el.querySelectorAll('span,a[role="link"],h3,h4,div[role="heading"],a[href]')) {
        const raw = (e.textContent || "").trim();
        if (!raw || raw.length > 120) continue;
        if (banded) {
          const r = e.getBoundingClientRect();
          if (!r.height || r.top < bt || r.top > bb) continue;
        }
        if (raw.length <= 40 && isJunk(norm(raw))) return true;
        // Facebook scrambles the label's character order and interleaves invisible
        // joiners, so textContent is meaningless; visText rebuilds what is painted.
        const seen = norm(visText(e, 60));
        if (seen && seen.length <= 40 && isJunk(seen)) return true;
      }
      return false;
    }

    function processMobile() {
      const reels = !!reelScroller();
      const docH = document.documentElement.scrollHeight;
      for (const el of feedSlots()) {
        const r0 = fresh(el, "data-fcf");
        if (r0.v) continue;
        if (el.querySelectorAll("[data-tracking-duration-id]").length > 1) continue;
        const r = el.getBoundingClientRect();
        if (!r.height) continue;
        if (junkIn(el) || hasAdToken(visText(el, 300, r.top - 2, r.top + 130)) || hasFollowBtn(el, r.top)) {
          r0.v = "junk";
          retire(el, r0);
          continue;
        }
        if (f.hideEmptyCards && !hasContent(el) && r.height >= 80 && (reels || docH - (r.bottom + scrollY) >= LOADER_ZONE)) {
          if (++r0.empty >= (reels ? 3 : 1)) {
            r0.v = "empty";
            retire(el, r0);
          }
          continue;
        }
        r0.empty = 0;
        if (++r0.keep >= 6) r0.v = "keep";
      }
    }

    let _composerDone = false;
    const _chromeChecked = new WeakSet();
    function hideMobileChrome() {
      if (f.hideTopBar) for (const tl of document.querySelectorAll('[role="tablist"]:not([data-fcf])')) tl.setAttribute("data-fcf", "");
      if (!f.hideComposer || _composerDone) return;
      const first = q("[data-tracking-duration-id]");
      if (!first) return;
      const limit = first.getBoundingClientRect().top + scrollY,
        vw = innerWidth;
      if (scrollY > limit + 400) return;
      for (const el of document.querySelectorAll("div")) {
        if (_chromeChecked.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        _chromeChecked.add(el);
        if (r.top + scrollY >= limit) continue;
        if (r.width < vw * 0.9 || r.width > vw * 1.02 || r.height < 50 || r.height > 95) continue;
        if (el.closest("[data-fcf]") || el.closest("[data-tracking-duration-id]")) continue;
        if (!el.querySelector('[role="button"][aria-label]') || !el.querySelector("img")) continue;
        el.setAttribute("data-fcf", "");
        _composerDone = true;
      }
    }

    const _trayChecked = new WeakSet();
    let _scanAt = 0;
    const scanDue = () => {
      const n = Date.now();
      if (n - _scanAt < 400) return false;
      _scanAt = n;
      return true;
    };
    function hideTrayRows() {
      if (!f.hideReelsTrays) return;
      const vw = innerWidth;
      for (const el of document.querySelectorAll("div")) {
        if (_trayChecked.has(el)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        _trayChecked.add(el);
        if (r.width < vw * 0.9 || r.width > vw * 1.02 || r.height < 150 || r.height > 340) continue;
        if (el.closest("[data-fcf]")) continue;
        const tops = [];
        const scan = (n) => {
          for (const c of n.children) {
            const cr = c.getBoundingClientRect();
            if (cr.width >= 80 && cr.width <= 170 && cr.height >= 130 && cr.height <= 300) tops.push(Math.round(cr.top / 10));
            else if (cr.width > 170 && c.children.length) scan(c);
          }
        };
        scan(el);
        if (tops.length < 3 || new Set(tops).size > 2) continue;
        el.setAttribute("data-fcf", "");
      }
    }

    function hideLeftNav() {
      if (!f.hideLeftSidebar) return;
      for (const n of document.querySelectorAll('[role="navigation"]:not([data-fcf-ln])')) {
        const r = n.getBoundingClientRect();
        if (r.height > 350 && r.width >= 120 && r.width <= 460 && r.left <= 24) n.setAttribute("data-fcf-ln", "");
      }
    }

    const _reelSt = new WeakMap();
    let _skipT = 0;
    function activeReel() {
      const sc = reelScroller();
      const box = sc ? sc.getBoundingClientRect() : { top: 0, height: innerHeight };
      const cy = box.top + box.height / 2;
      let best = null,
        d = 1e9;
      const cands = sc ? [...sc.children].filter((e) => !/filler/.test(String(e.className || ""))) : document.querySelectorAll("video");
      for (const e of cands) {
        const r = e.getBoundingClientRect();
        if (r.height < 200) continue;
        const dist = Math.abs((r.top + r.bottom) / 2 - cy);
        if (dist < d) {
          d = dist;
          best = e;
        }
      }
      return best;
    }

    function advanceReel(rl) {
      const sc = reelScroller();
      if (sc) {
        sc.scrollBy(0, sc.clientHeight);
        return;
      }
      const nx = q('[role="button"][aria-label="Next Card"]');
      if (nx) {
        nx.click();
        return;
      }
      const tg = rl.closest("[tabindex]") || rl;
      for (const tp of ["keydown", "keyup"]) tg.dispatchEvent(new KeyboardEvent(tp, { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true }));
    }

    function handleReels() {
      if (!f.skipReelsAds || !onReelsRoute()) return;
      const act = activeReel();
      if (!act) return;
      let rl = act;
      if (!reelScroller()) {
        for (let i = 0; i < 12 && rl.parentElement; i++) {
          rl = rl.parentElement;
          if (rl.querySelector('[aria-label="Like"],[aria-label^="Comment"],[role="button"][aria-label="Next Card"]')) break;
        }
      }
      if (!reelSpon(rl, act)) {
        if (act !== _skipEl) {
          _skipEl = null;
          _skipN = 0;
        }
        return;
      }
      if (act !== _skipEl) {
        _skipEl = act;
        _skipN = 0;
      }
      if (Date.now() - _skipT < 600 || _skipN >= 8) return;
      _skipN++;
      _skipT = Date.now();
      advanceReel(rl);
    }

    function reelSpon(rl, key) {
      let st = _reelSt.get(key);
      if (!st) _reelSt.set(key, (st = { s: false, n: 0 }));
      if (st.s) return true;
      if (st.n >= 8) return false;
      st.n++;
      const r = rl.getBoundingClientRect(),
        c = norm(visText(rl, 600, r.top - 2, r.bottom + 2));
      if (SPON.some((m) => c.includes(m))) st.s = true;
      return st.s;
    }

    const TKEYS = new Set(
      "fbclid gclid dclid gbraid wbraid msclkid yclid twclid igshid mc_eid mc_cid _openstat vero_id oly_enc_id oly_anon_id wickedid _hsenc _hsmi mkt_tok ref refsrc refid fref hc_ref hc_location ref_src ref_url eav paipv comment_tracking av rdid".split(
        " ",
      ),
    );
    const SHIMS = new Set(["l.facebook.com", "lm.facebook.com", "l.messenger.com"]);
    const isTK = (k) => TKEYS.has(k) || k.startsWith("utm_") || k.startsWith("__");
    function cleanUrl(href) {
      let u;
      try {
        u = new URL(href, location.href);
      } catch (_) {
        return null;
      }
      let d = false;
      if (SHIMS.has(u.hostname) && u.pathname === "/l.php") {
        const r = u.searchParams.get("u");
        if (r)
          try {
            const x = new URL(r);
            if (/^https?:$/.test(x.protocol)) {
              u = x;
              d = true;
            }
          } catch (_) {}
      }
      for (const k of [...u.searchParams.keys()])
        if (isTK(k)) {
          u.searchParams.delete(k);
          d = true;
        }
      return d ? u.toString() : null;
    }
    function cleanLinks() {
      const h = cleanUrl(location.href);
      if (h) history.replaceState(history.state, "", h);
      for (const a of document.querySelectorAll('a[href^="http"]:not([data-fcf-cl])')) {
        a.setAttribute("data-fcf-cl", "");
        const c = cleanUrl(a.getAttribute("data-lynx-uri") || a.href);
        if (c) a.href = c;
        a.removeAttribute("ping");
        a.removeAttribute("data-lynx-uri");
      }
    }

    const isFeed = () => {
      const pp = location.pathname;
      return pp === "/" || pp === "/home.php";
    };
    const isClean = () => {
      const pp = location.pathname.replace(/\/$/, "");
      return isFeed() || pp === "/groups/feed" || pp === "/watch" || /^\/groups\/[^/]+$/.test(pp);
    };
    const hasDesktopShell = () => !!q('[role="main"]');
    function keepScrollAnchored(mutate) {
      const host = reelScroller();
      const at = host ? host.scrollTop : scrollY;
      if ((!NEEDS_SCROLL_ANCHOR && !host) || !at) return mutate();
      const box = host ? host.getBoundingClientRect() : { top: 0, left: 0, width: innerWidth, height: innerHeight };
      const mid = Math.floor(box.left + box.width / 2);
      const marks = [];
      for (let y = box.top + 1; y < box.top + Math.min(box.height, 400) && marks.length < 6; y += 60) {
        const el = document.elementFromPoint(mid, y);
        if (el && el !== document.body && el !== document.documentElement) marks.push([el, el.getBoundingClientRect().top]);
      }
      mutate();
      for (const [el, top] of marks) {
        if (!el.isConnected) continue;
        const r = el.getBoundingClientRect();
        if (!r.height) continue;
        const d = r.top - top;
        if (d) host ? (host.scrollTop += d) : scrollBy(0, d);
        return;
      }
    }

    function sweep() {
      if (!f.enabled) return;
      try {
        if (f.stripTracking) cleanLinks();
        document.documentElement.classList.toggle("fcf-s", isFeed());
        keepScrollAnchored(() => {
          processMobile();
        });
        handleReels();
        if (hasDesktopShell()) {
          hideLeftNav();
          if (isClean()) keepScrollAnchored(processDesktop);
          hideLabelledAds();
          keepScrollAnchored(processCards);
        } else if (isFeed() && scanDue()) {
          hideTrayRows();
          hideMobileChrome();
        }
        if (Health.miss > 0) rescueSweep(MARKS, "data-fcf", 12);
      } catch (_) {}
    }
    const schedule = debounced(sweep);
    document.documentElement.classList.toggle("fcf-s", isFeed());
    onReady(() => {
      sweep();
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener("scroll", schedule, { passive: true, capture: true });
      window.addEventListener("scroll", schedule, { passive: true });
      setInterval(sweep, 1200);
      setInterval(() => {
        const b = document.getElementById("fcf-btn");
        if (b) b.style.boxShadow = healthScan() > 0 ? "0 0 0 2px #e6b34d" : "";
      }, 6000);
    });
    onHotkey(
      () => f.toggleHotkey,
      () => toggleFB(!C.facebook.enabled),
    );
  }

  function initYT() {
    const y = C.youtube;

    if (y.blockAdData)
      (() => {
        const AD_KEYS = ["adPlacements", "playerAds", "adSlots"];
        let pruned = 0;
        const scrub = (o, d) => {
          if (!o || typeof o !== "object" || d > 14) return o;
          if (Array.isArray(o)) {
            for (let i = o.length - 1; i >= 0; i--) {
              const e = o[i];
              let isAd = false;
              try {
                isAd = !!e?.command?.reelWatchEndpoint?.adClientParams?.isAd;
              } catch (_) {}
              if (isAd) {
                o.splice(i, 1);
                pruned++;
                continue;
              }
              scrub(e, d + 1);
            }
            return o;
          }
          for (const k of AD_KEYS)
            if (k in o) {
              try {
                delete o[k];
                pruned++;
              } catch (_) {}
            }
          for (const k in o) {
            if (Object.prototype.hasOwnProperty.call(o, k)) scrub(o[k], d + 1);
          }
          return o;
        };
        const guard = (r) => {
          try {
            return scrub(r, 0);
          } catch (_) {
            return r;
          }
        };
        try {
          const nat = JSON.parse;
          JSON.parse = function (...a) {
            return guard(nat.apply(this, a));
          };
        } catch (_) {}
        try {
          const nrj = Response.prototype.json;
          Response.prototype.json = function (...a) {
            return nrj.apply(this, a).then(guard);
          };
        } catch (_) {}
        for (const prop of ["ytInitialPlayerResponse", "ytInitialData"]) {
          try {
            if (Object.getOwnPropertyDescriptor(window, prop)) continue;
            let held;
            Object.defineProperty(window, prop, {
              configurable: true,
              enumerable: true,
              get() {
                return held;
              },
              set(v) {
                held = guard(v);
              },
            });
          } catch (_) {}
        }
        window.__wcAdPruned = () => pruned;
      })();
    const SEL = {
      ban: "#masthead-ad,#player-ads,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,ytm-companion-slot,ytm-companion-ad-renderer,.ytp-ad-overlay-slot,.ytp-ad-overlay-container,.ytp-ad-image-overlay",
      feed: "ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-video-renderer,ytd-promoted-sparkles-web-renderer,ytd-search-pyv-renderer,ytm-companion-slot,ytm-companion-ad-renderer,ytm-promoted-video-renderer,ytm-search-pyv-renderer,ytm-promoted-sparkles-web-renderer,ad-slot-renderer,ad-disclosure-banner-view-model",
      wrap: "ytd-rich-item-renderer,ytd-rich-section-renderer,ytd-item-section-renderer,ytm-rich-item-renderer,ytm-rich-section-renderer,ytm-item-section-renderer,ytm-media-item",
      skip: ".ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container button,.ytp-ad-skip-ad-slot button",
      clos: ".ytp-ad-overlay-close-button,.ytp-ad-overlay-close-container button",
      adui: ".ytp-ad-player-overlay,.ytp-ad-player-overlay-layout,.ytp-ad-player-overlay-instream-info,.ytp-ad-preview-container,.ytp-ad-badge,.ytp-ad-simple-ad-badge,.ytp-ad-duration-remaining,.ytp-ad-persistent-progress-bar,.ytp-ad-progress,.ytp-ad-skip-button-container",
    };
    const YT_MARKS = ["sponsored", "promoted", "includespaidpromotion"];
    const AD_V = ["ad-showing", "ad-interrupting"],
      AD_S = ["ad-showing", "ad-interrupting"];
    const hasC = (el, cl) => !!el && cl.some((c) => el.classList.contains(c));
    const pApi = (el, m, d) => {
      try {
        return typeof el?.[m] === "function" ? el[m]() : d;
      } catch (_) {
        return d;
      }
    };
    const adPresenting = (el) => {
      const t = pApi(el, "getPresentingPlayerType", -1);
      return t === 2 || t === 3;
    };

    const rules = [...(y.hideBanners ? [SEL.ban] : []), ...(y.hideFeedAds ? [SEL.feed, "[data-yt-h]"] : [])];
    if (y.hideShorts)
      rules.push(
        "ytd-rich-section-renderer:has(ytd-reel-shelf-renderer)",
        "ytd-reel-shelf-renderer",
        "ytd-rich-shelf-renderer[is-shorts]",
        "ytm-reel-shelf-renderer",
        "ytm-shorts-shelf-renderer",
        "ytd-guide-entry-renderer:has(a[href^='/shorts'])",
        "ytd-mini-guide-entry-renderer:has(a[href^='/shorts'])",
        "ytm-pivot-bar-item-renderer:has(a[href^='/shorts'])",
      );
    if (y.hideEndCards) rules.push(".ytp-ce-element", ".ytp-endscreen-content");
    if (y.hideInfoCards) rules.push(".ytp-cards-teaser", ".ytp-card-content", ".ytp-suggested-action");
    if (y.hideAutoplay) rules.push(".ytp-autonav-endscreen");
    const watchOnly = [];
    if (y.hideRelated) {
      rules.push("#secondary", "#related", "ytd-watch-next-secondary-results-renderer");
      watchOnly.push("ytm-single-column-watch-next-results-renderer", "ytm-item-section-renderer:has(ytm-video-with-context-renderer)");
    }
    if (y.hideComments) rules.push("#comments", "ytd-comments", "ytm-comments-entry-point-header-renderer", "ytm-comments-entry-point-teaser-renderer");
    if (y.hideChips) rules.push("ytd-feed-filter-chip-bar-renderer", "#chips-wrapper", "ytm-feed-filter-chip-bar-renderer", "ytm-feed-nudge-renderer");
    if (y.hideMerch)
      rules.push("ytd-merch-shelf-renderer", "ytd-ticket-shelf-renderer", "#donation-shelf", "ytmusic-mealbar-promo-renderer", "ytd-mealbar-promo-renderer", "yt-mealbar-promo-renderer");
    if (y.hideLiveChat) rules.push("#chat", "ytd-live-chat-frame", "#chat-container");
    if (y.hideRelated && y.widenPlayer)
      rules.push(
        "ytd-watch-flexy #primary.ytd-watch-flexy{max-width:none!important;width:100%!important}",
        "ytd-watch-flexy #primary-inner.ytd-watch-flexy{max-width:none!important}",
        "ytd-watch-flexy[flexy] #player.ytd-watch-flexy{max-width:none!important}",
      );
    const hideRules = rules.filter((r) => !r.includes("{"));
    const rawRules = rules.filter((r) => r.includes("{"));
    const css =
      (hideRules.length ? hideRules.join(",") + "{display:none!important}\n" : "") +
      (watchOnly.length ? watchOnly.map((s) => `html[data-yt-watch] ${s}`).join(",") + "{display:none!important}\n" : "") +
      rawRules.join("\n");
    if (css.trim()) addStyle("yt-css", css);
    const markWatch = () => {
      try {
        document.documentElement.toggleAttribute("data-yt-watch", location.pathname === "/watch");
      } catch (_) {}
    };
    markWatch();
    onReady(markWatch);
    interceptNav(markWatch);
    if (!y.enabled) {
      const ss = document.getElementById("yt-css");
      if (ss) ss.disabled = true;
    }

    if (y.hideAutoplay) {
      const disableAP = () => {
        const ap = q(".ytp-autonav-toggle-button");
        if (ap && ap.getAttribute("aria-checked") === "true") ap.click();
      };
      const apNudge = () => [0, 600, 1800].forEach((t) => setTimeout(disableAP, t));
      onReady(apNudge);
      interceptNav(apNudge);
    }

    if (y.hideRelated && y.widenPlayer) {
      const relayout = () => {
        try {
          window.dispatchEvent(new Event("resize"));
        } catch (_) {}
      };
      const nudge = () => [0, 300, 900, 2000].forEach((t) => setTimeout(relayout, t));
      onReady(nudge);
      interceptNav(nudge);
    }

    let muted = false,
      lastShort = 0,
      adTicks = 0,
      lastTap = 0;
    const _dismissedEnf = new WeakSet();
    interceptNav(() => {
      lastShort = 0;
      adTicks = 0;
    });

    function tap(el) {
      try {
        el.click();
      } catch (_) {}
      const r = el.getBoundingClientRect(),
        cx = r.left + r.width / 2,
        cy = r.top + r.height / 2;
      const o = { bubbles: true, cancelable: true, composed: true, clientX: cx, clientY: cy, view: window };
      const P = (t) => {
        try {
          el.dispatchEvent(new PointerEvent(t, { ...o, pointerType: "touch", isPrimary: true, pointerId: 1 }));
        } catch (_) {}
      };
      const M = (t) => {
        try {
          el.dispatchEvent(new MouseEvent(t, o));
        } catch (_) {}
      };
      const T = (t) => {
        try {
          el.dispatchEvent(new TouchEvent(t, { bubbles: true, cancelable: true }));
        } catch (_) {}
      };
      P("pointerdown");
      T("touchstart");
      M("mousedown");
      P("pointerup");
      T("touchend");
      M("mouseup");
      M("click");
    }

    function tick() {
      if (!y.enabled) return;
      try {
        if (y.dismissAntiAdblock) {
          const enf = q("ytd-enforcement-message-view-model");
          if (enf && !_dismissedEnf.has(enf)) {
            _dismissedEnf.add(enf);
            (enf.closest("tp-yt-paper-dialog") || enf).remove();
            q("tp-yt-iron-overlay-backdrop")?.remove();
            document.body?.style.removeProperty("overflow");
            const vi = q("video");
            if (vi?.paused) vi.play().catch(() => {});
          }
        }
        if (y.skipVideoAds) {
          const pl = q("#movie_player,.html5-video-player"),
            v = q(".html5-video-player video") || q("video");
          const adUiPresent = !!q(SEL.skip) || !!q(SEL.adui);
          const adActive = adPresenting(pl) || (hasC(pl, AD_V) && adUiPresent);
          if (adActive) {
            adTicks++;
            const sk = q(SEL.skip);
            if (sk && Date.now() - lastTap > 400) {
              lastTap = Date.now();
              tap(sk);
            }
            if (v) {
              if (y.muteAds && !v.muted) {
                v.muted = true;
                muted = true;
              }
              if (y.seekPastAds && isFinite(v.duration) && v.duration > 1 && v.duration <= 180 && (!sk || adTicks >= 3)) v.currentTime = v.duration - 0.1;
            }
            q(SEL.clos)?.click();
          } else {
            adTicks = 0;
            if (v && muted) {
              v.muted = false;
              muted = false;
            }
          }
        }
        if (y.skipShortsAds && /^\/shorts/.test(location.pathname)) {
          const sp = q("#shorts-player") || q("#movie_player,.html5-video-player");
          const shortsAdUi = !!q(".ytp-ad-player-overlay,.ytp-ad-preview-container,ytd-ad-slot-renderer,ad-slot-renderer");
          const adOn =
            adPresenting(sp) ||
            (hasC(sp, AD_S) && shortsAdUi) ||
            !!q(
              "ytd-reel-video-renderer ad-slot-renderer,ytd-reel-video-renderer ytd-ad-slot-renderer,ytd-shorts ytd-ad-slot-renderer,ytd-shorts ad-slot-renderer,ytd-reel-player-renderer ad-slot-renderer",
            );
          if (adOn && Date.now() - lastShort > 700) {
            lastShort = Date.now();
            const nx = q('#navigation-button-down button,button[aria-label="Next video"],button[aria-label="Next Short"]');
            nx ? nx.click() : document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
          }
        }
      } catch (_) {}
    }

    function hideFeedAds() {
      if (!y.hideFeedAds) return;
      for (const ad of document.querySelectorAll(SEL.feed)) {
        const w = ad.closest(SEL.wrap);
        if (w) w.setAttribute("data-yt-h", "");
      }
    }
    const schedule = debounced(() => {
      tick();
      hideFeedAds();
    });
    onReady(() => {
      tick();
      hideFeedAds();
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      setInterval(tick, 1000);
      setInterval(() => {
        const miss = healthScan();
        const b = document.getElementById("yt-btn");
        if (b) b.style.boxShadow = miss > 0 ? "0 0 0 2px #e6b34d" : "";
        if (miss > 0 && y.enabled && y.hideFeedAds) rescueSweep(YT_MARKS, "data-yt-h", 12);
      }, 6000);
    });
    onHotkey(
      () => y.toggleHotkey,
      () => toggleYT(!C.youtube.enabled),
    );
  }

  function initLI() {
    const L = C.linkedin;
    const LR = ["[data-li-h]{display:none!important}", "[data-li-rail]{display:none!important}"];
    if (L.widenFeed) {
      const W = L.feedMaxWidth;
      LR.push(`[data-li-feed]{width:min(${W}px,97vw)!important;max-width:none!important;margin:0 auto!important}`, `[data-li-feed]>*{width:100%!important;max-width:none!important}`);
    }
    addStyle("li-css", LR.join("\n"));
    if (!L.enabled) document.getElementById("li-css").disabled = true;

    let _liFeed = null;
    function tagTopBar() {
      if (!L.hideTopBar) return;
      for (const h of document.querySelectorAll("header:not([data-li-h])")) {
        const r = h.getBoundingClientRect();
        if (r.width >= innerWidth * 0.9 && r.height >= 40 && r.top + scrollY < 120) h.setAttribute("data-li-h", "");
      }
    }
    function tagChrome() {
      tagTopBar();
      const fhi = Math.max(760, Math.min(innerWidth * 0.8, 1400));
      let feed = null,
        fscore = 0;
      for (const e of document.querySelectorAll("div,main,section")) {
        const r = e.getBoundingClientRect();
        if (r.width < 380 || r.width > fhi || r.height < 400) continue;
        if ((e.innerText || "").length < 500) continue;
        if (!feed || r.width < feed.getBoundingClientRect().width) {
          fscore = 1;
          feed = e;
        }
      }
      if (!fscore) feed = null;
      if (!feed) return;
      _liFeed = feed;
      if (L.widenFeed && feed.getAttribute("data-li-feed") === null) feed.setAttribute("data-li-feed", "");
      for (const e of document.querySelectorAll("aside")) {
        if (e.hasAttribute("data-li-rail")) continue;
        if (e === feed || e.contains(feed) || feed.contains(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.height < 200 || r.width < 140 || r.width > 420) continue;
        const mid = r.left + r.width / 2;
        if (L.hideLeftRail && mid < innerWidth / 2) e.setAttribute("data-li-rail", "");
        else if (L.hideRightRail && mid >= innerWidth / 2) e.setAttribute("data-li-rail", "");
      }
    }
    const MK = [
      ...(L.hidePromoted ? ["promoted", "sponsored", "anzeige", "promocionado", "sponsorisé", "gesponsord"] : []),
      ...(L.hideSuggested ? ["suggested", "peopleyoumayknow", "recommendedforyou"] : []),
    ].map(norm);
    function sweepLI() {
      if (!L.enabled) return;
      const vh = document.documentElement.clientHeight || 600;
      const lo = 280,
        hi = Math.max(innerWidth * 0.9, 700);
      tagChrome();
      if (!MK.length) return;
      let hid = 0;
      for (const el of document.querySelectorAll("div,article,section,li")) {
        if (hid >= 15) break;
        if (_liFeed && (el === _liFeed || el.contains(_liFeed))) continue;
        if (fresh(el, "data-li-h").v) continue;
        const fits = (rr) => rr.width >= lo && rr.width <= hi && rr.height >= 100 && rr.height <= Math.max(vh * 2, 1400) && rr.bottom >= -500 && rr.top <= vh + 500;
        if (!tightestMatch(el, MK, fits)) continue;
        Object.assign(rec(el), { v: "junk", hidden: true });
        el.setAttribute("data-li-h", "");
        hid++;
      }
    }
    const schedule = debounced(sweepLI);
    onReady(() => {
      try {
        sweepLI();
      } catch (_) {}
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener("scroll", schedule, { passive: true, capture: true });
      window.addEventListener("scroll", schedule, { passive: true });
      setInterval(() => {
        try {
          sweepLI();
        } catch (_) {}
      }, 1500);
    });
    onHotkey(
      () => L.toggleHotkey,
      () => toggleLI(!C.linkedin.enabled),
    );
  }

  function regMenu() {
    const modern = GMNS && typeof GMNS.registerMenuCommand === "function";
    const legacy = typeof GM_registerMenuCommand === "function";
    if (!modern && !legacy) return;
    const reg = (label, fn) => {
      try {
        return modern ? GMNS.registerMenuCommand(label, fn) : GM_registerMenuCommand(label, fn);
      } catch (_) {}
    };
    const h = bare();
    reg("⚙ Web Cleaner", Panel.open);
    reg(`${C.siteBlocker.enabled ? "⛔ ON" : "✅ OFF"} toggle`, () =>
      applyEdit(
        "siteBlocker",
        () => {
          C.siteBlocker.enabled = !C.siteBlocker.enabled;
        },
        "block",
      ),
    );
    reg(`➕ Block ${h}`, () =>
      applyEdit(
        "siteBlocker",
        () => {
          if (!C.siteBlocker.custom.includes(h)) C.siteBlocker.custom.push(h);
          C.siteBlocker.allow = C.siteBlocker.allow.filter((d) => d !== h);
        },
        "block",
      ),
    );
    reg(`➖ Allow ${h}`, () =>
      applyEdit(
        "siteBlocker",
        () => {
          if (!C.siteBlocker.allow.includes(h)) C.siteBlocker.allow.push(h);
          C.siteBlocker.custom = C.siteBlocker.custom.filter((d) => d !== h);
        },
        "block",
      ),
    );
    if (isFB) reg(`🧹 FB ${C.facebook.enabled ? "ON" : "OFF"}`, () => toggleFB(!C.facebook.enabled));
    if (isYT) reg(`⏭ YT ${C.youtube.enabled ? "ON" : "OFF"}`, () => toggleYT(!C.youtube.enabled));
    if (isLI) reg(`💼 LinkedIn ${C.linkedin.enabled ? "ON" : "OFF"}`, () => toggleLI(!C.linkedin.enabled));
    reg("🖥 Desktop", () => setVM("desktop"));
    reg("📱 Mobile", () => setVM("mobile"));
    reg("↺ Auto", () => setVM("auto"));
  }

  const run = (fn) => {
    try {
      fn();
    } catch (_) {}
  };
  run(initSB);
  run(initVM);
  onReady(initCluster);
  const pageBlocked = (() => {
    try {
      return !!blockReason();
    } catch (_) {
      return false;
    }
  })();
  if (!pageBlocked) {
    if (isFB) run(initFB);
    if (isYT) run(initYT);
    if (isLI) run(initLI);
  }
  regMenu();
  hydrateShared(Object.keys(DEF));
})();
