/**
 * Cross-check REA's observed import relationships against independently parsed
 * TypeScript AST import sites. This verifies coverage, NOT overall REA accuracy.
 * REA can report multiple imported symbols at one declaration, plus candidates
 * without a literal specifier. Those remain explicit uncertainties.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const site = (file, line, specifier) =>
  JSON.stringify([file, line ?? null, specifier ?? null]);
// Narrow observation of an explicitly literal require() expression already
// present in REA Evidence. Do not execute the expression or infer dynamic imports.
// This is NOT equivalent to REA populating properties.specifier.
function literalRequire(expression) {
  if (typeof expression !== "string") return null;
  const match = /^require\(\s*(["'])([^"'\\\r\n]*)\1\s*\)$/u.exec(expression);
  return match ? match[2] : null;
}
export function auditReaImports(astGraph, reaEvidence) {
  const knownFiles = (astGraph.inventory ?? [])
    .map((x) => x.file)
    .sort((a, b) => b.length - a.length);
  const canonicalFile = (s) =>
    knownFiles.find((f) => s === f || s.endsWith("/" + f)) ?? s;
  const astSites = new Set(
    astGraph.edges.map((e) => site(e.from, e.line, e.specifier)),
  );
  const astFileSpecs = new Set(
    astGraph.edges.map((e) => site(e.from, null, e.specifier)),
  );
  const edges = (reaEvidence.normalized_result?.graph?.edges ?? []).filter(
    (e) => e.relation === "imports",
  );
  const reaSites = new Map();
  const reaLiteralCandidates = new Set();
  for (const edge of edges) {
    const location = edge.evidence?.location?.value ?? {};
    const filename = canonicalFile(String(location.source ?? ""));
    const line = location.start?.line ?? null;
    const specifier = edge.properties?.specifier ?? null;
    const key = site(filename, line, specifier);
    if (
      specifier === null &&
      edge.properties?.kind === "require" &&
      line !== null
    ) {
      const literal = literalRequire(edge.properties?.expression);
      if (literal !== null)
        reaLiteralCandidates.add(site(filename, line, literal));
    }
    if (!reaSites.has(key)) {
      reaSites.set(key, {
        file: filename,
        line,
        specifier,
        mode: edge.properties?.resolution_mode ?? null,
        status: edge.properties?.resolution_status ?? null,
        expression: edge.properties?.expression ?? null,
      });
    }
  }
  const astUncovered = [...astSites].filter((k) => !reaSites.has(k));
  const literalCandidates = astUncovered.filter((k) =>
    reaLiteralCandidates.has(k),
  );
  const noCandidate = astUncovered.filter((k) => !reaLiteralCandidates.has(k));
  const extras = [...reaSites]
    .filter(([k]) => !astSites.has(k))
    .map(([, v]) => v);
  const unreconciledExtras = extras.filter((x) => {
    if (x.specifier !== null || x.mode !== "require") return true;
    const literal = literalRequire(x.expression);
    return literal === null || !astSites.has(site(x.file, x.line, literal));
  });
  const ambiguous = extras.filter((x) => x.specifier === null);
  // Evidence can misclassify arbitrary calls as "require" imports; separate
  // non-require call text from truly dynamic/nonliteral require expressions.
  const nonRequireCallsTaggedImports = unreconciledExtras.filter(
    (x) =>
      x.specifier === null &&
      x.mode === "require" &&
      typeof x.expression === "string" &&
      !/^require\s*\(/u.test(x.expression),
  );
  const dynamicRequireCandidates = unreconciledExtras.filter(
    (x) =>
      x.specifier === null &&
      x.mode === "require" &&
      typeof x.expression === "string" &&
      /^require\s*\(/u.test(x.expression) &&
      literalRequire(x.expression) === null,
  );
  const alternateLine = extras.filter(
    (x) =>
      x.specifier !== null && astFileSpecs.has(site(x.file, null, x.specifier)),
  );
  const unknownSpecifier = extras.filter(
    (x) =>
      x.specifier !== null &&
      !astFileSpecs.has(site(x.file, null, x.specifier)),
  );
  return {
    status:
      astUncovered.length === 0 && unknownSpecifier.length === 0
        ? "AST_SITE_COVERAGE_VERIFIED_WITH_UNCERTAIN_REA_EXTRAS"
        : "INCONCLUSIVE_REA_AST_DISAGREEMENT",
    source_modules: astGraph.modules,
    ast_import_sites: astSites.size,
    rea_import_records: edges.length,
    rea_unique_import_sites: reaSites.size,
    rea_exact_ast_site_matches: astSites.size - astUncovered.length,
    ast_sites_absent_from_rea: astUncovered.length,
    // Keep the original strict field for compatibility, but distinguish
    // null specifier vs no REA source-site observation at all.
    ast_sites_with_literal_require_but_null_rea_specifier:
      literalCandidates.length,
    ast_sites_without_even_literal_rea_candidate: noCandidate.length,
    literal_require_without_specifier_examples: literalCandidates
      .slice(0, 25)
      .map((siteId) => {
        const [file, line, specifier] = JSON.parse(siteId);
        return { file, line, specifier };
      }),
    no_rea_candidate_examples: noCandidate.slice(0, 25).map((siteId) => {
      const [file, line, specifier] = JSON.parse(siteId);
      return { file, line, specifier };
    }),
    ast_missing_from_rea_examples: astUncovered.slice(0, 25).map((siteId) => {
      const [file, line, specifier] = JSON.parse(siteId);
      return { file, line, specifier };
    }),
    rea_additional_sites: extras.length,
    rea_additional_sites_unreconciled_with_ast: unreconciledExtras.length,
    rea_nonrequire_calls_tagged_as_imports: nonRequireCallsTaggedImports.length,
    rea_dynamic_require_candidates_without_literal_specifier:
      dynamicRequireCandidates.length,
    nonrequire_call_examples: nonRequireCallsTaggedImports
      .slice(0, 15)
      .map(({ file, line, expression }) => ({ file, line, expression })),
    dynamic_require_examples: dynamicRequireCandidates
      .slice(0, 15)
      .map(({ file, line, expression }) => ({ file, line, expression })),
    additional_without_explicit_specifier: ambiguous.length,
    additional_same_module_specifier_other_line: alternateLine.length,
    additional_unmatched_explicit_specifier: unknownSpecifier.length,
    unmatched_explicit_examples: unknownSpecifier.slice(0, 25),
    coverage_only: true,
    does_not_prove_runtime_behavior: true,
    does_not_measure_semantic_accuracy: true,
    limits: [
      "A literal require() expression in REA Evidence without properties.specifier is NOT an explicit REA specifier match",
      "Calls such as self.node.status() may be incorrectly emitted as REA import candidates",
      "Multiple REA records can describe symbols from one import declaration",
      "Some REA require/import candidates lack a literal specifier and are not validated",
      "Matching import syntax does not establish accurate runtime call or behavior analysis",
      "Matching a module/specifier at a different line is not independently verified as a separate import",
    ],
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) ===
    resolve(import.meta.url.replace(/^file:\/\//, ""))
) {
  const [astFile, reaFile, outFile] = process.argv.slice(2);
  if (!astFile || !reaFile || !outFile) {
    console.error(
      "Usage: node rea-import-audit.mjs ast.json rea.json output.json",
    );
    process.exitCode = 64;
  } else {
    const result = auditReaImports(
      JSON.parse(readFileSync(astFile, "utf8")),
      JSON.parse(readFileSync(reaFile, "utf8")),
    );
    writeFileSync(outFile, JSON.stringify(result, null, 2) + "\n");
    console.log("REA_IMPORT_AUDIT=" + JSON.stringify(result));
    if (result.status === "INCONCLUSIVE_REA_AST_DISAGREEMENT")
      process.exitCode = 2;
  }
}
