import { expect, test } from "bun:test";
import { fixture, open } from "./harness.js";

const FEED_URL = "https://www.facebook.com/?sk=h_chr";
const TALL = { viewport: { width: 1280, height: 2000 } };
const MOBILE = { viewport: { width: 412, height: 2000 }, ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36" };

test("desktop feed: labelled stories hidden, organic kept, chrome hidden, feed widened, links cleaned", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-desktop.html"), ...TALL });
  await p.waitForFunction(() => document.querySelectorAll("[data-fcf]").length >= 6);
  await p.waitForTimeout(1500);
  const hidden = await p.evaluate(() => [...document.querySelectorAll("[data-fcf]")].map((e) => e.id).sort());
  expect(hidden).toEqual(["s-adtoken", "s-follow", "s-obf", "s-reels", "s-sponsored", "s-svglabel"]);
  expect(await p.display("#s-tnlink")).toBe("block");
  expect(await p.display("#s-sponsored")).toBe("none");
  expect(await p.display("#s-organic")).toBe("block");
  expect(await p.display("#s-control")).toBe("block");
  expect(await p.display("#s-stories")).toBe("block");
  for (const sel of ['[role="banner"]', '[role="navigation"][aria-label="Shortcuts"]', '[role="complementary"]', '[role="region"]']) expect(await p.display(sel)).toBe("none");
  expect(await p.evaluate(() => document.querySelector(".feed").getBoundingClientRect().width)).toBe(1100);
  expect(await p.evaluate(() => document.getElementById("l-track").href)).toBe("https://example.com/page?id=5");
  expect(await p.evaluate(() => document.getElementById("l-shim").href)).toBe("https://example.org/a?q=1");
  await p.done();
});

test("desktop feed: rotated markup is reported and rescued by rendered text", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-desktop.html"), ...TALL });
  await p.waitForFunction(() => document.querySelectorAll("[data-fcf]").length >= 6);
  const panel = await p.panel();
  expect(await panel.locator(".cu").first().textContent()).toContain("1 sponsored label still visible");
  await p.keyboard.press("Escape");
  await p.tagged("#s-rot[data-fcf]", 4000);
  expect(await p.display("#s-organic")).toBe("block");
  await p.done();
});

test("desktop: forceMostRecent redirects once to the chronological feed", async () => {
  const p = await open({ url: "https://www.facebook.com/", html: fixture("fb-desktop.html"), ...TALL });
  await p.waitForURL("https://www.facebook.com/?sk=h_chr");
  await p.done();
});

test("desktop: Hide feed removes the column only, and only on the feed route", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-desktop.html"), ...TALL, store: { wc7_facebook: { hideFeed: true } } });
  await p.tagged(".feed[data-fcf-gone]");
  expect(await p.display(".feed")).toBe("none");
  expect(await p.has("[data-fcf]")).toBe(false);
  await p.done();
  const q = await open({ url: "https://www.facebook.com/groups/feed/", html: fixture("fb-desktop.html"), ...TALL, store: { wc7_facebook: { hideFeed: true } } });
  await q.waitForFunction(() => document.querySelectorAll("[data-fcf]").length >= 6);
  expect(await q.has(".feed[data-fcf-gone]")).toBe(false);
  await q.done();
});

test("desktop: module button and hotkey switch the stylesheet off and on, persisting the setting", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-desktop.html"), ...TALL });
  await p.tagged("#s-sponsored[data-fcf]");
  await p.click("#fcf-btn");
  expect(await p.display("#s-sponsored")).toBe("block");
  expect((await p.get("wc7_facebook")).enabled).toBe(false);
  await p.keyboard.press("Alt+Shift+F");
  expect(await p.display("#s-sponsored")).toBe("none");
  expect((await p.get("wc7_facebook")).enabled).toBe(true);
  await p.done();
});

test("tile grid: the tightest labelled tile is hidden, rows and hidden-text honeypots are not", async () => {
  const p = await open({ url: "https://www.facebook.com/marketplace/", html: fixture("fb-grid.html"), ...TALL });
  await p.tagged("#t2[data-fcf]");
  await p.waitForTimeout(1500);
  const hidden = await p.evaluate(() => [...document.querySelectorAll("[data-fcf]")].map((e) => e.id).sort());
  expect(hidden).toEqual(["t2", "t5"]);
  await p.done();
});

test("mobile feed: junk slots are removed, empty cards collapse, chrome and trays tagged, organic kept", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-mobile.html"), ...MOBILE });
  await p.waitForFunction(() => !document.getElementById("s-sponsored") && !document.getElementById("empty"));
  await p.waitForTimeout(1500);
  for (const id of ["s-sponsored", "s-adlabel", "s-follow", "s-addfriend", "empty"]) expect(await p.has("#" + id)).toBe(false);
  for (const id of ["s-organic", "s-control", "s-stories"]) expect(await p.display("#" + id)).toBe("block");
  for (const sel of ['[role="tablist"]', "#composer", "#tray"]) expect(await p.display(sel)).toBe("none");
  await p.done();
});

