/**
 * Deliberate and LIMITED runtime behavioral check of pre-reviewed MIT Axios
 * pure helper modules from a pinned commit; not a live HTTP request.
 * Never run against unreviewed custom repositories.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";

if (process.env.REA_TOOLKIT_PRESET !== "axios")
  throw new Error("Behavioral fixture only authorized for pinned Axios preset");
const root = resolve(process.env.REA_TOOLKIT_CHECKOUT || "");
if (!root || !existsSync(join(root, "lib", "helpers", "combineURLs.js")))
  throw new Error("Pinned Axios checkout required");
async function load(file) {
  return (await import(pathToFileURL(join(root, "lib", "helpers", file)).href))
    .default;
}
const [combine, isAbsolute, spread] = await Promise.all([
  load("combineURLs.js"),
  load("isAbsoluteURL.js"),
  load("spread.js"),
]);
test("combineURLs joins a base and relative path", () => {
  assert.equal(
    combine("https://example.test/api", "users"),
    "https://example.test/api/users",
  );
});
test("combineURLs normalizes repeated separator at boundary", () => {
  assert.equal(
    combine("https://example.test/api///", "///users"),
    "https://example.test/api/users",
  );
});
test("combineURLs returns base when relative URL empty", () => {
  assert.equal(
    combine("https://example.test/api", ""),
    "https://example.test/api",
  );
});
test("combineURLs uses slash for empty base", () => {
  assert.equal(combine("", "items"), "/items");
});
test("absolute https URL is recognized", () => {
  assert.equal(isAbsolute("https://example.test/path"), true);
});
test("protocol-relative URL is recognized", () => {
  assert.equal(isAbsolute("//example.test/path"), true);
});
test("relative URL does not count as absolute", () => {
  assert.equal(isAbsolute("users/1"), false);
});
test("non-string URL does not count as absolute", () => {
  assert.equal(isAbsolute(null), false);
});
test("spread passes every argument in the correct order", () => {
  const sum = spread((a, b, c) => a * 100 + b * 10 + c);
  assert.equal(sum([2, 4, 7]), 247);
});
test("spread preserves callback return value", () => {
  const joinArgs = spread((a, b) => a + "|" + b);
  assert.equal(joinArgs(["x", "y"]), "x|y");
});
test("wrong expected behavior is rejected by assertions (negative control)", () => {
  assert.throws(() => assert.equal(combine("x", "y"), "x-y"), {
    name: "AssertionError",
  });
});
test("behavior test is explicitly not network or HTTP adapter testing", () => {
  assert.equal(typeof combine, "function");
  assert.equal(typeof isAbsolute, "function");
  assert.equal(typeof spread, "function");
});
