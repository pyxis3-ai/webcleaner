import { expect, test } from "bun:test";
import { fixture, open } from "./harness.js";

const START = { adPlacementRenderer: { config: { adPlacementConfig: { kind: "AD_PLACEMENT_KIND_START" } }, renderer: { instreamVideoAdRenderer: {} } } };
const MID = { adPlacementRenderer: { config: { adPlacementConfig: { kind: "AD_PLACEMENT_KIND_MIDROLL" } }, renderer: {} } };
const PLAYER = { adPlacements: [START, MID], adSlots: [{}], playerAds: [{}], streamingData: {}, auxiliaryUi: { messageRenderers: { bkaEnforcementMessageViewModel: {} } } };
const json = {
  "/youtubei/v1/player": PLAYER,
  "/youtubei/v1/get_watch": [
    { responseContext: {}, playerResponse: PLAYER },
    { responseContext: {}, watchNextResponse: {} },
  ],
  "/youtubei/v1/reel/reel_watch_sequence": { entries: [{ command: { reelWatchEndpoint: { adClientParams: { isAd: true } } } }, { command: { reelWatchEndpoint: { videoId: "x" } } }] },
};
const yt = (extra = {}) => open({ url: "https://www.youtube.com/", html: fixture("yt.html"), json, ...extra });
const clean = (o) => ({
  slots: o.adSlots,
  ads: o.playerAds,
  placements: (o.adPlacements || []).map((p) => Object.keys(p.adPlacementRenderer.renderer).join()),
  bka: o.auxiliaryUi?.messageRenderers?.bkaEnforcementMessageViewModel,
});

test("stylesheet hides in-app ad surfaces and leaves YouTube's bait elements alone", async () => {
  const p = await yt();
  await p.tagged("#feedad[data-yt-h]");
  for (const sel of ["ytd-app #masthead-ad", "ytd-app #player-ads", "ytd-banner-promo-renderer", "#feedad"]) expect(await p.display(sel)).toBe("none");
  expect(await p.display("#feedok")).toBe("block");
  expect(await p.display(".bait")).toBe("block");
  expect(await p.display("#bait-inner")).toBe("block");
  await p.done();
});

test("enforcement dialog shell is removed while the message node stays rendered as display:block", async () => {
  const p = await yt();
  await p.waitForFunction(() => getComputedStyle(document.getElementById("dlg")).display === "none");
  expect(await p.has("#bd")).toBe(false);
  expect(
    await p.evaluate(() => {
      const cs = getComputedStyle(document.getElementById("enf"));
      return cs.display + "/" + cs.visibility;
    }),
  ).toBe("block/hidden");
  await p.done();
});

test("inline player response is scrubbed through the global accessor", async () => {
  const p = await yt();
  const r = await p.evaluate(() => ({ ...window.ytInitialPlayerResponse, errorScreen: window.ytInitialPlayerResponse.playabilityStatus.errorScreen, dataSlots: window.ytInitialData.adSlots }));
  expect(clean(r)).toEqual({ slots: undefined, ads: undefined, placements: ["clientForecastingAdRenderer"], bka: undefined });
  expect(r.errorScreen.enforcementMessageViewModel).toBeUndefined();
  expect(r.dataSlots).toBeUndefined();
  await p.done();
});