test("mobile feed: Hide feed tags every slot and removes nothing", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-mobile.html"), ...MOBILE, store: { wc7_facebook: { hideFeed: true } } });
  await p.tagged(".displayed[data-fcf-gone]");
  await p.waitForTimeout(1500);
  expect(await p.evaluate(() => document.querySelectorAll(".displayed").length)).toBe(8);
  expect(await p.evaluate(() => document.querySelectorAll(".displayed[data-fcf-gone]").length)).toBe(8);
  expect(await p.display(".displayed")).toBe("none");
  expect(await p.display('[role="tablist"]')).toBe("none");
  await p.done();
});

test("mobile feed: a disabled module removes nothing", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-mobile.html"), ...MOBILE, store: { wc7_facebook: { enabled: false } } });
  await p.waitForTimeout(2500);
  expect(await p.evaluate(() => document.querySelectorAll(".displayed").length)).toBe(8);
  expect(await p.display("#s-sponsored")).toBe("block");
  await p.done();
});

const edge = (category, extra = {}) => ({ category, cursor: "c", node: { __typename: "Story", id: category, ...extra } });
const RENAMED = {
  label: "CometNewsFeed_viewerConnection$stream",
  path: ["viewer", "news_feed", "edges", 7],
  data: { cursor: "z", node: { __typename: "Story", id: "renamed", th_dat_spo: { __typename: "SponsoredData", ad_id: "3" } } },
};
const FEED = {
  data: {
    viewer: {
      news_feed: {
        edges: [edge("ORGANIC"), edge("SPONSORED"), edge("ORGANIC", { sponsored_data: { __typename: "SponsoredData", ad_id: "1" } }), edge("ENGAGEMENT")],
        page_info: { has_next_page: true },
      },
      sideFeedUnit: { nodes: [{ id: "a" }, { id: "b", sponsored_data: { ad_id: "2" } }] },
    },
  },
};
const DEFERRED = { label: "x$defer$y", path: ["viewer", "news_feed", "edges", 5, "node"], data: { category: "SPONSORED", node: { id: "deferred" } } };
const GRAPHQL = [FEED, DEFERRED, { label: "z", data: { category: "ORGANIC", node: { id: "ok" } } }, RENAMED].map((o) => JSON.stringify(o)).join("\n");
const shape = (lines) =>
  lines.map((o) =>
    o.data?.viewer
      ? { edges: o.data.viewer.news_feed.edges.map((e) => e.category + ":" + (e.node ? e.node.id : "-")), side: o.data.viewer.sideFeedUnit.nodes.map((n) => n.id) }
      : o.data.category + ":" + (o.data.node ? o.data.node.id : "-"),
  );
const EXPECT = [{ edges: ["ORGANIC:ORGANIC", "SPONSORED:-", "ORGANIC:-", "ENGAGEMENT:ENGAGEMENT"], side: ["a"] }, "SPONSORED:-", "ORGANIC:ok", "undefined:-"];

test("GraphQL feed responses lose sponsored units on fetch, XHR and through a fresh frame's natives; JSON.parse is untouched", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-desktop.html"), ...TALL, raw: { "/api/graphql/": GRAPHQL } });
  const r = await p.evaluate(async (src) => {
    const parse = (t) => t.split("\n").map((l) => JSON.parse(l));
    const viaFetch = parse(await (await fetch("/api/graphql/", { method: "POST", body: "q" })).text());
    const viaXhr = parse(
      await new Promise((res) => {
        const x = new XMLHttpRequest();
        x.open("POST", "/api/graphql/");
        x.onload = () => res(x.responseText);
        x.send("q");
      }),
    );
    document.body.insertAdjacentHTML("beforeend", '<iframe id="clean" src="about:blank#g"></iframe>');
    const cw = document.getElementById("clean").contentDocument.defaultView;
    const viaFrameFetch = parse(await (await cw.fetch("/api/graphql/", { method: "POST", body: "q" })).text());
    const str = cw.Function.prototype.toString;
    const parsed = JSON.parse(src.split("\n")[0]);
    const feedEdges = parsed.data.viewer.news_feed.edges;
    return {
      viaFetch,
      viaXhr,
      viaFrameFetch,
      untouchedParse: feedEdges.length === 4 && !!feedEdges[1].node,
      masked: [str.call(JSON.parse), str.call(fetch), str.call(cw.XMLHttpRequest.prototype.open), Function.prototype.toString.call(Function.prototype.toString)],
    };
  }, GRAPHQL);
  for (const k of ["viaFetch", "viaXhr", "viaFrameFetch"]) expect(shape(r[k])).toEqual(EXPECT);
  expect(r.untouchedParse).toBe(true);
  expect(r.masked).toEqual(["function parse() { [native code] }", "function fetch() { [native code] }", "function open() { [native code] }", "function toString() { [native code] }"]);
  await p.done();
});

test("Block ad data off leaves GraphQL responses and natives alone", async () => {
  const p = await open({ url: FEED_URL, html: fixture("fb-desktop.html"), ...TALL, raw: { "/api/graphql/": GRAPHQL }, store: { wc7_facebook: { blockAdData: false } } });
  const r = await p.evaluate(async () => ({ text: await (await fetch("/api/graphql/", { method: "POST", body: "q" })).text(), str: Function.prototype.toString.call(fetch) }));
  expect(r.text).toBe(GRAPHQL);
  expect(r.str).toBe("function fetch() { [native code] }");
  await p.done();
});
