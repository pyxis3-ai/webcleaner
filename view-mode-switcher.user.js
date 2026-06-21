// ==UserScript==
// @name         View Mode Switcher — Desktop / Mobile
// @namespace    https://local/view-mode-switcher
// @version      2.1.0
// @description  Force any site into Desktop or Mobile rendering — not just the viewport meta, but the device signals sites actually read: user-agent, touch, and matchMedia. On a desktop browser, "Mobile" serves the full-width mobile site (an optional centered phone-width frame is available in CONFIG). Remembers your choice per site. Draggable button, Alt+Shift+V, or the menu. Tampermonkey / Violentmonkey.
// @author       you
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// @downloadURL https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/view-mode-switcher.user.js
// @updateURL   https://raw.githubusercontent.com/pyxis3-ai/userscripts/main/view-mode-switcher.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    showButton:     true,                                              // floating button — tap=switch, long-press=Auto, drag=move
    hotkey:         { ctrl: false, alt: true, shift: true, key: 'v' }, // Alt+Shift+V toggles Desktop/Mobile
    desktopWidth:   1280,   // viewport width forced for Desktop view (the high-value case: "request desktop site" on a phone)
    mobileWidth:    390,    // emulated device width for Mobile view (also the frame width on a desktop browser)
    mobileHeight:   844,    // emulated device height (used for the spoofed screen/innerHeight)
    frameOnDesktop: false,  // desktop Mobile view fills the window (full-width mobile site); set true for a centered phone-width frame instead
    spoofUA:        true,   // override navigator.userAgent / platform / userAgentData
    spoofTouch:     true,   // override maxTouchPoints + ontouchstart so touch detection flips
    spoofMedia:     true,   // override window.matchMedia (+ innerWidth/screen in the frame) so JS-driven responsive layouts switch
    longPressMs:    500,    // hold the button this long to reset to Auto
    mobileUA:  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    desktopUA: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  };

  // ---- mode resolution (a per-site choice overrides the global default) ----
  const GM_OK = typeof GM_getValue === 'function';
  const gGet = (k, d) => (GM_OK ? GM_getValue(k, d) : d);
  const gSet = (k, v) => { if (GM_OK) GM_setValue(k, v); };
  const siteMode = (() => { try { return localStorage.getItem('vm_mode') || ''; } catch (e) { return ''; } })();
  const setSite = (m) => { try { localStorage.setItem('vm_mode', m); } catch (e) {} };
  const globalMode = gGet('vm_global', 'auto');
  const mode = siteMode || globalMode;   // 'auto' | 'desktop' | 'mobile'

  // Capture what the REAL browser is before we spoof anything. A desktop browser
  // cannot shrink its own OS window from a @grant-none script, so Mobile view there
  // is delivered as a centered phone-width frame instead of a real reflow.
  const realUA = navigator.userAgent;
  const uaData = navigator.userAgentData;
  const realMobile = /Mobi|Android|iPhone|iPod|Windows Phone/i.test(realUA) ||
                     /iPad/.test(realUA) ||
                     (/Macintosh/.test(realUA) && navigator.maxTouchPoints > 1) ||   // iPadOS reports its UA as "Macintosh"
                     (!!uaData && uaData.mobile === true);
  const toMobile = mode === 'mobile';
  const useFrame = toMobile && !realMobile && CONFIG.frameOnDesktop;

  // ---- device-signal spoofing — must run before the page's own scripts ----
  const def = (obj, prop, getter) => {
    try { Object.defineProperty(obj, prop, { configurable: true, get: getter }); return true; }
    catch (e) { return false; }
  };

  function installMatchMedia(emuWidth, coarse) {
    const native = window.matchMedia ? window.matchMedia.bind(window) : null;
    const decide = (qRaw) => {
      const q = String(qRaw).toLowerCase();
      let m;
      if ((m = q.match(/min-width:\s*(\d+(?:\.\d+)?)px/))) return emuWidth >= parseFloat(m[1]);
      if ((m = q.match(/max-width:\s*(\d+(?:\.\d+)?)px/))) return emuWidth <= parseFloat(m[1]);
      if (q.includes('pointer: coarse') || q.includes('any-pointer: coarse')) return coarse;
      if (q.includes('pointer: fine')   || q.includes('any-pointer: fine'))   return !coarse;
      if (q.includes('hover: none'))  return coarse;
      if (q.includes('hover: hover')) return !coarse;
      return null;   // not a query we emulate → delegate to the real engine
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

  function spoofSignals() {
    if (mode === 'auto') return;
    if (CONFIG.spoofUA) {
      const ua = toMobile ? CONFIG.mobileUA : CONFIG.desktopUA;
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
    if (CONFIG.spoofTouch) {
      def(navigator, 'maxTouchPoints', () => (toMobile ? 5 : 0));
      try { if (toMobile && !('ontouchstart' in window)) window.ontouchstart = null; } catch (e) {}
    }
    if (CONFIG.spoofMedia) {
      const emuW = toMobile ? CONFIG.mobileWidth : CONFIG.desktopWidth;
      installMatchMedia(emuW, toMobile);
      // Only override the reported size when we're emulating in a frame; lying about
      // innerWidth when it doesn't match the real paint breaks scroll/hit-test math.
      if (useFrame) {
        def(window, 'innerWidth',  () => CONFIG.mobileWidth);
        def(window, 'innerHeight', () => CONFIG.mobileHeight);
        def(screen,  'width',       () => CONFIG.mobileWidth);
        def(screen,  'height',      () => CONFIG.mobileHeight);
        def(screen,  'availWidth',  () => CONFIG.mobileWidth);
        def(screen,  'availHeight', () => CONFIG.mobileHeight);
        def(window,  'devicePixelRatio', () => 3);
      }
    }
  }

  // ---- viewport (the real lever on a mobile browser) ----------------------
  function applyViewport() {
    if (mode === 'auto') return;
    document.querySelectorAll('meta[name="viewport"]').forEach((el) => { if (!el.hasAttribute('data-vm')) el.remove(); });
    let meta = document.querySelector('meta[name="viewport"][data-vm]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'viewport');
      meta.setAttribute('data-vm', '1');
      (document.head || document.documentElement).appendChild(meta);
    }
    meta.setAttribute('content', mode === 'desktop'
      ? 'width=' + CONFIG.desktopWidth
      : 'width=device-width, initial-scale=1');
  }

  // ---- desktop phone-frame (a desktop browser can't shrink its own window) -
  function applyFrame() {
    if (!useFrame || document.getElementById('vm-frame-style')) return;
    const w = CONFIG.mobileWidth;
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

  // ---- apply everything ASAP, then re-assert as the page mutates ----------
  spoofSignals();
  applyViewport();
  if (mode !== 'auto') {
    const reassert = () => { applyViewport(); applyFrame(); };
    document.addEventListener('DOMContentLoaded', reassert);
    [200, 600, 1500, 3500].forEach((t) => setTimeout(reassert, t));
  }

  function toggleMode() {
    setSite(mode === 'desktop' ? 'mobile' : 'desktop');
    location.reload();
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function addButton() {
    if (!CONFIG.showButton || !document.body || document.getElementById('vm-btn')) return;
    const b = document.createElement('button');
    b.id = 'vm-btn';
    b.textContent = mode === 'desktop' ? '🖥' : mode === 'mobile' ? '📱' : '🔄';
    b.title = 'View: ' + mode + ' — tap: switch · long-press: Auto · drag: move';
    Object.assign(b.style, {
      position: 'fixed', zIndex: 2147483647, width: '40px', height: '40px', borderRadius: '50%',
      border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: '40px', padding: '0',
      background: 'rgba(0,0,0,.55)', color: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,.4)', opacity: '0.55',
      touchAction: 'none', transition: 'transform .1s',
    });
    const pos = gGet('vm_pos', null);
    if (pos && typeof pos.left === 'number') {
      b.style.left = clamp(pos.left, 0, window.innerWidth - 40) + 'px';
      b.style.top = clamp(pos.top, 0, window.innerHeight - 40) + 'px';
    } else {
      b.style.left = '10px';
      b.style.bottom = '10px';
    }
    b.addEventListener('mouseenter', () => { b.style.opacity = '1'; });
    b.addEventListener('mouseleave', () => { b.style.opacity = '0.55'; });

    let press = null;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch (_) {}
      b.style.transform = 'scale(0.9)';
      press = { sx: e.clientX, sy: e.clientY, moved: false, long: false };
      press.timer = setTimeout(() => {
        if (press && !press.moved) { press.long = true; setSite('auto'); location.reload(); }
      }, CONFIG.longPressMs);
    });
    b.addEventListener('pointermove', (e) => {
      if (!press) return;
      if (!press.moved && Math.hypot(e.clientX - press.sx, e.clientY - press.sy) > 6) {
        press.moved = true;
        clearTimeout(press.timer);
      }
      if (press.moved) {
        b.style.left = clamp(e.clientX - 20, 0, window.innerWidth - 40) + 'px';
        b.style.top = clamp(e.clientY - 20, 0, window.innerHeight - 40) + 'px';
        b.style.right = 'auto';
        b.style.bottom = 'auto';
      }
    });
    b.addEventListener('pointerup', (e) => {
      b.style.transform = '';
      if (!press) return;
      clearTimeout(press.timer);
      const p = press; press = null;
      try { b.releasePointerCapture(e.pointerId); } catch (_) {}
      if (p.long) return;
      if (p.moved) { gSet('vm_pos', { left: parseInt(b.style.left, 10), top: parseInt(b.style.top, 10) }); return; }
      toggleMode();
    });
    document.body.appendChild(b);
  }
  if (document.body) addButton();
  else document.addEventListener('DOMContentLoaded', addButton);

  window.addEventListener('keydown', (e) => {
    const h = CONFIG.hotkey;
    if (e.metaKey || e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift) return;
    if ((e.key || '').toLowerCase() !== h.key.toLowerCase()) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName || ''))) return;
    e.preventDefault();
    toggleMode();
  }, true);

  if (typeof GM_registerMenuCommand === 'function') {
    const dot = (m) => (siteMode === m ? '● ' : '○ ');
    GM_registerMenuCommand(dot('desktop') + '🖥 Desktop view (this site)', () => { setSite('desktop'); location.reload(); });
    GM_registerMenuCommand(dot('mobile') + '📱 Mobile view (this site)', () => { setSite('mobile'); location.reload(); });
    GM_registerMenuCommand(dot('auto') + '↺ Auto / site default (this site)', () => { setSite('auto'); location.reload(); });
    GM_registerMenuCommand('🌐 New-site default: ' + globalMode.toUpperCase() + ' (tap to change)', () => {
      const order = ['auto', 'desktop', 'mobile'];
      gSet('vm_global', order[(order.indexOf(globalMode) + 1) % order.length]);
      location.reload();
    });
  }
})();
