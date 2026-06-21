// ==UserScript==
// @name         YouTube — Skip & Hide Ads
// @namespace    https://local/yt-skip-ads
// @version      1.4.1
// @description  Auto-skips YouTube video ads (clicks Skip, seeks past unskippable ones, mutes them), skips Sponsored Shorts, and hides feed/banner/overlay ads. Works on desktop and m.youtube.com. Greasemonkey / Tampermonkey / Violentmonkey. For network-level blocking, pair with uBlock Origin.
// @author       you
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-start
// @grant        none
// @noframes
// @downloadURL https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/youtube-skip-ads.user.js
// @updateURL   https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/youtube-skip-ads.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    skipVideoAds:       true,   // auto-skip pre/mid-roll video ads
    skipShortsAds:      true,   // auto-skip Sponsored Shorts
    hideFeedAds:        true,   // promoted videos / in-feed ad slots
    hideBanners:        true,   // masthead, overlay banners, companion / side ads
    muteAds:            true,   // mute while an ad is being skipped
    dismissAntiAdblock: true,   // remove YouTube's "ad blockers are not allowed" popup (mainly if you also run uBlock)
    toggleHotkey:       { ctrl: false, alt: true, shift: true, key: 'y' },  // Alt+Shift+Y turns this script on/off
  };

  let enabled = true;
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
  const FEED_WRAPPERS = 'ytd-rich-item-renderer, ytd-rich-section-renderer, ytd-item-section-renderer, ytm-rich-item-renderer, ytm-item-section-renderer';

  // YouTube flags an active ad by putting one of these classes on the player element.
  const VIDEO_AD_CLASSES = ['ad-showing', 'ad-interrupting'];
  const SHORT_AD_CLASSES = ['ad-showing', 'ad-interrupting', 'ad-created'];
  const hasAnyClass = (el, classes) => !!el && classes.some((c) => el.classList.contains(c));

  function injectStyle() {
    const rules = [];
    if (CONFIG.hideBanners) rules.push(...BANNER_HIDE);
    if (CONFIG.hideFeedAds) rules.push(...FEED_HIDE, '[data-yt-hide]');
    if (!rules.length) return;
    const style = document.createElement('style');
    style.id = 'yt-skip-ads';
    style.textContent = rules.join(',') + '{display:none!important}';
    (document.head || document.documentElement).appendChild(style);
    styleEl = style;
  }

  function hideFeedWrappers() {
    if (!CONFIG.hideFeedAds) return;
    for (const ad of document.querySelectorAll(FEED_HIDE.join(','))) {
      const wrap = ad.closest(FEED_WRAPPERS);
      if (wrap) wrap.setAttribute('data-yt-hide', '');
    }
  }

  let mutedByUs = false;
  function skipVideoAd() {
    if (!CONFIG.skipVideoAds) return;
    const player = document.querySelector('#movie_player, .html5-video-player');
    const video = document.querySelector('.html5-video-player video') || document.querySelector('video');
    const adShowing = hasAnyClass(player, VIDEO_AD_CLASSES);
    if (adShowing) {
      const skip = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, .ytp-ad-skip-button-container button');
      if (skip) skip.click();
      if (video) {
        if (CONFIG.muteAds && !video.muted) { video.muted = true; mutedByUs = true; }
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
    if (!CONFIG.skipShortsAds || !/^\/shorts/.test(location.pathname)) return;
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
    if (!CONFIG.dismissAntiAdblock) return;
    const enforce = document.querySelector('ytd-enforcement-message-view-model');
    if (!enforce) return;
    const dialog = enforce.closest('tp-yt-paper-dialog, ytd-popup-container');
    if (dialog) dialog.remove(); else enforce.remove();
    const backdrop = document.querySelector('tp-yt-iron-overlay-backdrop');
    if (backdrop) backdrop.remove();
    if (document.body) document.body.style.removeProperty('overflow');
    const video = document.querySelector('video');
    if (video && video.paused) video.play().catch(() => {});
  }

  function tick() {
    if (!enabled) return;
    try { dismissAntiAdblock(); skipVideoAd(); skipShortAd(); hideFeedWrappers(); } catch (e) { console.warn('[YT-skip]', e); }
  }
  function toggleEnabled() {
    enabled = !enabled;
    if (styleEl) styleEl.disabled = !enabled;
  }
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; tick(); });
  }

  function start() {
    tick();
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    setInterval(tick, 250);
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
    toggleEnabled();
  }, true);
})();
