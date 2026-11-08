import test from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "./make-report.mjs";
const target = {
  preset: "public",
  repository: "public/example",
  commit: "b".repeat(40),
  scope: "src",
  behavior_demo: "none",
};
const ast = {
  status: "STATIC_IMPORTS_VERIFIED",
  modules: 2,
  statistics: {
    unique_internal_pairs: 1,
    external_edges: 0,
    boundary_edges: 0,
    unknown_dynamic_imports: 0,
    unresolved_edges: 0,
  },
  inventory: [{ file: "a.js" }, { file: "b.js" }],
};
const evidence = {
  operation: "analyze_javascript_application",
  evidence_id: "ev_test",
  normalized_result: {
    statistics: { parsed_javascript_files: 2, parse_failures: 0 },
    graph: { nodes: [], edges: [] },
    semantic_graph: { nodes: [], unknowns: [] },
  },
};
const audit = {
  status: "AST_SITE_COVERAGE_VERIFIED_WITH_UNCERTAIN_REA_EXTRAS",
  ast_import_sites: 1,
  rea_exact_ast_site_matches: 1,
  rea_import_records: 1,
  rea_additional_sites: 0,
  additional_without_explicit_specifier: 0,
  additional_same_module_specifier_other_line: 0,
};
const run = (over = {}) =>
  buildReport({ target, ast, evidence, audit, ...over });
void test("independent full structural source report can be approved", () => {
  const x = run();
  assert.equal(x.report.status, "COBERTURA_ESTRUTURAL_CONFIRMADA");
  assert.equal(x.report.checks.real_mcp_llm_agent_connected, false);
  assert.match(x.markdown, /relatório verificável/);
});
void test("AST dependency hubs count distinct importing modules without inventing behavior", () => {
  const graph = {
    ...ast,
    edges: [
      { kind: "internal", from: "a.js", target: "b.js" },
      { kind: "internal", from: "a.js", target: "b.js" },
      { kind: "internal", from: "c.js", target: "b.js" },
      { kind: "external", from: "a.js", specifier: "node:fs" },
    ],
  };
  const x = run({ ast: graph });
  assert.deepEqual(x.report.structural_hubs, [
    { module: "b.js", direct_dependents: 2 },
  ]);
  assert.match(x.markdown, /Mapa de dependências internas/);
});

void test("wrong REA parse count is inconclusive", () => {
  const p = {
    ...evidence,
    normalized_result: {
      ...evidence.normalized_result,
      statistics: { parsed_javascript_files: 1, parse_failures: 0 },
    },
  };
  assert.equal(run({ evidence: p }).report.status, "INCONCLUSIVO");
});
void test("REA and source disagreement cannot be approved", () => {
  const b = { ...audit, status: "INCONCLUSIVE_REA_AST_DISAGREEMENT" };
  assert.equal(run({ audit: b }).report.status, "INCONCLUSIVO");
});
void test("unknown dynamic imports force explicit qualification", () => {
  const changed = {
    ...ast,
    statistics: { ...ast.statistics, unknown_dynamic_imports: 1 },
  };
  const x = run({ ast: changed });
  assert.equal(x.report.status, "COBERTURA_ESTRUTURAL_COM_RESSALVAS");
  assert.ok(
    x.report.remaining_uncertainties.includes(
      "NONLITERAL_DYNAMIC_IMPORTS_NOT_RESOLVED",
    ),
  );
});
void test("null-specifier literal require remains technically inconclusive and disclosed", () => {
  const pending = {
    ...audit,
    status: "INCONCLUSIVE_REA_AST_DISAGREEMENT",
    ast_sites_absent_from_rea: 1,
    ast_sites_with_literal_require_but_null_rea_specifier: 1,
    ast_sites_without_even_literal_rea_candidate: 0,
    rea_additional_sites_unreconciled_with_ast: 0,
    rea_nonrequire_calls_tagged_as_imports: 3,
    rea_dynamic_require_candidates_without_literal_specifier: 1,
  };
  const x = run({ audit: pending });
  assert.equal(x.report.status, "INCONCLUSIVO");
  assert.equal(x.report.checks.literal_require_without_structured_specifier, 1);
  assert.equal(x.report.checks.no_literal_rea_candidate, 0);
  assert.equal(x.report.checks.method_calls_misclassified_as_imports, 3);
  assert.equal(x.report.checks.dynamic_require_without_literal_specifier, 1);
  assert.match(x.markdown, /Chamadas comuns de métodos/);
  assert.match(x.markdown, /sem specifier estruturado/);
  assert.ok(
    x.report.remaining_uncertainties.includes(
      "REA_LITERAL_REQUIRES_WITHOUT_NORMALIZED_SPECIFIER",
    ),
  );
});
void test("no runtime execution is claimed for arbitrary targets", () => {
  const x = run({ behaviorPass: true });
  assert.equal(x.report.checks.behavior_test_verified, false);
  assert.match(x.markdown, /não executado/);
});
void test("only pinned Axios can claim the restricted behavior demo", () => {
  const x = run({
    target: { ...target, preset: "axios", behavior_demo: "axios" },
    behaviorPass: true,
  });
  assert.equal(x.report.checks.behavior_test_verified, true);
  assert.match(x.markdown, /12 verificações Axios/);
});
void test("missing Evidence ID is explicit failure", () => {
  const x = run({ evidence: { ...evidence, evidence_id: null } });
  assert.equal(x.report.status, "INCONCLUSIVO");
  assert.ok(x.report.hard_failures.includes("REA_EVIDENCE_ID_MISSING"));
});
