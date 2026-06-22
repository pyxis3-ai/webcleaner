# Mobile Mode (browser extension)

Adds an **inline, on-page floating button** (no popup) to flip a site to mobile on your desktop browser - the thing the userscripts in this repo provably can't do (a userscript can't change a navigation's User-Agent or the viewport; an extension can).

Tap the floating **📱** button (bottom-left, draggable) to toggle; it becomes **🖥** when mobile is on.

## What it does, per browser

| | Chrome / Edge / Brave | Firefox |
|---|---|---|
| Toggle does | **true device reflow** - DevTools-style viewport emulation via the `debugger` API (`Emulation.setDeviceMetricsOverride`), reflows **any** site | **mobile User-Agent** - via `declarativeNetRequest`, so UA-sniffing sites (Facebook, YouTube) serve their mobile site |
| Reflow normal CSS sites? | yes | **no** - Firefox gives extensions no viewport API; use the built-in **Responsive Design Mode (`Ctrl+Shift+M`)**, which is itself an inline device bar that reflows anything |
| Banner while active | yes (Chrome's "debugging this browser") | no |

So on **Firefox**, the button is best for getting the *mobile site* of Facebook/YouTube; for true reflow of normal sites, `Ctrl+Shift+M` is the native, inline answer.

## Why a userscript can't do this

`m.facebook.com` on desktop returns a **301 to www before any page JS runs**, decided from the request's `User-Agent` / `Sec-CH-UA-Mobile` headers (traced to the wire). A userscript can't set those headers and never runs on the mobile host. And CSS `@media` is measured against the real window width, which a userscript can't change (CSS zoom, viewport meta, `matchMedia` spoofing, iframes were all tested and ruled out). Only the browser can change the UA and the viewport - which is what this extension (Chrome) or the built-in tools (Firefox `Ctrl+Shift+M`) do.

## Install (load unpacked)

**Chrome / Edge / Brave:** `chrome://extensions` -> **Developer mode** -> **Load unpacked** -> this folder. (Edited the files? Click the card's **reload** to pick up changes - browsers don't auto-reload unpacked extensions.) The 📱 button appears on pages; tap it.

**Firefox:** `about:debugging#/runtime/this-firefox` -> **Load Temporary Add-on** -> pick `manifest.json`. (Temporary add-ons clear on restart unless signed.) The 📱 button appears; tap it for the mobile UA, or use `Ctrl+Shift+M` for reflow.

## Notes / limits

- The button is injected on every page (like the userscripts' buttons); drag it anywhere.
- Chrome device mode is **per-tab**; the Firefox UA toggle is **global**. Tap again to turn off.
- If toggling errors on Chrome, **close DevTools on that tab** - only one debugger can attach per tab.
- Edited files don't take effect until you **reload** the unpacked extension.
- Pairs with the userscripts: in Mobile mode, mobile Facebook is cleaned by **facebook-mobile-clean-feed**, YouTube ads by **youtube-skip-ads**.
