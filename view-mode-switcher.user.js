// ==UserScript==
// @name         View Mode Switcher — Desktop / Mobile
// @namespace    https://local/view-mode-switcher
// @version      1.2.0
// @description  Toggle any site between Desktop view and Mobile view (forces the page viewport) via a floating button, a keyboard shortcut (Alt+Shift+V), or the menu. Remembers your choice per site, with a global default. Most effective in a mobile browser. Tampermonkey / Violentmonkey.
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
    showButton:   true,                                              // floating button — tap=switch, long-press=Auto, drag=move
    hotkey:       { ctrl: false, alt: true, shift: true, key: 'v' }, // Alt+Shift+V toggles Desktop/Mobile
    desktopWidth: 1280,                                              // width forced for Desktop view
    longPressMs:  500,                                               // hold the button this long to reset to Auto
  };

  const GM_OK = typeof GM_getValue === 'function';
  const gGet = (k, d) => (GM_OK ? GM_getValue(k, d) : d);
  const gSet = (k, v) => { if (GM_OK) GM_setValue(k, v); };
  const siteMode = (() => { try { return localStorage.getItem('vm_mode') || ''; } catch (e) { return ''; } })();
  const setSite = (m) => { try { localStorage.setItem('vm_mode', m); } catch (e) {} };
  const globalMode = gGet('vm_global', 'auto');
  const mode = siteMode || globalMode;

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
    meta.setAttribute('content', mode === 'desktop' ? 'width=' + CONFIG.desktopWidth : 'width=device-width, initial-scale=1');
  }

  applyViewport();
  if (mode !== 'auto') {
    document.addEventListener('DOMContentLoaded', applyViewport);
    [400, 1500, 3500].forEach((t) => setTimeout(applyViewport, t));
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
