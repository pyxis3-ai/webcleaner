'use strict';

const api = globalThis.browser || globalThis.chrome;

const DEVICES = [
  ['pixel', 'Pixel 8 (412px)'],
  ['iphone', 'iPhone (393px)'],
  ['ipad', 'iPad mini (768px)'],
  ['responsive', 'Responsive (390px)'],
];

const send = (m) => api.runtime.sendMessage(m);
const status = (t) => { document.getElementById('status').textContent = t; };

function render(state) {
  const wrap = document.getElementById('devices');
  wrap.replaceChildren();
  if (!state.hasDebugger) {
    // Firefox: no debugger/CDP extension API. Point at the built-in tool.
    const note = document.createElement('div');
    note.className = 'status';
    note.textContent = 'Device mode needs Chrome/Edge. On Firefox, use the built-in Responsive Design Mode: Ctrl+Shift+M.';
    wrap.appendChild(note);
  } else {
    for (const [key, label] of DEVICES) {
      const b = document.createElement('button');
      b.textContent = label;
      if (state.device === key) b.classList.add('active');
      b.onclick = async () => {
        const r = await send({ cmd: 'device', key });
        if (r && r.error) status('Error: ' + r.error);
        else refresh();
      };
      wrap.appendChild(b);
    }
  }
  document.getElementById('uaonly').classList.toggle('active', !!state.uaOnly);
}

async function refresh() {
  const s = await send({ cmd: 'state' });
  render(s);
  status(s.device ? ('Device mode: ' + s.device + ' on this tab') : (s.uaOnly ? 'Mobile UA on (all tabs)' : 'Off'));
}

document.getElementById('uaonly').onclick = async () => {
  const s = await send({ cmd: 'state' });
  await send({ cmd: 'uaOnly', on: !s.uaOnly });
  setTimeout(refresh, 150);
};
document.getElementById('off').onclick = async () => {
  await send({ cmd: 'device', key: 'off' });
  const s = await send({ cmd: 'state' });
  if (s.uaOnly) await send({ cmd: 'uaOnly', on: false });
  setTimeout(refresh, 150);
};

refresh();
