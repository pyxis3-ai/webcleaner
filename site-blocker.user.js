// ==UserScript==
// @name         Site Blocker
// @namespace    https://local/site-blocker
// @version      1.4.0
// @match        *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    blockAdultDefault: true,
    blockFocusDefault: false,
    snoozeMinutes:     5,
    toggleHotkey:      { ctrl: false, alt: true, shift: true, key: 'b' },

    schedule: { enabled: true, days: [1, 2, 3, 4, 5], from: '09:00', to: '18:00' },

    focus: [
      'facebook.com', 'youtube.com', 'instagram.com', 'tiktok.com', 'x.com', 'twitter.com', 'reddit.com',
      'snapchat.com', 'threads.net', 'pinterest.com', 'tumblr.com', 'linkedin.com',
      'twitch.tv', 'netflix.com', 'hulu.com', 'dailymotion.com',
      'news.ycombinator.com', 'cnn.com', 'bbc.com', 'dailymail.co.uk', 'foxnews.com', 'buzzfeed.com',
      '9gag.com', 'imgur.com', 'boredpanda.com',
      'amazon.com', 'ebay.com', 'aliexpress.com', 'temu.com', 'shein.com',
    ],
    adult: ['pornhub.com', 'xvideos.com', 'xnxx.com', 'xhamster.com', 'redtube.com', 'youporn.com',
            'spankbang.com', 'onlyfans.com', 'chaturbate.com', 'stripchat.com'],
  };

  const ADULT_RE = /(porn|xvideos|xhamster|hentai|camsoda|chaturbate|brazzers|onlyfans|nsfw|sexcam|sextube|camgirl)/i;

  const GM_OK = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  const gGet = (k, d) => (GM_OK ? GM_getValue(k, d) : d);
  const gSet = (k, v) => { if (GM_OK) GM_setValue(k, v); };

  let blockingOn  = gGet('sb_on', true);
  let blockAdult  = gGet('sb_adult', CONFIG.blockAdultDefault);
  let blockFocus  = gGet('sb_focus', CONFIG.blockFocusDefault);
  let scheduleOn  = gGet('sb_sched', CONFIG.schedule.enabled);
  const asList = (v) => (Array.isArray(v) ? v : []);
  const dedupe = (arr) => [...new Set(arr)];
  let custom = dedupe(asList(gGet('sb_custom', [])));
  let allow  = dedupe(asList(gGet('sb_allow', [])));
  const setCustom = (arr) => { custom = dedupe(arr); gSet('sb_custom', custom); };
  const setAllow  = (arr) => { allow  = dedupe(arr); gSet('sb_allow', allow); };
  const toggleAll = () => { gSet('sb_on', !blockingOn); location.reload(); };

  const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  function inSchedule() {
    const s = CONFIG.schedule;
    if (!scheduleOn || !s.days.includes(new Date().getDay())) return false;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const from = toMin(s.from), to = toMin(s.to);
    return from <= to ? (cur >= from && cur < to) : (cur >= from || cur < to);
  }

  const host = location.hostname.replace(/^www\./, '');
  const inList = (list) => list.some((d) => host === d || host.endsWith('.' + d));
  const snoozed = () => {
    try { return Date.now() < parseInt(localStorage.getItem('sb_snooze') || '0', 10); } catch (e) { return false; }
  };

  function blockReason() {
    if (!blockingOn || snoozed()) return null;
    if (inList(allow)) return null;
    if (inList(custom)) return 'on your block list';
    if (blockAdult && (inList(CONFIG.adult) || ADULT_RE.test(host))) return 'blocked by the adult filter';
    if ((blockFocus || inSchedule()) && inList(CONFIG.focus))
      return blockFocus ? 'blocked by the focus filter' : 'blocked during focus hours';
    return null;
  }

  function showBlock(why) {
    try { window.stop(); } catch (e) {}
    document.documentElement.innerHTML =
      '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blocked</title></head><body></body>';
    const b = document.body;
    Object.assign(b.style, {
      margin: '0', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: '14px', textAlign: 'center', padding: '24px',
      fontFamily: 'system-ui,-apple-system,sans-serif', background: '#0b0b0c', color: '#e9e9ea',
    });
    b.innerHTML =
      '<div style="font-size:56px">⛔</div>' +
      '<div style="font-size:22px;font-weight:600">Blocked</div>' +
      '<div style="opacity:.65;max-width:30rem">' + host + ' - ' + why + '.</div>' +
      '<button id="sb-allow" style="margin-top:6px;padding:10px 18px;border:0;border-radius:10px;cursor:pointer;font-size:14px;background:#2b2b30;color:#e9e9ea">Allow for ' + CONFIG.snoozeMinutes + ' minutes</button>' +
      '<button id="sb-manage" style="padding:8px 16px;border:0;border-radius:10px;cursor:pointer;font-size:13px;background:#1c1c20;color:#9a9aa0">⚙ Manage blocked sites</button>';
    const btn = document.getElementById('sb-allow');
    if (btn) btn.addEventListener('click', () => {
      try { localStorage.setItem('sb_snooze', String(Date.now() + CONFIG.snoozeMinutes * 60000)); } catch (e) {}
      location.reload();
    });
    const mng = document.getElementById('sb-manage');
    if (mng) mng.addEventListener('click', openPanel);
  }

  function check() {
    const why = blockReason();
    if (why && !document.getElementById('sb-allow')) showBlock(why);
  }
  check();
  setInterval(check, 30000);

  // ---------- Management panel ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cleanHost = (s) => String(s).trim().toLowerCase()
    .replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  let _panelHost = null;

  // Apply a state change, then reload ONLY if it flips whether THIS page is blocked —
  // so editing other sites updates the list live without navigating you away.
  function applyChange(fn) {
    const before = !!blockReason();
    fn();
    const after = !!blockReason();
    if (before !== after) { location.reload(); return; }
    refreshPanel();
  }
  function refreshPanel() { if (_panelHost && _panelHost.shadowRoot) renderPanel(_panelHost.shadowRoot); }

  function sw(key, on) {
    return '<label class="sw"><input type="checkbox" data-toggle="' + key + '"' + (on ? ' checked' : '') + '><span class="track"></span></label>';
  }
  function listHtml(arr, kind) {
    if (!arr.length) return '<div class="empty">None yet.</div>';
    return arr.map((d) => '<div class="item"><span title="' + esc(d) + '">' + esc(d) + '</span>'
      + '<button class="del" data-kind="' + kind + '" data-host="' + esc(d) + '">Remove</button></div>').join('');
  }
  function packHtml(sites) {
    return sites.map((d) => {
      const on = allow.includes(d);
      return '<div class="item"><span>' + esc(d) + '</span><button class="pill ' + (on ? 'allowed' : 'blocked')
        + '" data-pack="' + esc(d) + '">' + (on ? 'Allowed' : 'Blocked') + '</button></div>';
    }).join('');
  }
  function panelStyle() {
    return '' +
      ':host{all:initial}' +
      '*{box-sizing:border-box;font-family:system-ui,-apple-system,sans-serif}' +
      '.backdrop{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2147483646}' +
      '.card{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 28px));max-height:min(82vh,760px);overflow:auto;background:#17181b;color:#e9e9ea;border-radius:14px;padding:18px;box-shadow:0 12px 48px rgba(0,0,0,.6);z-index:2147483647;font-size:14px;line-height:1.4}' +
      '.hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}' +
      '.hd h1{font-size:16px;font-weight:700;margin:0}' +
      '.x{background:none;border:0;color:#9a9aa0;font-size:24px;cursor:pointer;line-height:1;padding:0 4px}' +
      '.row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 0;border-top:1px solid #26272c}' +
      '.cur{font-size:12px;color:#8a8a90;margin-top:2px}' +
      '.sec{margin-top:16px}' +
      '.sec>h2{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8a8a90;margin:0 0 2px}' +
      '.item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 0;border-top:1px solid #26272c}' +
      '.item span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.del{background:#2b2b30;border:0;color:#ff8a8a;border-radius:8px;cursor:pointer;padding:4px 10px;font-size:13px;flex:0 0 auto}' +
      '.add{display:flex;gap:8px;margin-top:8px}' +
      '.add input{flex:1;min-width:0;background:#0e0f11;border:1px solid #303138;color:#e9e9ea;border-radius:8px;padding:8px 10px;font-size:13px}' +
      '.add button{background:#3a7afe;border:0;color:#fff;border-radius:8px;cursor:pointer;padding:8px 14px;font-size:13px;flex:0 0 auto}' +
      '.empty{color:#6a6a70;font-style:italic;padding:7px 0;border-top:1px solid #26272c}' +
      '.sw{position:relative;display:inline-block;width:44px;height:26px;flex:0 0 auto}' +
      '.sw input{opacity:0;width:0;height:0;position:absolute}' +
      '.track{position:absolute;inset:0;background:#3a3b42;border-radius:999px;transition:.15s;cursor:pointer}' +
      '.track::before{content:"";position:absolute;width:20px;height:20px;left:3px;top:3px;background:#fff;border-radius:50%;transition:.15s}' +
      '.sw input:checked+.track{background:#2ecc71}' +
      '.sw input:checked+.track::before{transform:translateX(18px)}' +
      'details{margin-top:6px}' +
      'summary{cursor:pointer;padding:9px 0;color:#c9c9cf;border-top:1px solid #26272c;list-style:none;user-select:none}' +
      'summary::-webkit-details-marker{display:none}' +
      '.pill{border:0;border-radius:8px;cursor:pointer;padding:4px 12px;font-size:12px;flex:0 0 auto}' +
      '.pill.blocked{background:#3a2b2b;color:#ff9a9a}' +
      '.pill.allowed{background:#243024;color:#9be79b}';
  }

  function renderPanel(shadow) {
    const prevOpen = {};
    shadow.querySelectorAll('details[data-sec]').forEach((d) => { prevOpen[d.getAttribute('data-sec')] = d.open; });
    const snz = snoozed();
    shadow.innerHTML = '<style>' + panelStyle() + '</style>' +
      '<div class="backdrop" data-close></div>' +
      '<div class="card" role="dialog" aria-label="Site Blocker settings">' +
        '<div class="hd"><h1>⛔ Site Blocker</h1><button class="x" data-close aria-label="Close">×</button></div>' +
        '<div class="row"><div>Blocking<div class="cur">This page: ' + esc(host) + '</div></div>' + sw('on', blockingOn) + '</div>' +
        '<div class="row">Adult filter' + sw('adult', blockAdult) + '</div>' +
        '<div class="row">Focus mode now' + sw('focus', blockFocus) + '</div>' +
        '<div class="row">Work-hours schedule (' + CONFIG.schedule.from + '–' + CONFIG.schedule.to + ')' + sw('sched', scheduleOn) + '</div>' +
        (snz ? '<div class="cur">⏱ Snoozed — blocking is paused on this tab.</div>' : '') +
        '<div class="sec"><h2>My blocked sites</h2>' + listHtml(custom, 'custom') +
          '<div class="add"><input type="text" data-add="custom" placeholder="add a site, e.g. example.com"><button data-addbtn="custom">Add</button></div></div>' +
        '<div class="sec"><h2>Allowed (never blocked)</h2>' + listHtml(allow, 'allow') +
          '<div class="add"><input type="text" data-add="allow" placeholder="add a site to always allow"><button data-addbtn="allow">Add</button></div></div>' +
        '<div class="sec"><h2>Built-in packs</h2>' +
          '<details data-sec="focus"' + (prevOpen.focus ? ' open' : '') + '><summary>Focus Pack (' + CONFIG.focus.length + ') — blocked in focus mode / work hours</summary>' + packHtml(CONFIG.focus) + '</details>' +
          '<details data-sec="adult"' + (prevOpen.adult ? ' open' : '') + '><summary>Adult Pack (' + CONFIG.adult.length + ') — blocked by the adult filter</summary>' + packHtml(CONFIG.adult) + '</details>' +
        '</div>' +
      '</div>';
    wirePanel(shadow);
  }

  function wirePanel(shadow) {
    shadow.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closePanel));
    shadow.querySelectorAll('[data-toggle]').forEach((el) => el.addEventListener('change', () => {
      const k = el.getAttribute('data-toggle');
      applyChange(() => {
        if (k === 'on')    { blockingOn = !blockingOn; gSet('sb_on', blockingOn); }
        if (k === 'adult') { blockAdult = !blockAdult; gSet('sb_adult', blockAdult); }
        if (k === 'focus') { blockFocus = !blockFocus; gSet('sb_focus', blockFocus); }
        if (k === 'sched') { scheduleOn = !scheduleOn; gSet('sb_sched', scheduleOn); }
      });
    }));
    shadow.querySelectorAll('.del').forEach((el) => el.addEventListener('click', () => {
      const kind = el.getAttribute('data-kind'), h = el.getAttribute('data-host');
      applyChange(() => (kind === 'custom' ? setCustom(custom.filter((d) => d !== h)) : setAllow(allow.filter((d) => d !== h))));
    }));
    shadow.querySelectorAll('[data-addbtn]').forEach((btn) => {
      const kind = btn.getAttribute('data-addbtn');
      const input = shadow.querySelector('[data-add="' + kind + '"]');
      const submit = () => {
        const h = cleanHost(input.value);
        if (!h) return;
        applyChange(() => {
          if (kind === 'custom') { setCustom(custom.concat(h)); setAllow(allow.filter((d) => d !== h)); }
          else { setAllow(allow.concat(h)); setCustom(custom.filter((d) => d !== h)); }
        });
      };
      btn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    });
    shadow.querySelectorAll('[data-pack]').forEach((btn) => btn.addEventListener('click', () => {
      const h = btn.getAttribute('data-pack');
      applyChange(() => (allow.includes(h) ? setAllow(allow.filter((d) => d !== h)) : setAllow(allow.concat(h))));
    }));
  }

  function onPanelKey(e) { if (e.key === 'Escape') { e.preventDefault(); closePanel(); } }
  function closePanel() {
    if (_panelHost) { _panelHost.remove(); _panelHost = null; }
    document.removeEventListener('keydown', onPanelKey, true);
  }
  function openPanel() {
    if (_panelHost) { closePanel(); return; }
    if (!document.body) return;
    _panelHost = document.createElement('div');
    _panelHost.id = 'sb-panel-root';
    _panelHost.setAttribute('style', 'all:initial');
    const shadow = _panelHost.attachShadow({ mode: 'open' });
    document.body.appendChild(_panelHost);
    renderPanel(shadow);
    document.addEventListener('keydown', onPanelKey, true);
  }

  window.addEventListener('keydown', (e) => {
    const h = CONFIG.toggleHotkey;
    if (e.metaKey || e.ctrlKey !== !!h.ctrl || e.altKey !== !!h.alt || e.shiftKey !== !!h.shift) return;
    if ((e.key || '').toLowerCase() !== h.key.toLowerCase()) return;
    const el = e.target;
    if (el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName || ''))) return;
    e.preventDefault();
    toggleAll();
  }, true);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('⚙ Manage sites & filters…', openPanel);
    GM_registerMenuCommand('➕ Block this site (' + host + ')', () => {
      applyChange(() => { setCustom(custom.concat(host)); setAllow(allow.filter((d) => d !== host)); });
    });
    GM_registerMenuCommand('➖ Allow this site (' + host + ')', () => {
      applyChange(() => { setAllow(allow.concat(host)); setCustom(custom.filter((d) => d !== host)); });
    });
    GM_registerMenuCommand((blockingOn ? '⛔ Blocking: ON' : '✅ Blocking: OFF') + ' - tap to toggle', toggleAll);
  }
})();
