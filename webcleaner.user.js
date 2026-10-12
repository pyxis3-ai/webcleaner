// ==UserScript==
// @name         Web Cleaner
// @namespace    https://local/webcleaner
// @version      8.23.0
// @updateURL    https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js
// @downloadURL  https://raw.githubusercontent.com/pyxis3-ai/webcleaner/main/webcleaner.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        unsafeWindow
// @noframes
// ==/UserScript==
(function () {
  "use strict";

  const HOST = location.hostname;
  const isFB = /^(www\.|web\.|m\.)?facebook\.com$/.test(HOST);
  const isYT = /^(www\.|m\.)?youtube\.com$|^music\.youtube\.com$/.test(HOST);
  const isLI = /^(www\.|[a-z]{2}\.)?linkedin\.com$/.test(HOST);
  const PW = typeof unsafeWindow !== "undefined" && unsafeWindow ? unsafeWindow : window;

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
      blockAdData: true,
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
      hideFeed: false,
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
      seekPastAds: false,
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
      hideFeed: false,
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
  const VERSION = "8.23.0";
  const GMNS = typeof GM !== "undefined" && GM ? GM : null;
  const gmLegacy = typeof GM_getValue === "function" && typeof GM_setValue === "function";
  const gmModern = !gmLegacy && !!(GMNS && typeof GMNS.getValue === "function" && typeof GMNS.setValue === "function");
  const lsGet = (k, d) => {
    try {
      const r = localStorage.getItem(PFX + k);
      return r === null ? d : JSON.parse(r);
    } catch (_) {
      return d;
    }
  };
  const lsSet = (k, v) => {
    try {
      localStorage.setItem(PFX + k, JSON.stringify(v));
    } catch (_) {}
  };
  const gGet = (k, d) => {
    if (gmLegacy)
      try {
        const v = GM_getValue(PFX + k, "__M__");
        if (v !== "__M__") return v;
      } catch (_) {}
    return lsGet(k, d);
  };
  const gSet = (k, v) => {
    if (gmLegacy)
      try {
        GM_setValue(PFX + k, v);
        return;
      } catch (_) {}
    if (gmModern)
      try {
        Promise.resolve(GMNS.setValue(PFX + k, v)).catch(() => {});
      } catch (_) {}
    lsSet(k, v);
  };
  async function hydrateShared(keys) {
    if (!gmModern) return;
    for (const k of keys)
      try {
        const v = await GMNS.getValue(PFX + k, "__M__");
        if (v !== "__M__") lsSet(k, v);
      } catch (_) {}
  }

  function deepMerge(d, o) {
    const r = JSON.parse(JSON.stringify(d));
    if (!o || typeof o !== "object" || Array.isArray(o)) return r;
    for (const k of Object.keys(o)) {
      if (!Object.hasOwn(r, k)) continue;
      const dv = r[k],
        ov = o[k];
      if (Array.isArray(dv)) {
        if (Array.isArray(ov)) r[k] = ov.filter((x) => typeof x === "string" || typeof x === "number");
      } else if (dv !== null && typeof dv === "object") {
        if (ov !== null && typeof ov === "object" && !Array.isArray(ov)) r[k] = deepMerge(dv, ov);
      } else if (typeof ov === typeof dv) {
        if (typeof ov !== "number") r[k] = ov;
        else if (Number.isFinite(ov)) r[k] = BOUNDS[k] ? clamp(ov, ...BOUNDS[k]) : ov;
      }
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
    const a = h("a", { href: url, download: "webcleaner-settings.json", style: "display:none" });
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
      C[m] = deepMerge(DEF[m], null);
      save(m);
    }
    location.reload();
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  const bare = () => location.hostname.replace(/^www\./, "");
  const ZW = /[\u034F\u200b-\u200f\u202a-\u202e\ufeff\u00ad\u2060]/g;
  const hasZW = (s) => s.search(ZW) !== -1;
  const norm = (s) =>
    String(s)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}]/gu, "");
  const q = (sel, r) => (r || document).querySelector(sel);
  const qa = (sel, r) => Array.from((r || document).querySelectorAll(sel));
  const onReady = (fn) => (document.body ? fn() : document.addEventListener("DOMContentLoaded", fn));
  const onRoot = (fn) => {
    if (document.documentElement) return fn();
    new MutationObserver((_, o) => {
      if (document.documentElement) {
        o.disconnect();
        fn();
      }
    }).observe(document, { childList: true });
  };

  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      const v = attrs[k];
      if (k === "style") e.style.cssText = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else if (k === "checked" || k === "value" || k === "open") e[k] = v;
      else if (v != null && v !== false) e.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c);
    return e;
  };

  const addStyle = (id, css) => {
    if (document.getElementById(id)) return;
    (document.head || document.documentElement).appendChild(h("style", { id }, css));
  };

  const HOSTNAME = /^[\p{L}\p{N}.-]+$/u;
  function cleanHost(raw) {
    const hn = (() => {
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
    return HOSTNAME.test(hn) ? hn : "";
  }

  const _hotkeys = [];
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.metaKey) return;
      const t = e.target;
      if (t?.isContentEditable || /^(input|textarea|select)$/i.test(t?.tagName || "")) return;
      for (const [gs, fn] of _hotkeys) {
        const k = gs();
        if (e.ctrlKey !== !!k.ctrl || e.altKey !== !!k.alt || e.shiftKey !== !!k.shift) continue;
        if ((e.key || "").toLowerCase() !== String(k.key || "").toLowerCase()) continue;
        e.preventDefault();
        fn();
        break;
      }
    },
    true,
  );
  const onHotkey = (gs, fn) => _hotkeys.push([gs, fn]);

  const _nav = [];
  let _href = location.href;
  const onNav = (fn) => _nav.push(fn);
  const navCheck = () => {
    if (location.href === _href) return;
    _href = location.href;
    for (const fn of _nav)
      try {
        fn();
      } catch (_) {}
  };

  const defProp = (obj, key, get) => {
    try {
      Object.defineProperty(obj, key, { configurable: true, get });
    } catch (_) {}
  };

  // A Proxy over a native keeps name, length and the absence of .prototype; NATIVE lets toString be masked.
  const NATIVE = new WeakMap();
  const asNative = (native, apply) => {
    try {
      const p = new Proxy(native, { apply });
      NATIVE.set(p, native);
      return p;
    } catch (_) {
      return native;
    }
  };
  const absUrl = (u) => {
    try {
      return new URL(String(u), location.href).href;
    } catch (_) {
      return "";
    }
  };
  const textEditor = (pre, edit, jsonl) => {
    const one = (t) => {
      try {
        const o = JSON.parse(t);
        return o && typeof o === "object" && edit(o) ? JSON.stringify(o) : t;
      } catch (_) {
        return t;
      }
    };
    return (t) => (typeof t !== "string" || !pre.test(t) ? t : jsonl ? t.split("\n").map(one).join("\n") : one(t));
  };
  // Responses are rewritten as text and gated on the URL the network served (Response.url, the URL given
  // to open()), never on a Request the page hands over, so canaries and spoofed-URL honeypots pass through.
  function hookResponses(win, gate, rewrite) {
    const hit = (u) => gate.test(absUrl(u));
    const reissue = async (res) => {
      const txt = await res.clone().text();
      const out = rewrite(txt);
      if (out === txt) return res;
      const r2 = new win.Response(out, { status: res.status, statusText: res.statusText, headers: res.headers });
      for (const k of ["url", "ok", "redirected", "type"])
        try {
          Object.defineProperty(r2, k, { value: res[k] });
        } catch (_) {}
      return r2;
    };
    try {
      win.fetch = asNative(win.fetch, (t, self, args) =>
        Reflect.apply(t, self, args).then((res) => {
          let u = "";
          try {
            u = res.url;
          } catch (_) {}
          return hit(u) ? reissue(res) : res;
        }),
      );
    } catch (_) {}
    try {
      const XP = win.XMLHttpRequest.prototype,
        seen = new WeakMap();
      XP.open = asNative(XP.open, (t, self, args) => {
        try {
          seen.set(self, String(args[1]));
        } catch (_) {}
        return Reflect.apply(t, self, args);
      });
      XP.send = asNative(XP.send, (t, self, args) => {
        try {
          if (hit(seen.get(self)))
            self.addEventListener("readystatechange", function () {
              if (this.readyState !== 4) return;
              let real = "";
              try {
                real = this.responseURL;
              } catch (_) {}
              if (real && !hit(real)) return;
              let txt = "";
              try {
                txt = this.responseText;
              } catch (_) {
                return;
              }
              const out = rewrite(txt);
              if (out === txt) return;
              try {
                Object.defineProperty(this, "responseText", { configurable: true, get: () => out });
                Object.defineProperty(this, "response", { configurable: true, get: () => out });
              } catch (_) {}
            });
        } catch (_) {}
        return Reflect.apply(t, self, args);
      });
    } catch (_) {}
  }
  const hookParse = (win, pre, edit) => {
    try {
      win.JSON.parse = asNative(win.JSON.parse, (t, self, args) => {
        const o = Reflect.apply(t, self, args);
        if (typeof args[0] === "string" && pre.test(args[0]))
          try {
            edit(o);
          } catch (_) {}
        return o;
      });
    } catch (_) {}
  };
  const maskNatives = (win) => {
    try {
      const FP = win.Function.prototype;
      FP.toString = asNative(FP.toString, (t, self, args) => Reflect.apply(t, NATIVE.get(self) || self, args));
    } catch (_) {}
  };
  // Pages fetch untouched natives from a freshly inserted same-origin frame; the parent's are copied in.
  function guardFrames(win, copyInto) {
    const fix = (el) => {
      try {
        const cw = el.contentWindow;
        if (cw && (cw.location.href === "about:blank" || cw.location.href === location.href)) copyInto(cw);
      } catch (_) {}
    };
    const wrap = (proto, name) => {
      try {
        proto[name] = asNative(proto[name], (t, self, args) => {
          const r = Reflect.apply(t, self, args);
          for (const a of args) if (a instanceof win.HTMLElement) fix(a);
          return r;
        });
      } catch (_) {}
    };
    for (const n of ["appendChild", "insertBefore"]) wrap(win.Node.prototype, n);
    for (const n of ["append", "prepend", "before", "after", "insertAdjacentElement"]) wrap(win.Element.prototype, n);
  }

  const SPON =
    "sponsored paidpartnership publicidad patrocinado sponsoris commandit gesponsert sponsorizzat gesponsord bersponsor sponsorlu sponsorowan sponsrad sponset sponsoreret ممول ממומן реклама 広告 광고 赞助 贊助 χορηγούμενη"
      .split(" ")
      .map(norm);
  const PROMOTED = ["promoted", "promocionado"];
  const LABELS = [...SPON, ...PROMOTED];
  const AD_WORDS = new Set(
    "ad ads anuncio anuncios annonce anzeige werbung pubblicita annuncio advertentie reklam reklama reklame hirdetes mainos διαφημιση إعلان اعلان реклама 広告 광고 广告 廣告 প্রচারিত publicidade patrocinado"
      .split(" ")
      .map(norm),
  );
  const adToken = (text) => {
    for (const w of String(text || "").split(/[^\p{L}]+/u)) {
      const t = norm(w);
      if (t && t.length <= 12 && AD_WORDS.has(t)) return true;
    }
    return false;
  };
  const labelled = (text) => {
    const c = norm(text);
    return LABELS.some((m) => c.includes(m));
  };

  const Health = { miss: 0 };
  let healthArmed = () => false;
  function healthScan(armed) {
    if (!armed) return (Health.miss = 0);
    const vh = document.documentElement.clientHeight || 600;
    let miss = 0;
    for (const el of document.querySelectorAll("badge-shape,span,div,p,h3,h4")) {
      if (el.children.length) continue;
      const raw = el.textContent;
      if (!raw || raw.length > 24) continue;
      const t = norm(raw);
      if (!t || t.length > 16 || !LABELS.some((m) => t.startsWith(m))) continue;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh) miss++;
      if (miss > 50) break;
    }
    return (Health.miss = miss);
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
      .replace(ZW, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  const bandText = (el, cap, band) => {
    if (!band) return visText(el, cap);
    const top = el.getBoundingClientRect().top;
    return visText(el, cap, top - 2, top + band);
  };
  function tightestMatch(el, hit, fits, band) {
    if (!hit(bandText(el, 400, band))) return false;
    for (const c of el.children) if (fits(c.getBoundingClientRect()) && hit(bandText(c, 300, band))) return false;
    return true;
  }

  function rescueSweep(hit, attr, max) {
    const vh = document.documentElement.clientHeight || 600,
      hi = Math.max(innerWidth * 0.98, 400);
    const fits = (rr) => rr.width >= 120 && rr.width <= hi && rr.height >= 70 && rr.height <= Math.max(vh * 1.6, 900) && rr.bottom >= -400 && rr.top <= vh + 400;
    let hid = 0;
    for (const el of document.querySelectorAll("div,article,section,li")) {
      if (hid >= max) break;
      if (!fits(el.getBoundingClientRect())) continue;
      const st = fresh(el, attr);
      if (st.hidden || !tightestMatch(el, hit, fits)) continue;
      Object.assign(st, { v: "junk", hidden: true });
      el.setAttribute(attr, "");
      hid++;
    }
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
    const fix = (ml) => {
      try {
        const r = mqRewrite(ml.mediaText, vw, tm, orient);
        if (r !== null) ml.mediaText = r;
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
      if (_mqDone.has(el)) continue;
      _mqDone.add(el);
      const r = mqRewrite(el.getAttribute("media"), vw, tm, orient);
      if (r !== null) el.setAttribute("media", r);
    }
    if (deep) for (const el of document.getElementsByTagName("*")) if (el.shadowRoot) scope(el.shadowRoot);
  }

  function applyVMSpoof() {
    const v = C.viewMode;
    if (vmMode === "auto") return;
    const tm = vmMode === "mobile",
      N = PW.navigator;
    if (v.spoofUA) {
      const ua = tm ? v.mobileUA : v.desktopUA,
        plat = tm ? "Android" : "Windows";
      defProp(N, "userAgent", () => ua);
      defProp(N, "appVersion", () => ua.replace(/^Mozilla\//, ""));
      defProp(N, "platform", () => (tm ? "Linux armv8l" : "Win32"));
      defProp(N, "vendor", () => "Google Inc.");
      try {
        const br = N.userAgentData?.brands ?? [];
        defProp(N, "userAgentData", () => ({
          mobile: tm,
          platform: plat,
          brands: br,
          getHighEntropyValues: () => Promise.resolve({ mobile: tm, platform: plat }),
          toJSON: () => ({ mobile: tm, platform: plat, brands: br }),
        }));
      } catch (_) {}
    }
    if (v.spoofTouch) {
      defProp(N, "maxTouchPoints", () => (tm ? 5 : 0));
      try {
        if (tm && !("ontouchstart" in PW)) PW.ontouchstart = null;
      } catch (_) {}
    }
    if (v.spoofMedia) {
      const ew = tm ? v.mobileWidth : v.desktopWidth,
        nat = PW.matchMedia?.bind(PW) ?? null;
      const orient = tm && !REAL_MOBILE ? (v.mobileWidth <= v.mobileHeight ? "portrait" : "landscape") : null;
      PW.matchMedia = (query) => {
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
        defProp(PW, "innerWidth", () => v.mobileWidth);
        defProp(PW, "innerHeight", () => v.mobileHeight);
        defProp(PW.screen, "width", () => v.mobileWidth);
        defProp(PW.screen, "height", () => v.mobileHeight);
        defProp(PW.screen, "availWidth", () => v.mobileWidth);
        defProp(PW.screen, "availHeight", () => v.mobileHeight);
        defProp(PW, "devicePixelRatio", () => v.mobileDpr);
      }
    }
  }

  const sbMatch = (list) => {
    if (!Array.isArray(list)) return false;
    const hn = bare();
    return list.some((d) => typeof d === "string" && d && (hn === d || hn.endsWith("." + d)));
  };
  const sbSnoozed = () => Date.now() < gGet("snz", 0);
  const sbSnooze = (m) => gSet("snz", Date.now() + m * 60000);

  const hhmm = (s, dflt) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
    if (!m) return dflt;
    const hr = +m[1],
      mi = +m[2];
    return hr > 23 || mi > 59 ? dflt : hr * 60 + mi;
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
    const orient = v.mobileWidth <= v.mobileHeight ? "portrait" : "landscape";

    function applyVP() {
      if (!REAL_MOBILE) return;
      const want = vmMode === "desktop" ? `width=${v.desktopWidth}` : "width=device-width,initial-scale=1,viewport-fit=cover";
      const foreign = qa('meta[name="viewport"]').filter((e) => !e.hasAttribute("data-wc"));
      let m = q('meta[name="viewport"][data-wc]');
      if (!foreign.length && m && m.getAttribute("content") === want) return;
      foreign.forEach((e) => e.remove());
      if (!m) (document.head || document.documentElement).appendChild((m = h("meta", { name: "viewport", "data-wc": "1" })));
      if (m.getAttribute("content") !== want) m.setAttribute("content", want);
    }

    function applyFrame() {
      if (!useFrame) return;
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
        if (doReflow) reflowSheets(v.mobileWidth, true, orient, deep);
      } catch (_) {}
    };
    const pump = debounced(() => beat(false));
    const deepBeat = () => beat(true);
    onRoot(() => {
      deepBeat();
      new MutationObserver(pump).observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener("DOMContentLoaded", deepBeat);
      window.addEventListener("load", deepBeat);
      for (const t of [100, 300, 600, 1200, 2500, 4000]) setTimeout(deepBeat, t);
    });
  }

  const keyLabel = (hk) => (hk.ctrl ? "Ctrl+" : "") + (hk.alt ? "Alt+" : "") + (hk.shift ? "Shift+" : "") + String(hk.key || "").toUpperCase();
  const PCSS = `:host{all:initial}*{box-sizing:border-box;font-family:-apple-system,system-ui,sans-serif;-webkit-font-smoothing:antialiased}.bk{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646;-webkit-tap-highlight-color:transparent}.cd{position:fixed;inset:0;margin:auto;width:min(600px,calc(100vw - 16px));height:fit-content;max-height:min(92dvh,900px);overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#18191c;color:#ddd;border-radius:14px;padding:12px 10px;box-shadow:0 12px 40px rgba(0,0,0,.7);z-index:2147483647;font-size:13px;line-height:1.35}.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}.hd h1{font-size:15px;font-weight:700;margin:0}.x{background:#2a2a2f;border:0;color:#ccc;font-size:14px;cursor:pointer;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;-webkit-appearance:none}.r{display:flex;align-items:center;justify-content:space-between;gap:6px;padding:5px 0;border-top:1px solid #27282c}.r>span{flex:1;font-size:12px;line-height:1.2}.r2{display:flex;align-items:center;gap:6px;padding:5px 0;border-top:1px solid #27282c;flex-wrap:wrap}.r2>span{font-size:12px}.fr{display:flex;flex-direction:column;gap:3px;padding:5px 0;border-top:1px solid #27282c}.cu{font-size:10px;color:#888;margin-top:1px}.snz{cursor:pointer;text-decoration:underline}.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));column-gap:12px}.gr .r{min-width:0}.gr .r>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sc{margin-top:6px}.sc>h2{font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#777;margin:0 0 1px}.it{display:flex;align-items:center;justify-content:space-between;gap:4px;padding:4px 0;border-top:1px solid #27282c}.it span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:12px}.dl{background:none;border:0;color:#f66;cursor:pointer;padding:0;width:24px;height:24px;font-size:13px;display:flex;align-items:center;justify-content:center;-webkit-appearance:none;border-radius:50%}.dl:active{background:#2a2a2f}.ad{display:flex;gap:4px;margin-top:4px}.ad input{flex:1;min-width:0;background:#111;border:1px solid #333;color:#ddd;border-radius:8px;padding:6px 8px;font-size:13px;-webkit-appearance:none}.ad input:focus{border-color:#3a7afe;outline:none}.ad button{background:#3a7afe;border:0;color:#fff;border-radius:8px;cursor:pointer;padding:0 12px;font-size:14px;-webkit-appearance:none;font-weight:700}.em{color:#666;font-style:italic;padding:4px 0;border-top:1px solid #27282c;font-size:11px}.sw{position:relative;display:inline-block;width:36px;height:20px;flex:0 0 auto}.sw input{opacity:0;width:0;height:0;position:absolute}.tk{position:absolute;inset:0;background:#3a3b42;border-radius:999px;transition:.15s;cursor:pointer}.tk::before{content:"";position:absolute;width:16px;height:16px;left:2px;top:2px;background:#fff;border-radius:50%;transition:.15s;box-shadow:0 1px 3px rgba(0,0,0,.25)}.sw input:checked+.tk{background:#34c759}.sw input:checked+.tk::before{transform:translateX(16px)}details{margin-top:2px}summary{cursor:pointer;padding:5px 0;color:#aaa;border-top:1px solid #27282c;list-style:none;user-select:none;font-weight:600;font-size:12px;display:flex;align-items:center;gap:3px}summary::-webkit-details-marker{display:none}details[open]>summary::after{content:"▲";font-size:7px;color:#666;margin-left:auto}details:not([open])>summary::after{content:"▼";font-size:7px;color:#666;margin-left:auto}.pl{border:0;border-radius:6px;cursor:pointer;padding:2px 7px;font-size:10px;-webkit-appearance:none;font-weight:500}.bl{background:#3a2b2b;color:#f99}.al{background:#1e3020;color:#7e9}.pg{display:flex;flex-wrap:wrap;gap:3px;padding:4px 0}.nm{width:64px;background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:4px 6px;font-size:12px;text-align:right;-webkit-appearance:none}.tm{background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:4px 6px;font-size:12px;-webkit-appearance:none;width:80px}.tx{background:#111;border:1px solid #333;color:#ddd;border-radius:6px;padding:5px 7px;font-size:11px;width:100%;-webkit-appearance:none}.nm:focus,.tm:focus,.tx:focus{border-color:#3a7afe;outline:none}.hk{background:#2a2a2f;border:0;color:#ddd;border-radius:6px;cursor:pointer;padding:4px 8px;font-size:11px;-webkit-appearance:none}.hk.arm{background:#3a7afe;color:#fff}.sg{display:flex;gap:3px;flex:0 0 auto}.sg button{flex:1;background:#2a2a2f;border:0;color:#bbb;border-radius:6px;cursor:pointer;padding:4px 6px;font-size:11px;-webkit-appearance:none;white-space:nowrap}.sg button.on{background:#3a7afe;color:#fff;font-weight:600}`;

  const SWITCHES = {
    facebook: [
      ["On", "enabled"],
      ["Sponsored", "hideSponsored"],
      ["Block ad data", "blockAdData"],
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
      ["Hide feed", "hideFeed"],
      ["Button", "showToggleButton"],
    ],
    youtube: [
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
      ["Seek past ads ⚠", "seekPastAds"],
      ["Button", "showToggleButton"],
    ],
    linkedin: [
      ["On", "enabled"],
      ["Promoted", "hidePromoted"],
      ["Suggested", "hideSuggested"],
      ["Top bar", "hideTopBar"],
      ["L.rail", "hideLeftRail"],
      ["R.rail", "hideRightRail"],
      ["Widen feed", "widenFeed"],
      ["Hide feed", "hideFeed"],
      ["Button", "showToggleButton"],
    ],
  };

  const Panel = (() => {
    let root = null,
      capFn = null,
      armed = null;
    const affects = (m) => (m === "siteBlocker" ? "block" : m === "viewMode" ? vmActive() : !!MODULES[m]?.on);
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
    const dim = (text) => h("span", { style: "font-size:11px;color:#888" }, text);
    const row = (label, ...ctl) => h("div", { class: "r" }, h("span", null, label), ...ctl);
    const row2 = (l1, c1, l2, c2) => h("div", { class: "r2" }, h("span", null, l1), c1, h("span", { style: "margin-left:auto" }, l2), c2);
    const sw = (m, k) =>
      h(
        "label",
        { class: "sw" },
        h("input", {
          type: "checkbox",
          "data-sw": `${m}.${k}`,
          checked: !!C[m][k],
          onchange: (e) => {
            if (k === "enabled" && MODULES[m]) {
              toggleModule(m, e.target.checked);
              render();
            } else
              edit(m, () => {
                C[m][k] = e.target.checked;
              });
          },
        }),
        h("span", { class: "tk" }),
      );
    const num = (m, k) =>
      h("input", {
        class: "nm",
        type: "number",
        inputmode: "decimal",
        "data-num": `${m}.${k}`,
        value: C[m][k],
        onchange: (e) => {
          let v = parseFloat(e.target.value);
          if (!isFinite(v) || v <= 0) return render();
          if (BOUNDS[k]) v = clamp(v, ...BOUNDS[k]);
          edit(m, () => {
            C[m][k] = v;
          });
        },
      });
    const time = (k) =>
      h("input", {
        class: "tm",
        type: "time",
        "data-time": `siteBlocker.${k}`,
        value: C.siteBlocker.schedule[k],
        onchange: (e) =>
          /^\d{2}:\d{2}$/.test(e.target.value)
            ? edit("siteBlocker", () => {
                C.siteBlocker.schedule[k] = e.target.value;
              })
            : render(),
      });
    const text = (label, m, k) =>
      h(
        "div",
        { class: "fr" },
        dim(label),
        h("input", {
          class: "tx",
          type: "text",
          autocorrect: "off",
          autocapitalize: "none",
          "data-txt": `${m}.${k}`,
          value: C[m][k],
          onchange: (e) => {
            const v = e.target.value.trim();
            v
              ? edit(m, () => {
                  C[m][k] = v;
                })
              : render();
          },
        }),
      );
    const hotkey = (m) => row("Shortcut", h("button", { class: "hk", "data-hk": m, onclick: (e) => arm(m, e.target) }, keyLabel(C[m].toggleHotkey)));
    const grid = (m, pairs) => h("div", { class: "gr" }, ...pairs.map(([l, k]) => row(l, sw(m, k))));
    const sec = (id, title, isOpen, ...kids) => h("details", { "data-s": id, open: isOpen }, h("summary", null, title), ...kids);

    function list(label, m, k, ph) {
      const arr = C[m][k],
        path = `${m}.${k}`;
      const add = () => {
        const v = m === "facebook" ? inp.value.trim().toLowerCase() : cleanHost(inp.value);
        if (!v) return;
        inp.value = "";
        edit(m, () => {
          if (!arr.includes(v)) arr.push(v);
          if (m === "siteBlocker") {
            const other = k === "custom" ? "allow" : "custom";
            C.siteBlocker[other] = C.siteBlocker[other].filter((d) => d !== v);
          }
        });
      };
      const inp = h("input", {
        type: "text",
        autocorrect: "off",
        autocapitalize: "none",
        "data-ai": path,
        placeholder: ph,
        onkeydown: (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        },
      });
      const items = arr.map((d) =>
        h(
          "div",
          { class: "it" },
          h("span", { title: d }, d),
          h(
            "button",
            {
              class: "dl",
              "data-dl": path,
              "data-v": d,
              onclick: () =>
                edit(m, () => {
                  C[m][k] = arr.filter((x) => x !== d);
                }),
            },
            "✕",
          ),
        ),
      );
      return h(
        "div",
        { class: "sc" },
        h("h2", null, label),
        items.length ? items : h("div", { class: "em" }, "Empty"),
        h("div", { class: "ad" }, inp, h("button", { "data-ab": path, onclick: add }, "+")),
      );
    }

    const packs = (sites) =>
      h(
        "div",
        { class: "pg" },
        ...sites.map((d) =>
          h(
            "button",
            {
              class: "pl " + (C.siteBlocker.allow.includes(d) ? "al" : "bl"),
              "data-pk": d,
              onclick: () =>
                edit("siteBlocker", () => {
                  const a = C.siteBlocker.allow;
                  C.siteBlocker.allow = a.includes(d) ? a.filter((x) => x !== d) : [...a, d];
                }),
            },
            d,
          ),
        ),
      );

    function focusState() {
      const s = C.siteBlocker,
        inSched = sbInSchedule(),
        active = s.blockFocus || inSched;
      const why = s.blockFocus
        ? "Focus switch is on"
        : inSched
          ? `inside schedule ${s.schedule.from}–${s.schedule.to}`
          : s.scheduleOn
            ? `outside schedule ${s.schedule.from}–${s.schedule.to}`
            : "Focus switch off and schedule off";
      const here = active && sbMatch(FOCUS) && !sbMatch(s.allow);
      return h(
        "div",
        { class: "cu", style: `color:${active ? "#e6b34d" : "#7a7a7a"};padding:3px 0` },
        `${active ? "●" : "○"} Focus pack ${active ? "BLOCKING NOW" : "not blocking"} (${why})`,
        here ? [" — ", h("b", null, `${bare()} is blocked`)] : sbMatch(FOCUS) ? ` — ${bare()} is in the pack` : null,
      );
    }

    const secSB = () => {
      const s = C.siteBlocker;
      return sec(
        "sb",
        `⛔ Blocker ${s.enabled ? "ON" : "OFF"}`,
        true,
        row(HOST, sw("siteBlocker", "enabled")),
        row2("Adult", sw("siteBlocker", "blockAdult"), "Focus", sw("siteBlocker", "blockFocus")),
        row(`Schedule (${s.schedule.from}–${s.schedule.to})`, sw("siteBlocker", "scheduleOn")),
        focusState(),
        sbSnoozed()
          ? h(
              "div",
              {
                class: "cu snz",
                onclick: () => {
                  gSet("snz", 0);
                  location.reload();
                },
              },
              "⏱ Snoozed — tap cancel",
            )
          : null,
        list("Blocked", "siteBlocker", "custom", "example.com"),
        list("Allowed", "siteBlocker", "allow", "example.com"),
        sec("focus", `Focus (${FOCUS.length})`, false, packs(FOCUS)),
        sec("adult", `Adult (${ADULT.length})`, false, packs(ADULT)),
        sec("sb-adv", "Advanced", false, row2("From", time("from"), "To", time("to")), row("Snooze min", num("siteBlocker", "snoozeMinutes")), hotkey("siteBlocker")),
      );
    };

    const secVM = () => {
      const v = C.viewMode;
      const seg = (cur, pick) => h("div", { class: "sg" }, ...VM_MODES.map((val) => h("button", { class: cur === val ? "on" : "", onclick: () => pick(val) }, val[0].toUpperCase() + val.slice(1))));
      return sec(
        "vm",
        `🖥 View ${vmMode.toUpperCase()}`,
        false,
        row2(
          "Site",
          seg(vmMode, setVM),
          "Def",
          seg(v.newSiteDefault, (val) =>
            edit("viewMode", () => {
              C.viewMode.newSiteDefault = val;
            }),
          ),
        ),
        grid("viewMode", [
          ["UA", "spoofUA"],
          ["Touch", "spoofTouch"],
          ["Media", "spoofMedia"],
          ["Reflow CSS", "reflowCss"],
          ["Frame", "frameOnDesktop"],
          ["Button", "showButton"],
        ]),
        sec(
          "vm-adv",
          "Advanced",
          false,
          row2("DeskW", num("viewMode", "desktopWidth"), "MobW", num("viewMode", "mobileWidth")),
          row2("MobH", num("viewMode", "mobileHeight"), "DPR", num("viewMode", "mobileDpr")),
          row("Long-press ms", num("viewMode", "longPressMs")),
          text("Mobile UA", "viewMode", "mobileUA"),
          text("Desktop UA", "viewMode", "desktopUA"),
          hotkey("viewMode"),
        ),
      );
    };

    const secModule = (name) => {
      const m = MODULES[name];
      return sec(
        name,
        `${m.icon} ${m.label} ${C[name].enabled ? "ON" : "OFF"}`,
        false,
        grid(name, SWITCHES[name]),
        name === "facebook" ? list("Junk phrases", "facebook", "extraJunkPhrases", "phrase") : null,
        sec(`${name}-adv`, "Advanced", false, name === "youtube" ? null : row("Feed max width", num(name, "feedMaxWidth")), hotkey(name)),
      );
    };

    const secIO = () => {
      const ta = h("textarea", { class: "tx", rows: 3, style: "resize:vertical", "data-import": "", placeholder: "Paste exported JSON here…" });
      return sec(
        "io",
        "⚙ Import / Export",
        false,
        row("Export settings", h("button", { class: "hk", "data-export": "", onclick: exportSettings }, "Save file")),
        h(
          "div",
          { class: "fr" },
          dim("Import settings (paste JSON)"),
          ta,
          h(
            "button",
            {
              class: "hk",
              style: "margin-top:4px;width:100%",
              "data-importbtn": "",
              onclick: () => {
                if (ta.value.trim()) importSettings(ta.value.trim());
              },
            },
            "Import",
          ),
        ),
        row(
          "Reset all to defaults",
          h(
            "button",
            {
              class: "hk",
              style: "color:#f66",
              "data-reset": "",
              onclick: () => {
                if (confirm("Reset all settings to defaults?")) resetSettings();
              },
            },
            "Reset",
          ),
        ),
      );
    };

    function arm(m, b) {
      armed = m;
      b.textContent = "Press…";
      b.classList.add("arm");
      if (capFn) window.removeEventListener("keydown", capFn, true);
      capFn = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        window.removeEventListener("keydown", capFn, true);
        capFn = null;
        armed = null;
        if (e.metaKey || !(e.altKey || e.ctrlKey || e.shiftKey)) return render();
        applyEdit(
          m,
          () => {
            C[m].toggleHotkey = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey, key: e.key.toLowerCase() };
          },
          false,
        );
      };
      window.addEventListener("keydown", capFn, true);
    }

    function render() {
      const sh = root.shadowRoot,
        was = {};
      for (const d of qa("details[data-s]", sh)) was[d.getAttribute("data-s")] = d.open;
      const hm = healthScan(healthArmed());
      sh.replaceChildren(
        h("style", null, PCSS),
        h("div", { class: "bk", onclick: close }),
        h(
          "div",
          { class: "cd", role: "dialog" },
          h(
            "div",
            { class: "hd" },
            h("h1", null, "🧼 Web Cleaner ", h("span", { style: "font-size:10px;font-weight:400;color:#777" }, "v" + VERSION)),
            h("button", { class: "x", onclick: close }, "✕"),
          ),
          hm > 0
            ? h(
                "div",
                { class: "cu", style: "color:#e6b34d;padding:4px 0;border-top:1px solid #27282c" },
                `⚠ ${hm} sponsored label${hm > 1 ? "s" : ""} still visible — this site's markup may have changed. Filtering is degraded, not broken.`,
              )
            : null,
          secSB(),
          secVM(),
          Object.keys(MODULES)
            .filter((n) => MODULES[n].on)
            .map(secModule),
          secIO(),
        ),
      );
      for (const d of qa("details[data-s]", sh)) if (was[d.getAttribute("data-s")]) d.open = true;
    }

    function open() {
      if (root) return close();
      if (!document.body) return;
      root = h("div", { id: "wc-panel", style: "all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:all" });
      root.attachShadow({ mode: "open" });
      document.body.appendChild(root);
      render();
      document.addEventListener("keydown", onEsc, true);
    }
    function close() {
      if (capFn) window.removeEventListener("keydown", capFn, true);
      capFn = null;
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

  const BTN = "border:0;border-radius:10px;cursor:pointer;-webkit-appearance:none;";
  const CBTN =
    "width:32px;height:32px;border-radius:50%;border:none;cursor:pointer;font-size:15px;line-height:32px;padding:0;text-align:center;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 6px rgba(0,0,0,.35);transition:transform .1s,opacity .15s;-webkit-appearance:none;";

  function initCluster() {
    if (document.getElementById("wc-cl")) return;
    const cl = h("div", {
      id: "wc-cl",
      style:
        "position:fixed;z-index:2147483647;display:flex;flex-direction:column;gap:3px;touch-action:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;padding:3px;border-radius:20px;background:rgba(0,0,0,.12)",
    });
    const place = (l, t) => {
      cl.style.left = clamp(l, 0, innerWidth - 38) + "px";
      cl.style.top = clamp(t, 0, innerHeight - 38) + "px";
      cl.style.right = cl.style.bottom = "auto";
    };
    const saved = lsGet("clpos", null);
    if (saved?.l != null) place(saved.l, saved.t);
    else {
      cl.style.right = "6px";
      cl.style.bottom = "calc(16px + env(safe-area-inset-bottom))";
    }
    const btn = (icon, bg, color, opacity, id) => cl.appendChild(h("button", { id, style: `${CBTN}background:${bg};color:${color};opacity:${opacity}`, "aria-label": icon }, icon));

    let sx = 0,
      sy = 0,
      drag = false,
      aptr = null,
      dragEndAt = 0,
      lt = null;
    const clearLT = () => {
      clearTimeout(lt);
      lt = null;
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
        place(e.clientX - 19, e.clientY - 19);
      }
    });
    cl.addEventListener("pointerup", (e) => {
      if (drag) {
        dragEndAt = Date.now();
        try {
          cl.releasePointerCapture(e.pointerId);
        } catch (_) {}
        lsSet("clpos", { l: parseInt(cl.style.left), t: parseInt(cl.style.top) });
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

    btn("🧼", "#1c1c2e", "#fff", ".8").addEventListener("click", () => {
      if (tapOk()) Panel.open();
    });
    if (C.viewMode.showButton) {
      const vb = btn(vmMode === "desktop" ? "🖥" : vmMode === "mobile" ? "📱" : "🔄", "rgba(20,20,34,.8)", "#fff", ".7");
      vb.addEventListener("pointerdown", () => {
        clearLT();
        lt = setTimeout(() => {
          lt = null;
          if (!drag) setVM("auto");
        }, C.viewMode.longPressMs);
      });
      vb.addEventListener("pointerup", () => {
        const wasArmed = !!lt;
        clearLT();
        if (wasArmed && tapOk()) setVM(vmMode === "desktop" ? "mobile" : "desktop");
      });
      vb.addEventListener("pointercancel", clearLT);
    }
    for (const [name, m] of Object.entries(MODULES))
      if (m.on && C[name].showToggleButton)
        btn(m.icon, "#fff", "#111", C[name].enabled ? "1" : ".3", m.btn).addEventListener("click", () => {
          if (tapOk()) toggleModule(name, !C[name].enabled);
        });
    document.body.appendChild(cl);
  }

  function initSB() {
    function showBlock(why) {
      try {
        window.stop();
      } catch (_) {}
      document.documentElement.replaceChildren(
        h("head", null, h("meta", { charset: "utf-8" }), h("meta", { name: "viewport", content: "width=device-width,initial-scale=1,viewport-fit=cover" }), h("title", null, "Blocked")),
        h(
          "body",
          {
            id: "wc-blk",
            style:
              "margin:0;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;padding:24px 20px;font-family:-apple-system,system-ui,sans-serif;background:#0c0c0e;color:#ddd",
          },
          h("div", { style: "font-size:40px" }, "⛔"),
          h("div", { style: "font-size:18px;font-weight:700" }, "Blocked"),
          h("div", { style: "opacity:.55;max-width:22rem;font-size:13px;line-height:1.4" }, `${bare()} — ${why}.`),
          h(
            "button",
            {
              style: `${BTN}padding:8px 18px;font-size:13px;font-weight:600;background:#2a2a30;color:#ddd`,
              onclick: () => {
                sbSnooze(C.siteBlocker.snoozeMinutes);
                location.reload();
              },
            },
            `Allow ${C.siteBlocker.snoozeMinutes} min`,
          ),
          h("button", { style: `${BTN}padding:6px 14px;font-size:12px;background:#1a1a1e;color:#888`, onclick: Panel.open }, "⚙ Manage"),
        ),
      );
      initCluster();
    }
    const check = () => {
      try {
        const w = blockReason();
        if (w && !document.getElementById("wc-blk")) showBlock(w);
      } catch (_) {}
    };
    onRoot(check);
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

  const feedHider = (attr) => {
    let held = null;
    const api = (on, find) => {
      if (held && !held.isConnected) held = null;
      if (!on) {
        held?.removeAttribute(attr);
        held = null;
        return null;
      }
      if (!held) {
        held = q(`[${attr}]`) || find();
        held?.toggleAttribute(attr, true);
      }
      return held;
    };
    api.held = () => held;
    return api;
  };

  const MODULES = {
    facebook: { on: isFB, icon: "🧹", label: "FB", style: "fcf-css", btn: "fcf-btn", init: initFB },
    youtube: { on: isYT, icon: "⏭", label: "YT", style: "yt-css", btn: "yt-btn", init: initYT },
    linkedin: { on: isLI, icon: "💼", label: "LinkedIn", style: "li-css", btn: "li-btn", init: initLI },
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

  function runModule(name, { css, sweep, fast, every, rescue }) {
    const m = MODULES[name],
      on = () => C[name].enabled;
    onRoot(() => {
      addStyle(m.style, css);
      document.getElementById(m.style).disabled = !on();
    });
    const guarded = (fn) => {
      if (!on()) return;
      try {
        fn();
      } catch (_) {}
    };
    const tick = () => {
      navCheck();
      guarded(sweep);
      if (rescue && Health.miss > 0) guarded(() => rescueSweep(rescue.hit, rescue.attr, 12));
    };
    const schedule = debounced(tick);
    let raf = false;
    const onMutate = () => {
      schedule();
      if (fast && !raf) {
        raf = true;
        requestAnimationFrame(() => {
          raf = false;
          guarded(fast);
        });
      }
    };
    if (rescue) healthArmed = () => on() && rescue.armed();
    onReady(() => {
      tick();
      if (fast) guarded(fast);
      new MutationObserver(onMutate).observe(document.documentElement, { childList: true, subtree: true });
      document.addEventListener("scroll", schedule, { passive: true, capture: true });
      setInterval(tick, every);
      if (rescue)
        setInterval(() => {
          const b = document.getElementById(m.btn);
          if (b) b.style.boxShadow = healthScan(healthArmed()) > 0 ? "0 0 0 2px #e6b34d" : "";
        }, 6000);
    });
    onHotkey(
      () => C[name].toggleHotkey,
      () => toggleModule(name, !on()),
    );
  }

  function initFB() {
    const f = C.facebook;
    const isFeed = () => location.pathname === "/" || location.pathname === "/home.php";
    if (f.forceMostRecent && isFeed() && !/[?&]sk=/.test(location.search)) {
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
    const AI_MARKS =
      "aicontent aigenerated generatedbyai imaginedwithai madewithai createdwithai aiinfo aigeneratedcontent metaai askmetaai trymetaai aistudio poweredbyai chatwithai aiimage contenidodeia contenidogeneradoconia contenuia genereparlia kiinhalt mitkigeneriert aiコンテンツ ai콘텐츠 محتوىالذكاءالاصطناعي محتوىمولدبالذكاءالاصطناعي"
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
    const TRAYS = f.hideReelsTrays ? ["reels", "reelsandshortvideos", "stories"] : [];
    const adTok = f.hideSponsored ? adToken : () => false;
    const isJunk = (c) => MARKS.some((m) => c.includes(m)) || TRAYS.includes(c) || (f.hideSponsored && AD_WORDS.has(c));
    const hit = (t) => {
      const c = norm(t);
      return MARKS.some((m) => c.includes(m));
    };

    if (f.blockAdData) {
      // Translated from uBlock Origin's maintained Facebook filters: drop `node` from feed edges whose category is
      // SPONSORED, drop any `node` carrying a SponsoredData child, and drop `nodes[]` entries with sponsored_data.
      const sponsoredNode = (n) => Object.values(n).some((v) => v && typeof v === "object" && v.__typename === "SponsoredData");
      const edit = (root) => {
        let changed = false;
        const walk = (o, key, owner, d) => {
          if (!o || typeof o !== "object" || d > 40) return;
          if (Array.isArray(o)) {
            if (key === "nodes")
              for (let i = o.length - 1; i >= 0; i--)
                if (o[i]?.sponsored_data) {
                  o.splice(i, 1);
                  changed = true;
                }
            for (const e of o) walk(e, null, o, d + 1);
            return;
          }
          if (key === "node" && sponsoredNode(o)) {
            delete owner.node;
            changed = true;
            return;
          }
          if (o.category === "SPONSORED" && "node" in o) {
            delete o.node;
            changed = true;
          }
          for (const k of Object.keys(o)) walk(o[k], k, o, d + 1);
        };
        walk(root, null, null, 0);
        return changed;
      };
      const pre = /"(SPONSORED|SponsoredData|sponsored_data)"/;
      hookResponses(PW, /^https?:\/\/[^/]+\/api\/graphql\b/, textEditor(pre, edit, true));
      hookParse(PW, pre, edit);
      maskNatives(PW);
      guardFrames(PW, (cw) => {
        cw.fetch = PW.fetch;
        cw.XMLHttpRequest = PW.XMLHttpRequest;
        cw.JSON = PW.JSON;
        cw.Function.prototype.toString = PW.Function.prototype.toString;
      });
    }

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
    if (f.hideFeed) R.push(`${X}[data-fcf-gone]{display:none!important}`);
    if (f.widenFeed)
      R.push(
        `${X}[role="main"]{max-width:none!important;width:100%!important;margin:0 auto!important}`,
        `${X}[data-fcf-w]{width:auto!important;max-width:none!important;min-width:0!important}`,
        `${X}[data-fcf-feed]{width:min(${f.feedMaxWidth}px,97vw)!important;max-width:none!important;min-width:0!important;margin:0 auto!important}`,
        `${X}[data-fcf-feed]>*{width:100%!important;max-width:none!important;min-width:0!important}`,
      );
    else R.push(`${X}[role="main"]{margin-left:auto!important;margin-right:auto!important}`);
    if (f.hideVideoAutoplay) R.push("video{pointer-events:auto}");

    const muteVids = () => {
      for (const v of document.querySelectorAll("video:not([data-fcf-muted])")) {
        v.setAttribute("data-fcf-muted", "");
        v.muted = true;
        v.autoplay = false;
        try {
          v.pause();
        } catch (_) {}
      }
    };

    const FOLLOW = new Set(
      ["follow", "seguir", "suivre", "folgen", "segui", "volgen", "takip et", "följ", "følg", "obserwuj", "متابعة", "подписаться", "フォロー", "팔로우", "关注", "關注", ...f.extraJunkPhrases].map(
        norm,
      ),
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

    const hasDesktopShell = () => !!q('[role="main"]');
    const isClean = () => {
      const pp = location.pathname.replace(/\/$/, "");
      return isFeed() || pp === "/groups/feed" || pp === "/watch" || /^\/groups\/[^/]+$/.test(pp);
    };

    let _feed = null,
      _skipEl = null,
      _skipN = 0,
      _skipT = 0,
      _composerDone = false;
    onNav(() => {
      _feed = null;
      _skipEl = null;
      _skipN = 0;
      _composerDone = false;
    });

    function tagWiden(fd) {
      if (!f.widenFeed || !fd) return;
      fd.toggleAttribute("data-fcf-feed", true);
      const main = q('[role="main"]');
      for (let n = fd.parentElement; n && n !== main; n = n.parentElement) n.toggleAttribute("data-fcf-w", true);
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
      const seen = new Set(),
        keep = [];
      for (const p of pts.filter((x) => Math.abs(x.y - minY) <= 3).sort((a, b) => a.x - b.x)) {
        if (seen.has(p.x)) continue;
        seen.add(p.x);
        keep.push(p.c);
      }
      return keep.join("").trim();
    }
    const OBFUSCATED = (el) => {
      const t = el.textContent || "";
      return t.length >= 20 && t.length <= 220 && hasZW(t) && el.querySelectorAll("span").length >= 15;
    };

    function labelHit(el) {
      const raw = (el.textContent || "").trim();
      if (!raw) return false;
      if (OBFUSCATED(el)) {
        const seen = norm(paintedLabel(el));
        return !!seen && seen.length <= 30 && isJunk(seen);
      }
      if (raw.length <= 40 && isJunk(norm(raw))) return true;
      return raw.length <= 200 && adTok(raw);
    }

    function storyOf(el, main) {
      const r = el.getBoundingClientRect();
      let n = el;
      for (let i = 0; i < 18 && n.parentElement; i++) {
        n = n.parentElement;
        if (n === main || n === document.body) break;
        const rr = n.getBoundingClientRect();
        if (rr.width >= 400 && rr.height >= 150 && r.top - rr.top <= 160) return n;
      }
      return null;
    }

    const hide = (el, st) => {
      el.setAttribute("data-fcf", "");
      Object.assign(st, { v: "junk", hidden: true });
    };

    function processDesktop() {
      const main = q('[role="main"]');
      if (!main) return;
      const vh = innerHeight;
      let hid = 0;
      const obf = [...main.querySelectorAll("span,a,div")].filter(OBFUSCATED);
      for (const e of [...main.querySelectorAll('span,a,h3,h4,div[role="heading"]'), ...obf]) {
        if (hid >= 12) break;
        if (e.closest('[role="complementary"]')) continue;
        const er = e.getBoundingClientRect();
        if (!er.height || er.bottom < -400 || er.top > vh + 400) continue;
        if (!labelHit(e)) continue;
        const story = storyOf(e, main);
        if (!story) continue;
        const st = fresh(story, "data-fcf");
        if (st.hidden) continue;
        hide(story, st);
        hid++;
      }
      for (const st of main.querySelectorAll('[role="article"]')) {
        const r0 = fresh(st, "data-fcf");
        if (r0.v) continue;
        const r = st.getBoundingClientRect();
        if (r.height < 60 || r.bottom < -500 || r.top > vh + 500) continue;
        if (hasFollowBtn(st, r.top) || (f.hideReelsTrays && st.querySelectorAll('a[href*="/reel/"]').length > 3)) hide(st, r0);
        else if (++r0.keep >= 6) r0.v = "keep";
      }
    }

    function processCards() {
      const scope = q('[role="main"]');
      if (!scope) return;
      const vh = innerHeight,
        lim = Math.min(560, innerWidth * 0.55);
      const fits = (rr) => rr.width >= 120 && rr.width <= lim && rr.height >= 80 && rr.height <= 620 && rr.bottom >= -500 && rr.top <= vh + 500;
      for (const el of scope.querySelectorAll("div,a")) {
        if (!fits(el.getBoundingClientRect())) continue;
        const r0 = fresh(el, "data-fcf");
        if (r0.v) continue;
        if (tightestMatch(el, hit, fits)) hide(el, r0);
        else if (++r0.keep >= 6) r0.v = "keep";
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

    const reelScroller = () => (onReelsRoute() ? q('[class*="vscroller"]') : null);
    const reelSlots = (sc) => [...sc.children].filter((e) => !/filler/.test(String(e.className || "")));

    function feedSlots() {
      const sc = reelScroller();
      if (sc) return reelSlots(sc);
      if (hasDesktopShell()) return [];
      const out = new Set();
      for (const p of mobilePostNodes()) out.add(slotOf(p));
      for (const w of document.querySelectorAll("div.displayed")) if (fixedH(w)) out.add(w);
      return out;
    }

    function hideMobileFeed(on) {
      if (!on) {
        for (const el of document.querySelectorAll("[data-fcf-gone]")) el.removeAttribute("data-fcf-gone");
        return false;
      }
      let n = 0;
      for (const s of feedSlots()) {
        s.toggleAttribute("data-fcf-gone", true);
        n++;
      }
      return n > 0;
    }

    function retire(el, r0) {
      if (hasDesktopShell()) return hide(el, r0);
      try {
        el.remove();
      } catch (_) {
        hide(el, r0);
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
        const seen = norm(visText(e, 60));
        if (seen && seen.length <= 40 && isJunk(seen)) return true;
      }
      return false;
    }

    function processSlots() {
      const reels = !!reelScroller();
      const docH = document.documentElement.scrollHeight;
      for (const el of feedSlots()) {
        const r0 = fresh(el, "data-fcf");
        if (r0.v) continue;
        if (el.querySelectorAll("[data-tracking-duration-id]").length > 1) continue;
        const r = el.getBoundingClientRect();
        if (!r.height) continue;
        if (junkIn(el) || adTok(visText(el, 300, r.top - 2, r.top + 130)) || hasFollowBtn(el, r.top)) {
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

    const fullWidth = (r, vw) => r.width >= vw * 0.9 && r.width <= vw * 1.02;
    const hideTabStrips = () => {
      if (f.hideTopBar) for (const tl of document.querySelectorAll('[role="tablist"]:not([data-fcf])')) tl.setAttribute("data-fcf", "");
    };
    const _chromeChecked = new WeakSet();
    function hideMobileComposer() {
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
        if (!fullWidth(r, vw) || r.height < 50 || r.height > 95) continue;
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
        if (!fullWidth(r, vw) || r.height < 150 || r.height > 340) continue;
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
    function activeReel() {
      const sc = reelScroller();
      const box = sc ? sc.getBoundingClientRect() : { top: 0, height: innerHeight };
      const cy = box.top + box.height / 2;
      let best = null,
        d = 1e9;
      for (const e of sc ? reelSlots(sc) : document.querySelectorAll("video")) {
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
      if (sc) return sc.scrollBy(0, sc.clientHeight);
      const nx = q('[role="button"][aria-label="Next Card"]');
      if (nx) return nx.click();
      const tg = rl.closest("[tabindex]") || rl;
      for (const tp of ["keydown", "keyup"]) tg.dispatchEvent(new KeyboardEvent(tp, { key: "ArrowDown", code: "ArrowDown", keyCode: 40, which: 40, bubbles: true }));
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

    function handleReels() {
      if (!f.skipReelsAds || !onReelsRoute()) return;
      const act = activeReel();
      if (!act) return;
      let rl = act;
      if (!reelScroller())
        for (let i = 0; i < 12 && rl.parentElement; i++) {
          rl = rl.parentElement;
          if (rl.querySelector('[aria-label="Like"],[aria-label^="Comment"],[role="button"][aria-label="Next Card"]')) break;
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
      const hn = cleanUrl(location.href);
      if (hn) history.replaceState(history.state, "", hn);
      for (const a of document.querySelectorAll('a[href^="http"]:not([data-fcf-cl])')) {
        a.setAttribute("data-fcf-cl", "");
        const c = cleanUrl(a.getAttribute("data-lynx-uri") || a.href);
        if (c) a.href = c;
        a.removeAttribute("ping");
        a.removeAttribute("data-lynx-uri");
      }
    }

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

    const hideFeedNode = feedHider("data-fcf-gone");

    function sweep() {
      if (f.stripTracking) cleanLinks();
      const onFeed = isFeed(),
        desktop = hasDesktopShell();
      document.documentElement.classList.toggle("fcf-s", onFeed);
      if (desktop) hideLeftNav();
      else if (onFeed) hideTabStrips();
      const want = f.hideFeed && onFeed;
      if (desktop ? !!hideFeedNode(want, feedBox) : hideMobileFeed(want)) return;
      keepScrollAnchored(processSlots);
      handleReels();
      if (desktop) {
        if (f.widenFeed) feedBox();
        keepScrollAnchored(() => {
          if (isClean()) processDesktop();
          processCards();
        });
      } else if (onFeed && scanDue()) {
        hideTrayRows();
        hideMobileComposer();
      }
    }

    onRoot(() => document.documentElement.classList.toggle("fcf-s", isFeed()));
    runModule("facebook", { css: R.join("\n"), sweep, fast: f.hideVideoAutoplay ? muteVids : null, every: 1200, rescue: { hit, attr: "data-fcf", armed: () => f.hideSponsored } });
  }

  function initYT() {
    const y = C.youtube;

    if (y.blockAdData) {
      // No JSON.parse hook here: YouTube runs a canary through JSON.parse that must stay intact. See README 8.22.0.
      // A pre-roll placement must survive: the player reports a response that lost its KIND_START slot.
      const isStart = (p) => p?.adPlacementRenderer?.config?.adPlacementConfig?.kind === "AD_PLACEMENT_KIND_START";
      const scrub = (o, d) => {
        if (!o || typeof o !== "object" || d > 8) return o;
        if (Array.isArray(o)) {
          for (let i = o.length - 1; i >= 0; i--) {
            if (o[i]?.command?.reelWatchEndpoint?.adClientParams?.isAd) o.splice(i, 1);
            else scrub(o[i], d + 1);
          }
          return o;
        }
        if (Array.isArray(o.adPlacements)) {
          const st = o.adPlacements.find(isStart);
          o.adPlacements = st ? [{ adPlacementRenderer: { config: st.adPlacementRenderer.config, renderer: { clientForecastingAdRenderer: {} } } }] : [];
        }
        delete o.playerAds;
        delete o.adSlots;
        delete o.auxiliaryUi?.messageRenderers?.bkaEnforcementMessageViewModel;
        delete o.playabilityStatus?.errorScreen?.enforcementMessageViewModel;
        for (const k in o) if (Object.hasOwn(o, k)) scrub(o[k], d + 1);
        return o;
      };
      const guard = (o) => {
        try {
          return scrub(o, 0);
        } catch (_) {
          return o;
        }
      };
      for (const prop of ["ytInitialPlayerResponse", "ytInitialData"]) {
        try {
          if (Object.getOwnPropertyDescriptor(PW, prop)) continue;
          let held;
          Object.defineProperty(PW, prop, {
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
      hookResponses(
        PW,
        /^https?:\/\/[^/]+\/youtubei\/v\d+\//,
        textEditor(/"(adPlacements|adSlots|playerAds|isAd|bkaEnforcementMessageViewModel|enforcementMessageViewModel)"/, (o) => !!guard(o), false),
      );
      guardFrames(PW, (cw) => {
        cw.fetch = PW.fetch;
        cw.XMLHttpRequest = PW.XMLHttpRequest;
      });
    }

    // #masthead-ad and #player-ads are scoped to the app root: YouTube appends bare decoys with those ids to <body>
    // and scores them computing to display:none as detected.
    const SEL = {
      ban: "ytd-app #masthead-ad,ytm-app #masthead-ad,ytd-app #player-ads,ytm-app #player-ads,ytmusic-app #player-ads,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,ytm-companion-slot,ytm-companion-ad-renderer,.ytp-ad-overlay-slot,.ytp-ad-overlay-container,.ytp-ad-image-overlay",
      feed: "ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-video-renderer,ytd-promoted-sparkles-web-renderer,ytd-search-pyv-renderer,ytm-companion-slot,ytm-companion-ad-renderer,ytm-promoted-video-renderer,ytm-search-pyv-renderer,ytm-promoted-sparkles-web-renderer,ad-slot-renderer,ad-disclosure-banner-view-model",
      wrap: "ytd-rich-item-renderer,ytd-rich-section-renderer,ytd-item-section-renderer,ytm-rich-item-renderer,ytm-rich-section-renderer,ytm-item-section-renderer,ytm-media-item",
      skip: ".ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container button,.ytp-ad-skip-ad-slot button",
      clos: ".ytp-ad-overlay-close-button,.ytp-ad-overlay-close-container button",
      adui: ".ytp-ad-player-overlay,.ytp-ad-player-overlay-layout,.ytp-ad-player-overlay-instream-info,.ytp-ad-preview-container,.ytp-ad-badge,.ytp-ad-simple-ad-badge,.ytp-ad-duration-remaining,.ytp-ad-persistent-progress-bar,.ytp-ad-progress,.ytp-ad-skip-button-container",
    };
    const AD_CLS = ["ad-showing", "ad-interrupting"];
    const hasC = (el, cl) => !!el && cl.some((c) => el.classList.contains(c));
    const adPresenting = (el) => {
      try {
        const t = typeof el?.getPresentingPlayerType === "function" ? el.getPresentingPlayerType() : -1;
        return t === 2 || t === 3;
      } catch (_) {
        return false;
      }
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
    // The enforcement node is kept at display:block: YouTube scores it missing or display:none as detected.
    if (y.dismissAntiAdblock)
      rules.push(
        "ytd-enforcement-message-view-model{display:block!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;position:fixed!important;left:-99999px!important;top:-99999px!important;width:1px!important;height:1px!important;overflow:hidden!important}",
        "tp-yt-paper-dialog:has(ytd-enforcement-message-view-model),tp-yt-iron-overlay-backdrop{display:none!important}",
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
    const css =
      (hideRules.length ? hideRules.join(",") + "{display:none!important}\n" : "") +
      (watchOnly.length ? watchOnly.map((s) => `html[data-yt-watch] ${s}`).join(",") + "{display:none!important}\n" : "") +
      rules.filter((r) => r.includes("{")).join("\n");

    const markWatch = () => document.documentElement.toggleAttribute("data-yt-watch", location.pathname === "/watch");
    onRoot(markWatch);
    const nudge = (fn, times) => {
      const go = () => times.forEach((t) => setTimeout(fn, t));
      onReady(go);
      onNav(go);
    };
    if (y.hideAutoplay)
      nudge(() => {
        const ap = q(".ytp-autonav-toggle-button");
        if (ap && ap.getAttribute("aria-checked") === "true") ap.click();
      }, [0, 600, 1800]);
    if (y.hideRelated && y.widenPlayer) nudge(() => window.dispatchEvent(new Event("resize")), [0, 300, 900, 2000]);

    let muted = false,
      lastShort = 0,
      adTicks = 0;
    const _dismissedEnf = new WeakSet();
    onNav(() => {
      lastShort = 0;
      adTicks = 0;
    });

    function sweep() {
      markWatch();
      if (y.dismissAntiAdblock) {
        const enf = q("ytd-enforcement-message-view-model");
        if (enf && !_dismissedEnf.has(enf)) {
          _dismissedEnf.add(enf);
          enf.closest("tp-yt-paper-dialog")?.style.setProperty("display", "none", "important");
          q("tp-yt-iron-overlay-backdrop")?.remove();
          document.body?.style.removeProperty("overflow");
          const vi = q("video");
          if (vi?.paused) vi.play().catch(() => {});
        }
      }
      if (y.skipVideoAds) {
        const pl = q("#movie_player,.html5-video-player"),
          v = q(".html5-video-player video") || q("video");
        const adActive = adPresenting(pl) || (hasC(pl, AD_CLS) && (!!q(SEL.skip) || !!q(SEL.adui)));
        if (adActive) {
          adTicks++;
          // The skip button is never clicked and seeking is off by default: YouTube scores an untrusted click
          // as detected and refuses it, and reports any seek inside an ad.
          if (v) {
            if (y.muteAds && !v.muted) {
              v.muted = true;
              muted = true;
            }
            if (y.seekPastAds && isFinite(v.duration) && v.duration > 1 && v.duration <= 180 && (!q(SEL.skip) || adTicks >= 3)) v.currentTime = v.duration - 0.1;
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
        const adOn =
          adPresenting(sp) ||
          (hasC(sp, AD_CLS) && !!q(".ytp-ad-player-overlay,.ytp-ad-preview-container,ytd-ad-slot-renderer,ad-slot-renderer")) ||
          !!q(
            "ytd-reel-video-renderer ad-slot-renderer,ytd-reel-video-renderer ytd-ad-slot-renderer,ytd-shorts ytd-ad-slot-renderer,ytd-shorts ad-slot-renderer,ytd-reel-player-renderer ad-slot-renderer",
          );
        if (adOn && Date.now() - lastShort > 700) {
          lastShort = Date.now();
          const nx = q('#navigation-button-down button,button[aria-label="Next video"],button[aria-label="Next Short"]');
          nx ? nx.click() : document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        }
      }
      if (y.hideFeedAds) for (const ad of document.querySelectorAll(SEL.feed)) ad.closest(SEL.wrap)?.setAttribute("data-yt-h", "");
    }

    runModule("youtube", { css, sweep, every: 1000, rescue: { hit: labelled, attr: "data-yt-h", armed: () => y.hideFeedAds } });
  }

  function initLI() {
    const L = C.linkedin;
    const LR = ["[data-li-h]{display:none!important}", "[data-li-rail]{display:none!important}", "[data-li-gone]{display:none!important}"];
    if (L.widenFeed)
      LR.push(`[data-li-feed]{width:min(${L.feedMaxWidth}px,97vw)!important;max-width:none!important;margin:0 auto!important}`, `[data-li-feed]>*{width:100%!important;max-width:none!important}`);

    const onLIFeed = () => /^\/feed(\/|$)/.test(location.pathname);
    const hideLIFeed = feedHider("data-li-gone");
    let _liFeed = null;

    function tagChrome() {
      if (L.hideTopBar)
        for (const hd of document.querySelectorAll("header:not([data-li-h])")) {
          const r = hd.getBoundingClientRect();
          if (r.width >= innerWidth * 0.9 && r.height >= 40 && r.top + scrollY < 120) hd.setAttribute("data-li-h", "");
        }
      if (!hideLIFeed.held()) {
        const fhi = Math.max(760, Math.min(innerWidth * 0.8, 1400)),
          flo = Math.min(380, innerWidth * 0.9);
        const chrome = q("header,nav,[role='banner'],[role='navigation']");
        let found = null,
          fkids = 0,
          fw = 0;
        for (const e of document.querySelectorAll("div,main,section")) {
          const r = e.getBoundingClientRect();
          if (r.width < flo || r.width > fhi || r.height < 400) continue;
          if ((e.innerText || "").length < 500) continue;
          if (chrome && e.contains(chrome)) continue;
          const kids = e.children.length;
          if (kids > fkids || (kids === fkids && found && r.width < fw)) {
            found = e;
            fkids = kids;
            fw = r.width;
          }
        }
        if (found) {
          _liFeed = found;
          if (L.widenFeed) found.toggleAttribute("data-li-feed", true);
        }
      }
      const feed = _liFeed;
      if (!feed) return;
      for (const e of document.querySelectorAll("aside:not([data-li-rail])")) {
        if (e === feed || e.contains(feed) || feed.contains(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.height < 200 || r.width < 140 || r.width > 420) continue;
        const left = r.left + r.width / 2 < innerWidth / 2;
        if (left ? L.hideLeftRail : L.hideRightRail) e.setAttribute("data-li-rail", "");
      }
    }

    const MK = [...(L.hidePromoted ? LABELS : []), ...(L.hideSuggested ? ["suggested", "peopleyoumayknow", "recommendedforyou"] : [])];
    const hit = (t) => {
      const c = norm(t);
      return MK.some((m) => c.includes(m)) || (L.hidePromoted && adToken(t));
    };
    function sweep() {
      tagChrome();
      if (hideLIFeed(L.hideFeed && onLIFeed(), () => _liFeed) || !MK.length) return;
      const vh = document.documentElement.clientHeight || 600,
        hi = Math.max(innerWidth * 0.9, 700);
      const fits = (rr) => rr.width >= 280 && rr.width <= hi && rr.height >= 100 && rr.height <= Math.max(vh * 2, 1400) && rr.bottom >= -500 && rr.top <= vh + 500;
      let hid = 0;
      for (const el of document.querySelectorAll("div,article,section,li")) {
        if (hid >= 15) break;
        if (_liFeed && (el === _liFeed || el.contains(_liFeed))) continue;
        if (!fits(el.getBoundingClientRect())) continue;
        const r0 = fresh(el, "data-li-h");
        if (r0.v) continue;
        if (!tightestMatch(el, hit, fits, 130)) {
          if (++r0.keep >= 6) r0.v = "keep";
          continue;
        }
        Object.assign(r0, { v: "junk", hidden: true });
        el.setAttribute("data-li-h", "");
        hid++;
      }
    }
    runModule("linkedin", { css: LR.join("\n"), sweep, every: 1500 });
  }

  function regMenu() {
    const modern = GMNS && typeof GMNS.registerMenuCommand === "function";
    if (!modern && typeof GM_registerMenuCommand !== "function") return;
    const reg = (label, fn) => {
      try {
        (modern ? GMNS.registerMenuCommand : GM_registerMenuCommand)(label, fn);
      } catch (_) {}
    };
    const hn = bare();
    const sb = (fn) => () => applyEdit("siteBlocker", fn, "block");
    reg("⚙ Web Cleaner", Panel.open);
    reg(
      `${C.siteBlocker.enabled ? "⛔ ON" : "✅ OFF"} toggle`,
      sb(() => {
        C.siteBlocker.enabled = !C.siteBlocker.enabled;
      }),
    );
    reg(
      `➕ Block ${hn}`,
      sb(() => {
        if (!C.siteBlocker.custom.includes(hn)) C.siteBlocker.custom.push(hn);
        C.siteBlocker.allow = C.siteBlocker.allow.filter((d) => d !== hn);
      }),
    );
    reg(
      `➖ Allow ${hn}`,
      sb(() => {
        if (!C.siteBlocker.allow.includes(hn)) C.siteBlocker.allow.push(hn);
        C.siteBlocker.custom = C.siteBlocker.custom.filter((d) => d !== hn);
      }),
    );
    for (const [name, m] of Object.entries(MODULES)) if (m.on) reg(`${m.icon} ${m.label} ${C[name].enabled ? "ON" : "OFF"}`, () => toggleModule(name, !C[name].enabled));
    reg("🖥 Desktop", () => setVM("desktop"));
    reg("📱 Mobile", () => setVM("mobile"));
    reg("↺ Auto", () => setVM("auto"));
  }

  const run = (fn) => {
    try {
      fn();
    } catch (_) {}
  };
  run(applyVMSpoof);
  run(initSB);
  run(initVM);
  onReady(initCluster);
  let pageBlocked = false;
  run(() => {
    pageBlocked = !!blockReason();
  });
  if (!pageBlocked) for (const m of Object.values(MODULES)) if (m.on) run(m.init);
  regMenu();
  hydrateShared(Object.keys(DEF));
})();
