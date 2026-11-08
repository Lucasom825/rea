import test from "node:test";
import assert from "node:assert/strict";
import { resolveTarget } from "./resolve-target.mjs";

test("Axios preset is pinned and allows only pre-reviewed behavior demo", () => {
  const v = resolveTarget({
    preset: "axios",
    repository: "evil/forged",
    commit: "bad",
    scope: "../secret",
  });
  assert.equal(v.repository, "axios/axios");
  assert.equal(v.scope, "lib");
  assert.equal(v.source_execution_allowed, true);
});
test("TodoMVC preset is static only", () => {
  const v = resolveTarget({ preset: "todomvc" });
  assert.equal(v.source_execution_allowed, false);
  assert.equal(v.commit.length, 40);
});
test("Node-RED preset is pinned, static-only and accepts scoped npm directory", () => {
  const v = resolveTarget({
    preset: "nodered",
    repository: "attacker/override",
    scope: "bad",
  });
  assert.equal(v.repository, "node-red/node-red");
  assert.equal(v.commit, "c694a9b04ccfdeff2923bf8419082595f4e27071");
  assert.equal(v.scope, "packages/node_modules/@node-red/runtime/lib");
  assert.equal(v.source_execution_allowed, false);
});

test("public arbitrary repository requires a full SHA and safe path", () => {
  const sha = "a".repeat(40);
  const v = resolveTarget({
    preset: "public",
    repository: "some-open/repo.js",
    commit: sha,
    scope: "packages/node_modules/@scope/runtime/lib",
  });
  assert.equal(v.repository, "some-open/repo.js");
  assert.equal(v.scope, "packages/node_modules/@scope/runtime/lib");
  assert.equal(v.source_execution_allowed, false);
});
test("rejects ambiguous branch names as commit pins", () => {
  assert.throws(
    () =>
      resolveTarget({
        preset: "public",
        repository: "org/repo",
        commit: "main",
        scope: "src",
      }),
    /INVALID_INPUT/,
  );
});
test("rejects absolute path, traversal, symlinks markers and shell characters", () => {
  for (const p of [
    "/etc",
    "../src",
    "a/../src",
    "a//b",
    "a\\b",
    "a$(whoami)",
    "src;curl",
  ]) {
    assert.throws(
      () =>
        resolveTarget({
          preset: "public",
          repository: "org/repo",
          commit: "a".repeat(40),
          scope: p,
        }),
      /INVALID_INPUT/,
      p,
    );
  }
});
test("rejects URLs and invalid GitHub repository identifiers", () => {
  for (const r of [
    "https://github.com/org/repo",
    "org/../repo",
    "owner/repo.git",
    "-bad/repo",
    "org/repo;echo",
  ]) {
    assert.throws(
      () =>
        resolveTarget({
          preset: "public",
          repository: r,
          commit: "a".repeat(40),
          scope: "src",
        }),
      /INVALID_INPUT/,
      r,
    );
  }
});
test("rejects unsupported mode rather than defaulting to an unsafe target", () => {
  assert.throws(() => resolveTarget({ preset: "private" }), /INVALID_INPUT/);
});
test("safety budgets remain explicit", () => {
  const r = resolveTarget();
  assert.equal(r.private_repository_allowed, false);
  assert.equal(r.read_only, true);
  assert.ok(r.limits.max_js_files <= 300);
});
