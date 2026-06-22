'use strict';

// Inline on-page button (no popup). Injected on every top-level page. Tap to toggle
// Mobile Mode; the background does the work (device reflow on Chrome, UA on Firefox).

const api = globalThis.browser || globalThis.chrome;

if (window.top === window && document.body) {
  let state = { active: false, hasDebugger: false };

  const btn = document.createElement('button');
  btn.id = 'mm-inline-btn';
  Object.assign(btn.style, {
    position: 'fixed', zIndex: 2147483647, left: '10px', bottom: '10px',
    width: '40px', height: '40px', borderRadius: '50%', border: 'none', cursor: 'pointer',
    fontSize: '18px', lineHeight: '40px', padding: '0', color: '#fff',
    background: 'rgba(37,99,235,.9)', boxShadow: '0 2px 8px rgba(0,0,0,.4)',
    opacity: '.85', touchAction: 'none', transition: 'transform .1s',
  });

  function paint() {
    btn.textContent = state.active ? '🖥' : '📱';
    btn.title = 'Mobile Mode: ' + (state.active ? 'ON - tap for desktop' : 'OFF - tap for mobile')
      + (state.hasDebugger ? '' : '  (Firefox: UA only; true reflow = Ctrl+Shift+M)');
  }

  // draggable; a real drag suppresses the click
  let press = null;
  btn.addEventListener('pointerdown', (e) => {
    try { btn.setPointerCapture(e.pointerId); } catch (_) {}
    press = { x: e.clientX, y: e.clientY, moved: false };
    btn.style.transform = 'scale(.9)';
  });
  btn.addEventListener('pointermove', (e) => {
    if (!press) return;
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) press.moved = true;
    if (press.moved) {
      btn.style.left = Math.max(0, Math.min(window.innerWidth - 40, e.clientX - 20)) + 'px';
      btn.style.top = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - 20)) + 'px';
      btn.style.bottom = 'auto';
    }
  });
  btn.addEventListener('pointerup', async (e) => {
    btn.style.transform = '';
    const wasDrag = press && press.moved; press = null;
    try { btn.releasePointerCapture(e.pointerId); } catch (_) {}
    if (wasDrag) return;
    const r = await api.runtime.sendMessage({ cmd: 'toggle' }).catch((err) => ({ error: String(err) }));
    if (r && r.error) { alert('Mobile Mode: ' + r.error); return; }
    if (r && 'active' in r) { state.active = r.active; paint(); }
    // Chrome reloads via the debugger and Firefox reloads the tab, so the button
    // re-injects with fresh state on its own; this paint is just immediate feedback.
  });

  document.body.appendChild(btn);
  paint();
  api.runtime.sendMessage({ cmd: 'state' }).then((s) => { if (s) { state = s; paint(); } }).catch(() => {});
}
