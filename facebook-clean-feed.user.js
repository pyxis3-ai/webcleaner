// ==UserScript==
// @name         Facebook Clean Feed - Real Newsfeed Only
// @namespace    https://local/fb-clean-feed
// @version      2.7.0
// @description  Strips Facebook down to just your real newsfeed. Hides ads/Sponsored (beats FB's character-scramble obfuscation), Stories, Reels, "Suggested for you", "People you may know", and the left & right sidebars. Strips UTM/tracking params and unwraps l.php redirect links. Greasemonkey / Tampermonkey / Violentmonkey.
// @author       you
// @match        https://www.facebook.com/*
// @match        https://web.facebook.com/*
// @run-at       document-start
// @grant        none
// @noframes
// @downloadURL https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-clean-feed.user.js
// @updateURL   https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-clean-feed.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    hideRightSidebar:     true,   // Contacts / Sponsored / Birthdays column
    hideLeftSidebar:      true,   // Shortcuts / Friends / Groups / Marketplace rail
    hideSponsored:        true,   // ads (incl. the scrambled-"Sponsored" ones)
    hideSuggested:        true,   // "Suggested for you", pages/groups for you
    hidePeopleYouMayKnow: true,
    hideReelsTrays:       true,   // in-feed Reels / Stories trays (keeps the NEWSFEED clean; the Reels player still works)
    skipReelsAds:         true,   // on the full-screen Reels player, auto-skip Sponsored reels (keep watching the real ones)
    hideComposer:         true,   // the "What's on your mind?" box
    hideTopBar:           true,   // the blue bar (search, profile, notifications). NUCLEAR
    forceMostRecent:      true,   // jump Home to the chronological "Most Recent" feed (?sk=h_chr)
    feedZoom:             1,      // enlarge the feed into the empty space around it (1 = off). WARNING: any value >1 uses CSS zoom, which corrupts the Sponsored-label geometry FB relies on for obfuscation - ads then slip through. Leave at 1 for reliable ad-hiding; only raise it if you care more about a bigger feed than blocking ads.
    showToggleButton:     true,   // floating 🧹 button (bottom-right) to switch cleaning on/off
    toggleHotkey:         { ctrl: false, alt: true, shift: true, key: 'f' },  // Alt+Shift+F toggles cleaning on/off
    stripTracking:        true,   // strip UTM/fbclid/__tn__ etc. params and unwrap l.php redirect links

    extraJunkPhrases:     [],     // non-English ad labels, e.g. ['Patrocinado']
  };

  if (CONFIG.forceMostRecent) {
    const onHome = location.pathname === '/' || location.pathname === '/home.php';
    if (onHome && !/[?&]sk=/.test(location.search)) {
      location.replace('https://www.facebook.com/?sk=h_chr');
      return;
    }
  }

  const norm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[^a-z]/g, '');
  const SPONSORED_MARKS = ['sponsored', 'paidpartnership'];
  const INCLUDE_MARKS = [
    ...(CONFIG.hideSponsored ? SPONSORED_MARKS : []),
    ...(CONFIG.hideSuggested ? ['suggestedforyou', 'suggestedpost', 'pagesforyou', 'pagesyoumaylike', 'groupsyoumaylike'] : []),
    ...(CONFIG.hidePeopleYouMayKnow ? ['peopleyoumayknow'] : []),
    ...CONFIG.extraJunkPhrases.map(norm),
  ];
  const EXACT_MARKS = CONFIG.hideReelsTrays ? ['reels', 'reelsandshortvideos', 'stories'] : [];

  function injectStyle() {
    const P = 'html.fcf-strip:not(.fcf-off) ';
    const R = [P + '[data-fcf-hide]{display:none!important}'];
    if (CONFIG.hideRightSidebar) R.push(P + '[role="complementary"]{display:none!important}');
    if (CONFIG.hideLeftSidebar)  R.push(P + '[role="navigation"][aria-label="Shortcuts"]{display:none!important}');
    if (CONFIG.hideLeftSidebar)  R.push('html:not(.fcf-off) [data-fcf-leftnav]{display:none!important}');  // left rail, every page (not just the feed)
    if (CONFIG.hideComposer)     R.push(P + '[role="region"][aria-label="Create a post"]{display:none!important}');
    if (CONFIG.hideTopBar)       R.push(P + '[role="banner"],' + P + '[role="navigation"][aria-label="Facebook"],' + P + '[role="navigation"][aria-label="Account Controls and Settings"]{display:none!important}');
    if (CONFIG.hideReelsTrays)   R.push(P + '[aria-label="Stories"],' + P + '[aria-label="Reels"]{display:none!important}');
    R.push(P + '[role="main"]{margin-left:auto!important;margin-right:auto!important}');
    if (CONFIG.hideTopBar)       R.push(P + 'body{padding-top:0!important}');
    if (CONFIG.feedZoom && CONFIG.feedZoom !== 1) {
      R.push(P + '[data-fcf-feed]{zoom:' + CONFIG.feedZoom + '}');
      R.push('html.fcf-strip:not(.fcf-off){overflow-x:hidden}');
    }
    R.push('#fcf-toggle{position:fixed;z-index:2147483647;bottom:16px;right:16px;width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;font-size:18px;line-height:40px;padding:0;background:#fff;color:#111;box-shadow:0 2px 10px rgba(0,0,0,.35)}');
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
  const HEADER_BAND = 130;          // px below a story's top to scan for the Sponsored/Suggested label (FB headers got taller)
  const CLEAN_CONFIRMATIONS = 4;    // re-read an in-view post this many sweeps before trusting it as non-ad - FB injects the scrambled "Sponsored" label a beat AFTER the post first renders, so a one-shot read misses it
  function isJunkHeader(compact) {
    if (!compact) return false;
    for (const m of INCLUDE_MARKS) if (compact.includes(m)) return true;
    return EXACT_MARKS.includes(compact);
  }

  function processStories() {
    const feed = feedContainer();
    if (!feed) return;
    feed.setAttribute('data-fcf-feed', '');
    const vh = window.innerHeight;
    for (const story of feed.children) {
      if (story.__fcf === 'hidden') continue;   // hiding is permanent
      if (story.__fcf === 'clean') continue;    // settled non-ad (confirmed across several sweeps)
      const r = story.getBoundingClientRect();
      if (r.height < 60) continue;
      if (r.bottom < -VIEWPAD || r.top > vh + VIEWPAD) continue;
      const header = renderedText(story, r.top - 2, r.top + HEADER_BAND);
      if (!header) continue;                    // not hydrated yet - leave unsettled, re-check next sweep
      const junk = isJunkHeader(norm(header)) ||
        (CONFIG.hideReelsTrays && story.querySelectorAll('a[href*="/reel/"]').length > 3);
      if (junk) {
        story.setAttribute('data-fcf-hide', '');
        story.__fcf = 'hidden';
      } else if ((story.__fcfSeen = (story.__fcfSeen || 0) + 1) >= CLEAN_CONFIRMATIONS) {
        story.__fcf = 'clean';                  // only trust "clean" after FB has had time to inject a late "Sponsored" label
      }
    }
  }

  // The left navigation rail (Shortcuts / your groups / bookmarks) appears on EVERY
  // Facebook page, not just the feed, and FB dropped its aria-label so the CSS rule
  // misses it. Detect it by signature - a tall element pinned to the left edge - and
  // hide it site-wide. Runs on all pages; the feed-only strip handles everything else.
  function hideLeftRail() {
    if (!CONFIG.hideLeftSidebar) return;
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
    if (CONFIG.hideLeftSidebar) {
      for (const nav of document.querySelectorAll('[role="navigation"]')) {
        const r = nav.getBoundingClientRect();
        if (r.height > 350 && r.width > 120 && r.right <= mr.left + 8)
          nav.setAttribute('data-fcf-hide', '');
      }
    }
  }

  function addToggle() {
    if (!CONFIG.showToggleButton || !document.body || document.getElementById('fcf-toggle')) return;
    const b = document.createElement('button');
    b.id = 'fcf-toggle';
    b.textContent = '🧹';
    b.title = 'Toggle Facebook Clean Feed';
    b.addEventListener('click', toggleClean);
    document.body.appendChild(b);
  }
  function toggleClean() {
    const off = document.documentElement.classList.toggle('fcf-off');
    const b = document.getElementById('fcf-toggle');
    if (b) b.style.opacity = off ? '0.4' : '1';
  }

  let _handledReel = null, _lastSkip = 0;
  function handleReels() {
    if (!CONFIG.skipReelsAds || !/^\/reels?(\/|$)/.test(location.pathname)) return;
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
    if (!reelIsSponsored(reel)) return;
    const id = location.pathname;
    if (_handledReel === id || Date.now() - _lastSkip < 400) return;
    _handledReel = id; _lastSkip = Date.now();
    const next = document.querySelector('[role="button"][aria-label="Next Card"]');
    if (next) next.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  }
  // FB reels no longer tag "Sponsored" with positioned single-character spans (the old
  // hunt found zero candidates and never fired). Reconstruct the reel's overlay text by
  // geometry - the same un-scramble used on the feed - and look for the Sponsored mark.
  // Memoize per reel, but keep re-checking until found: FB injects the label a beat late.
  let _reelSponId = null, _reelSpon = false, _reelTries = 0;
  function reelIsSponsored(reel) {
    const id = location.pathname;
    if (_reelSponId !== id) { _reelSponId = id; _reelSpon = false; _reelTries = 0; }
    if (_reelSpon) return true;
    if (_reelTries >= 8) return false;
    _reelTries++;
    const r = reel.getBoundingClientRect();
    const c = norm(renderedText(reel, r.top - 2, r.bottom + 2));
    if (SPONSORED_MARKS.some((m) => c.includes(m))) _reelSpon = true;
    return _reelSpon;
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
      if (real) { try { u = new URL(real); dirty = true; } catch (e) {} }
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
  function sweep() {
    try {
      if (CONFIG.stripTracking) cleanTracking();
      hideLeftRail();                       // remove the left rail on every page
      const strip = isFeedPage();
      document.documentElement.classList.toggle('fcf-strip', strip);
      if (strip) { hardenStructure(); processStories(); }
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
    setInterval(sweep, 1500);
  }

  window.addEventListener('keydown', (e) => {
    const h = CONFIG.toggleHotkey;
    if (e.metaKey || e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift) return;
    if ((e.key || '').toLowerCase() !== h.key.toLowerCase()) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName || ''))) return;
    e.preventDefault();
    toggleClean();
  }, true);

  injectStyle();
  document.documentElement.classList.toggle('fcf-strip', isFeedPage());
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

})();
