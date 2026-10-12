import { expect, test } from "bun:test";
import { fixture, open } from "./harness.js";

const GEN = "https://generic.example/";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";
const probe = (p) =>
  p.evaluate(() => ({
    ua: navigator.userAgent,
    touch: navigator.maxTouchPoints,
    platform: navigator.platform,
    narrow: matchMedia("(max-width:600px)").matches,
    media: matchMedia("(max-width:600px)").media,
    wide: matchMedia("(min-width:1000px) and (orientation:landscape)").matches,
    coarse: matchMedia("(pointer:coarse)").matches,
    hover: matchMedia("(hover:hover)").matches,
    x: getComputedStyle(document.getElementById("x")).color,
    y: getComputedStyle(document.getElementById("y")).color,
    frame: document.documentElement.classList.contains("vm-f"),
    width: document.documentElement.getBoundingClientRect().width,
    vp: document.querySelector('meta[name="viewport"][data-wc]')?.getAttribute("content") || null,
  }));

test("auto mode changes nothing", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html") });
  await p.waitForTimeout(800);
  expect(await probe(p)).toMatchObject({ touch: 0, narrow: false, wide: true, coarse: false, x: "rgb(255, 0, 0)", y: "rgb(0, 0, 0)", frame: false, vp: null });
  await p.done();
});

test("mobile mode on a desktop browser spoofs signals, answers media queries and reflows the site's CSS", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html"), local: { wc7_vm: "mobile" } });
  await p.waitForTimeout(1500);
  const r = await probe(p);
  expect(r.ua).toContain("Android");
  expect(r).toMatchObject({
    touch: 5,
    platform: "Linux armv8l",
    narrow: true,
    media: "(max-width:600px)",
    wide: false,
    coarse: true,
    hover: false,
    x: "rgb(0, 0, 0)",
    y: "rgb(0, 0, 255)",
    frame: false,
    width: 1280,
    vp: null,
  });
  await p.done();
});

test("Frame clamps the page to the phone width", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html"), local: { wc7_vm: "mobile" }, store: { wc7_viewMode: { frameOnDesktop: true } } });
  await p.waitForTimeout(800);
  expect(await probe(p)).toMatchObject({ frame: true, width: 412 });
  await p.done();
});

test("desktop mode on a phone sets a desktop viewport and UA", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html"), local: { wc7_vm: "desktop" }, ua: ANDROID, viewport: { width: 412, height: 915 } });
  await p.waitForTimeout(800);
  const r = await probe(p);
  expect(r.vp).toBe("width=1280");
  expect(r.ua).toContain("Windows");
  expect(r.touch).toBe(0);
  await p.done();
});

test("new-site default, hotkey and menu switch modes and persist per site", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html"), store: { wc7_viewMode: { newSiteDefault: "mobile" } } });
  await p.waitForTimeout(500);
  expect((await probe(p)).touch).toBe(5);
  const state = () => p.evaluate(() => [localStorage.getItem("wc7_vm"), navigator.userAgent.includes("Windows"), navigator.maxTouchPoints]);
  await p.keyboard.press("Alt+Shift+V");
  await p.settled();
  expect(await state()).toEqual(["desktop", true, 0]);
  await p.menu("↺ Auto");
  await p.settled();
  expect(await state()).toEqual(["auto", false, 0]);
  await p.menu("📱 Mobile");
  await p.settled();
  expect(await state()).toEqual(["mobile", false, 5]);
  await p.done();
});

test("hotkeys are ignored while typing", async () => {
  const p = await open({ url: GEN, html: fixture("generic.html") });
  await p.focus("#in");
  await p.keyboard.press("Alt+Shift+V");
  await p.waitForTimeout(500);
  expect(await p.evaluate(() => localStorage.getItem("wc7_vm"))).toBeNull();
  await p.done();
});
