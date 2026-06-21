// ==UserScript==
// @name         Facebook Mobile — Clean Feed
// @namespace    https://local/fb-mobile-clean-feed
// @version      1.1.0
// @description  Hides Sponsored / Suggested / People-you-may-know / Reels posts on the mobile site m.facebook.com. Companion to the desktop "Facebook Clean Feed" script. NOTE: built from the documented mobile DOM, not yet device-tested — tune the markers if an ad slips through or a real post is hidden. Greasemonkey / Tampermonkey / Violentmonkey (Firefox Android / iOS Userscripts).
// @author       you
// @match        https://m.facebook.com/*
// @run-at       document-start
// @grant        none
// @noframes
// @downloadURL https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-mobile-clean-feed.user.js
// @updateURL   https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/facebook-mobile-clean-feed.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    hideSponsored:        true,   // ads
    hideSuggested:        true,   // "Suggested for you"
    hidePeopleYouMayKnow: true,
    hideReels:            true,   // in-feed Reels trays
    extraJunkPhrases:     [],     // non-English equivalents, e.g. ['Patrocinado']
    toggleHotkey:         { ctrl: false, alt: true, shift: true, key: 'f' },  // Alt+Shift+F toggles cleaning on/off
  };

  const norm = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[^a-z]/g, '');
  const MARKS = [
    CONFIG.hideSponsored        && 'sponsored',
    CONFIG.hideSuggested        && 'suggestedforyou',
    CONFIG.hidePeopleYouMayKnow && 'peopleyoumayknow',
    CONFIG.hideReels            && 'reelsandshortvideos',
  ].filter(Boolean).map(norm).concat(CONFIG.extraJunkPhrases.map(norm));

  const POST = '[data-tracking-duration-id]';
  const LABELS = 'span, a[role="link"], h3, h4, div[role="heading"]';

  function isJunk(post) {
    for (const el of post.querySelectorAll(LABELS)) {
      const raw = (el.textContent || '').trim();
      if (!raw || raw.length > 40) continue;
      const t = norm(raw);
      if (t && MARKS.some((m) => t === m || t.startsWith(m))) return true;
    }
    return false;
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.id = 'fbm-style';
    style.textContent = 'html:not(.fbm-off) [data-fbm-hide]{display:none!important}';
    (document.head || document.documentElement).appendChild(style);
  }
  function toggleClean() { document.documentElement.classList.toggle('fbm-off'); }

  function sweep() {
    for (const post of document.querySelectorAll(POST + ':not([data-fbm-hide])')) {
      if (isJunk(post)) post.setAttribute('data-fbm-hide', '');
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; try { sweep(); } catch (e) { console.warn('[FBM]', e); } });
  }

  function start() {
    sweep();
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(sweep, 1000);
  }

  injectStyle();
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);

  window.addEventListener('keydown', (e) => {
    const h = CONFIG.toggleHotkey;
    if (e.metaKey || e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift) return;
    if ((e.key || '').toLowerCase() !== h.key.toLowerCase()) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName || ''))) return;
    e.preventDefault();
    toggleClean();
  }, true);
})();
