/**
 * A no-LLM, inspectable report for GitHub Actions and its Summary panel.
 * Evidence/coverage is not conflated with verified runtime behavior.
 */
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
const tick = String.fromCharCode(96);
function get(p) {
  return JSON.parse(readFileSync(resolve(p), "utf8"));
}
function safe(s) {
  return String(s ?? "")
    .replace(/[\r\n|]/g, " ")
    .slice(0, 220);
}
function asInt(v) {
  return Number.isInteger(v) ? String(v) : "não informado";
}
export function buildReport({
  target,
  ast,
  evidence,
  audit,
  behaviorPass = false,
}) {
  const norm = evidence.normalized_result ?? {};
  const stats = norm.statistics ?? {},
    graph = norm.graph ?? {},
    semantic = norm.semantic_graph ?? {};
  const parsed = stats.parsed_javascript_files ?? null,
    parseFailures = stats.parse_failures ?? null;
  const moduleTotal = ast.modules ?? 0;
  const linked = new Set();
  const directDependents = new Map();
  for (const edge of ast.edges ?? []) {
    if (
      edge.kind !== "internal" ||
      typeof edge.from !== "string" ||
      typeof edge.target !== "string"
    )
      continue;
    const key = JSON.stringify([edge.from, edge.target]);
    if (linked.has(key)) continue;
    linked.add(key);
    directDependents.set(
      edge.target,
      (directDependents.get(edge.target) ?? 0) + 1,
    );
  }
  const structuralHubs = [...directDependents.entries()]
    .map(([module, direct_dependents]) => ({ module, direct_dependents }))
    .sort(
      (a, b) =>
        b.direct_dependents - a.direct_dependents ||
        a.module.localeCompare(b.module),
    )
    .slice(0, 8);
  const hard = [
    !evidence.evidence_id ? "REA_EVIDENCE_ID_MISSING" : null,
    evidence.operation !== "analyze_javascript_application"
      ? "REA_WRONG_OPERATION"
      : null,
    ast.status !== "STATIC_IMPORTS_VERIFIED"
      ? "SOURCE_STATIC_IMPORTS_INCONCLUSIVE"
      : null,
    parsed !== moduleTotal ? "REA_SOURCE_MODULE_COUNT_MISMATCH" : null,
    parseFailures !== 0 ? "REA_PARSE_FAILURES" : null,
    audit.status === "INCONCLUSIVE_REA_AST_DISAGREEMENT"
      ? "REA_IMPORT_SITE_DISAGREEMENT"
      : null,
  ].filter(Boolean);
  const partial = [
    ast.statistics?.boundary_edges > 0
      ? "IMPORTS_OUTSIDE_SELECTED_SCOPE"
      : null,
    ast.statistics?.unknown_dynamic_imports > 0
      ? "NONLITERAL_DYNAMIC_IMPORTS_NOT_RESOLVED"
      : null,
    audit.additional_without_explicit_specifier > 0
      ? "REA_IMPORT_CANDIDATES_WITHOUT_SPECIFIER"
      : null,
    audit.additional_same_module_specifier_other_line > 0
      ? "REA_EXTRA_SITES_WITH_OTHER_SOURCE_LINE"
      : null,
  ].filter(Boolean);
  const status = hard.length
    ? "INCONCLUSIVO"
    : partial.length
      ? "COBERTURA_ESTRUTURAL_COM_RESSALVAS"
      : "COBERTURA_ESTRUTURAL_CONFIRMADA";
  const trueRuntime = target.behavior_demo === "axios" && behaviorPass;
  const report = {
    toolkit: "NEXUS_REA_TOOLKIT_007",
    status,
    timestamp_utc: new Date().toISOString(),
    target: {
      repository: target.repository,
      commit: target.commit,
      scope: target.scope,
      preset: target.preset,
      public_only: true,
    },
    checks: {
      repo_hash_pinned: true,
      source_executed: trueRuntime,
      runtime_scope: trueRuntime
        ? "12 no-network tests of three reviewed Axios pure helpers"
        : "NO_TARGET_EXECUTION",
      rea_evidence_id: evidence.evidence_id ?? null,
      rea_operation: evidence.operation ?? null,
      rea_parsed_js: parsed,
      rea_parse_failures: parseFailures,
      ast_js_files: moduleTotal,
      ast_unique_internal_import_pairs:
        ast.statistics?.unique_internal_pairs ?? null,
      ast_external_import_records: ast.statistics?.external_edges ?? null,
      ast_unresolved_imports: ast.statistics?.unresolved_edges ?? null,
      ast_unknown_dynamic_imports:
        ast.statistics?.unknown_dynamic_imports ?? null,
      ast_source_files_sha256_verified: ast.inventory?.length ?? null,
      rea_import_records: audit.rea_import_records ?? null,
      ast_import_sites: audit.ast_import_sites ?? null,
      matched_import_sites: audit.rea_exact_ast_site_matches ?? null,
      ast_sites_absent_from_rea: audit.ast_sites_absent_from_rea ?? null,
      extra_rea_sites: audit.rea_additional_sites ?? null,
      extra_without_specifier:
        audit.additional_without_explicit_specifier ?? null,
      rea_graph_nodes: (graph.nodes ?? []).length,
      rea_graph_edges: (graph.edges ?? []).length,
      rea_semantic_nodes: (semantic.nodes ?? []).length,
      rea_semantic_unknowns: (semantic.unknowns ?? []).length,
      behavior_test_verified: trueRuntime,
      real_mcp_llm_agent_connected: false,
    },
    hard_failures: hard,
    remaining_uncertainties: partial,
    structural_hubs: structuralHubs,
    interpretation:
      "Static JavaScript module map only. No automatic claim of end-to-end app behavior or business-rule correctness.",
  };
  const lines = [
    "# REA Toolkit — relatório verificável",
    "",
    "**Resultado:** " + status.replaceAll("_", " "),
    "",
    "**Projeto:** " +
      safe(target.repository) +
      " (" +
      tick +
      safe(target.commit) +
      tick +
      ")",
    "",
    "**Diretório analisado:** " +
      tick +
      safe(target.scope) +
      tick +
      " — código público",
    "",
    "| Verificação | Resultado |",
    "| --- | ---: |",
    "| Arquivos JavaScript no escopo (AST) | " + asInt(moduleTotal) + " |",
    "| Arquivos analisados pela REA | " + asInt(parsed) + " |",
    "| Erros de interpretação sintática REA | " + asInt(parseFailures) + " |",
    "| Dependências internas distintas segundo AST | " +
      asInt(ast.statistics?.unique_internal_pairs) +
      " |",
    "| Importações de código identificadas pelo AST | " +
      asInt(audit.ast_import_sites) +
      " |",
    "| Importações AST reconciliadas com REA | " +
      asInt(audit.rea_exact_ast_site_matches) +
      " |",
    "| Importações AST não reconhecidas pela REA | " +
      asInt(audit.ast_sites_absent_from_rea) +
      " |",
    "| Candidatos adicionais REA sem validação de importação única | " +
      asInt(audit.rea_additional_sites) +
      " |",
    "| Incógnitas da REA no grafo semântico | " +
      asInt(report.checks.rea_semantic_unknowns) +
      " |",
    "| Teste comportamental do código-alvo | " +
      (trueRuntime ? "12 verificações Axios sem rede" : "não executado") +
      " |",
    "",
    "**Identificador Evidence da REA:** " +
      tick +
      safe(report.checks.rea_evidence_id) +
      tick,
    "",
    hard.length
      ? "**Falhas de verificação:** " + hard.map(safe).join(", ")
      : "**Falhas de verificação:** nenhuma nos controles aplicados.",
    "",
    partial.length
      ? "**Pontos que exigem atenção:** " + partial.map(safe).join(", ")
      : "**Pontos que exigem atenção:** sem alertas nas categorias conferidas.",
    "",
    "## O que é possível concluir",
    "",
    "- Os números refletem os arquivos e as importações identificados em leitura estática, sem interpretações inventadas por modelo de IA.",
    "- A comparação por localização confronta a REA com um parser independente. Importações repetidas não são contadas como dependências distintas.",
    "- " +
      (trueRuntime
        ? "No preset Axios, 12 verificações de três funções puras observaram resultados reais, sem requisições HTTP."
        : "O código do projeto não foi executado; sua operação real NÃO foi comprovada."),
    "- Não houve conexão de um agente LLM confiável ao MCP, alterações em produção ou acesso a dados privados.",
    "",
    "## Fontes e rastreabilidade",
    "",
    "- Repositório público imutável: https://github.com/" +
      target.repository +
      "/tree/" +
      target.commit +
      "/" +
      target.scope,
    "- A pasta de arquivos da execução contém os JSONs de Evidence da REA, grafo de origem, auditoria de importações e relatório.",
    "- A REA pode conter interpretações e classificações ainda incertas; não use o relatório como aprovação automática de engenharia.",
    "",
  ];
  const archIndex = lines.indexOf("## O que é possível concluir");
  if (archIndex < 0) throw new Error("Report section missing");
  lines.splice(
    archIndex,
    0,
    "## Mapa de dependências internas (AST)",
    "",
    "Os módulos abaixo são os mais importados diretamente por **outros módulos distintos** dentro do escopo. Isso não demonstra execução, confiabilidade ou importância funcional.",
    "",
    "| Arquivo | Outros módulos que o referenciam |",
    "| --- | ---: |",
    ...(structuralHubs.length
      ? structuralHubs.map(
          (hub) =>
            "| " +
            tick +
            safe(hub.module) +
            tick +
            " | " +
            hub.direct_dependents +
            " |",
        )
      : ["| Sem relações internas estáticas comprovadas | 0 |"]),
    "",
  );
  return { report, markdown: lines.join("\n") };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)
) {
  const [targetPath, astPath, evidencePath, auditPath, folder] =
    process.argv.slice(2);
  if (!targetPath || !astPath || !evidencePath || !auditPath || !folder)
    throw new Error("Expected 5 paths");
  const target = get(targetPath),
    ast = get(astPath),
    rea = get(evidencePath),
    audit = get(auditPath);
  const { report, markdown } = buildReport({
    target,
    ast,
    evidence: rea,
    audit,
    behaviorPass: process.env.REA_BEHAVIOR_PASS === "true",
  });
  report.original_rea_sha256 = createHash("sha256")
    .update(readFileSync(evidencePath))
    .digest("hex");
  writeFileSync(
    join(folder, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  writeFileSync(join(folder, "report.pt-BR.md"), markdown);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  console.log("REA_TOOLKIT_RESULT=" + report.status);
  console.log("REA_TOOLKIT_SOURCE_MODULES=" + report.checks.ast_js_files);
  console.log("REA_TOOLKIT_EVIDENCE_ID=" + report.checks.rea_evidence_id);
  console.log("REA_TOOLKIT_REPORT_PRODUCED=true");
  if (report.status === "INCONCLUSIVO")
    console.log(
      "::warning title=REA Toolkit inconclusivo::O relatorio foi entregue, mas a aprovacao tecnica e falsa. Consulte o Summary e o JSON.",
    );
  console.log(
    "REA_TOOLKIT_TECHNICAL_APPROVAL=" +
      String(report.hard_failures.length === 0),
  );
  // A completed job means the evidence report was produced, not that
  // a technical INCONCLUSIVO report was approved.
}
