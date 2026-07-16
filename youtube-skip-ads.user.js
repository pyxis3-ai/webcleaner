// ==UserScript==
// @name         YouTube Skip Ads
// @namespace    https://local/yt-skip-ads
// @version      1.5.0
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    skipVideoAds:       true,
    skipShortsAds:      true,
    hideFeedAds:        true,
    hideBanners:        true,
    muteAds:            true,
    dismissAntiAdblock: true,
    showToggleButton:   true,
    toggleHotkey:       { ctrl: false, alt: true, shift: true, key: 'y' },
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

  const VIDEO_AD_CLASSES = ['ad-showing', 'ad-interrupting'];
  const SHORT_AD_CLASSES = ['ad-showing', 'ad-interrupting', 'ad-created'];
  const hasAnyClass = (el, classes) => !!el && classes.some((c) => el.classList.contains(c));

  function injectStyle() {
    const rules = [];
    if (CONFIG.hideBanners) rules.push(...BANNER_HIDE);
    if (CONFIG.hideFeedAds) rules.push(...FEED_HIDE, '[data-yt-hide]');
    if (rules.length) {
      const style = document.createElement('style');
      style.id = 'yt-skip-ads';
      style.textContent = rules.join(',') + '{display:none!important}';
      (document.head || document.documentElement).appendChild(style);
      styleEl = style;
    }
    if (CONFIG.showToggleButton) {
      const ui = document.createElement('style');
      ui.id = 'yt-skip-ads-ui';
      ui.textContent = '#yt-toggle{position:fixed;z-index:2147483647;bottom:16px;right:16px;width:40px;height:40px;border-radius:50%;border:none;cursor:pointer;font-size:18px;line-height:40px;padding:0;background:#fff;color:#111;box-shadow:0 2px 10px rgba(0,0,0,.35);touch-action:none;transition:transform .1s}';
      (document.head || document.documentElement).appendChild(ui);
    }
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
    const b = document.getElementById('yt-toggle');
    if (b) b.style.opacity = enabled ? '1' : '0.4';
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function makeDraggable(btn, storeKey, onTap) {
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
      press = { sx: e.clientX, sy: e.clientY, moved: false };
    });
    btn.addEventListener('pointermove', (e) => {
      if (!press) return;
      if (!press.moved && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) > 6) press.moved = true;
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
      const p = press; press = null;
      try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
      if (p.moved) {
        try { localStorage.setItem(storeKey, JSON.stringify({ left: parseInt(btn.style.left, 10), top: parseInt(btn.style.top, 10) })); } catch (e2) {}
        return;
      }
      onTap();
    });
  }

  function addToggle() {
    if (!CONFIG.showToggleButton || !document.body || document.getElementById('yt-toggle')) return;
    const b = document.createElement('button');
    b.id = 'yt-toggle';
    b.textContent = '⏭';
    b.title = 'YouTube Skip Ads - tap: toggle · drag: move';
    makeDraggable(b, 'yt_pos', toggleEnabled);
    document.body.appendChild(b);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; tick(); });
  }

  function start() {
    tick();
    addToggle();
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
