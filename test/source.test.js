import { expect, test } from "bun:test";
import { SRC } from "./harness.js";

test("header version and VERSION constant agree", () => {
  expect(SRC.match(/const VERSION = "([^"]+)"/)[1]).toBe(SRC.match(/\/\/ @version\s+(\S+)/)[1]);
});
test("page hooks can reach the page under sandboxing managers", () => {
  expect(SRC).toMatch(/\/\/ @grant\s+unsafeWindow/);
});
test("no console output or debugger statements", () => {
  expect(SRC).not.toMatch(/\bconsole\.|\bdebugger\b/);
});
test("no literal invisible characters, BOM or CRLF", () => {
  expect(SRC).not.toMatch(/[\u200b-\u200f\u202a-\u202e\ufeff\u00ad\u2060\u034f\r]/);
});