test("fetch: player, streamed get_watch (array) and Shorts sequence bodies are scrubbed", async () => {
  const p = await yt();
  const r = await p.evaluate(async () => {
    const get = (u) => fetch(u, { method: "POST", body: "{}" });
    const player = await (await get("/youtubei/v1/player?prettyPrint=false")).json();
    const res = await get("/youtubei/v1/get_watch?prettyPrint=false");
    const streamed = await new Promise((done) => {
      const rd = res.body.getReader(),
        parts = [];
      const pump = () => rd.read().then(({ value, done: d }) => (d ? done(new TextDecoder().decode(new Uint8Array(parts.flatMap((p) => [...p])))) : (parts.push(value), pump())));
      pump();
    });
    const reel = await (await get("/youtubei/v1/reel/reel_watch_sequence?prettyPrint=false")).json();
    return { player, watch: JSON.parse(streamed)[0].playerResponse, url: res.url, ok: res.ok, reelCount: reel.entries.length };
  });
  expect(clean(r.player)).toEqual({ slots: undefined, ads: undefined, placements: ["clientForecastingAdRenderer"], bka: undefined });
  expect(clean(r.watch)).toEqual({ slots: undefined, ads: undefined, placements: ["clientForecastingAdRenderer"], bka: undefined });
  expect(r.url).toBe("https://www.youtube.com/youtubei/v1/get_watch?prettyPrint=false");
  expect(r.ok).toBe(true);
  expect(r.reelCount).toBe(1);
  await p.done();
});

test("a fresh frame's fetch is the guarded one", async () => {
  const p = await yt();
  const r = await p.evaluate(async () => {
    document.body.innerHTML += '<iframe id="clean"></iframe>';
    return document
      .getElementById("clean")
      .contentWindow.fetch("/youtubei/v1/player?prettyPrint=false", { method: "POST", body: "{}" })
      .then((r) => r.json());
  });
  expect(clean(r)).toEqual({ slots: undefined, ads: undefined, placements: ["clientForecastingAdRenderer"], bka: undefined });
  await p.done();
});

test("XHR: player response text is scrubbed", async () => {
  const p = await yt();
  const r = await p.evaluate(
    () =>
      new Promise((res) => {
        const x = new XMLHttpRequest();
        x.open("POST", "/youtubei/v1/player?prettyPrint=false");
        x.onload = () => res([JSON.parse(x.responseText), JSON.parse(x.response)]);
        x.send("{}");
      }),
  );
  expect(clean(r[0])).toEqual({ slots: undefined, ads: undefined, placements: ["clientForecastingAdRenderer"], bka: undefined });
  expect(r[1].adSlots).toBeUndefined();
  await p.done();
});

test("synthetic and data: responses are never touched (JSON canary and spoofed-URL honeypot)", async () => {
  const p = await yt();
  const r = await p.evaluate(async () => {
    const body = JSON.stringify({ adPlacements: [1], adSlots: [1], playerAds: [1] });
    const canary = await new Response(body).json();
    const honey = await fetch(new Request("data:application/json," + encodeURIComponent(body))).then((r) => r.json());
    return [canary.adSlots, honey.adSlots, JSON.parse(body).adSlots];
  });
  expect(r).toEqual([[1], [1], [1]]);
  await p.done();
});

test("watch-page marker follows in-page navigation", async () => {
  const p = await yt();
  expect(await p.evaluate(() => document.documentElement.hasAttribute("data-yt-watch"))).toBe(false);
  await p.evaluate(() => history.pushState({}, "", "/watch?v=1"));
  await p.waitForFunction(() => document.documentElement.hasAttribute("data-yt-watch"));
  await p.evaluate(() => history.pushState({}, "", "/"));
  await p.waitForFunction(() => !document.documentElement.hasAttribute("data-yt-watch"));
  await p.done();
});

test("rotated markup is reported in the panel and rescued by rendered text", async () => {
  const p = await yt();
  const panel = await p.panel();
  expect(await panel.locator(".cu").first().textContent()).toContain("1 sponsored label still visible");
  await p.keyboard.press("Escape");
  await p.tagged("#rot[data-yt-h], #rot [data-yt-h]", 9000);
  expect(await p.display("#rot [data-yt-h]")).toBe("none");
  expect(await p.display("#feedok")).toBe("block");
  await p.done();
}, 15000);

test("module button switches the stylesheet off and persists", async () => {
  const p = await yt();
  await p.tagged("#feedad[data-yt-h]");
  await p.click("#yt-btn");
  expect(await p.display("#feedad")).toBe("block");
  expect((await p.get("wc7_youtube")).enabled).toBe(false);
  await p.done();
});
