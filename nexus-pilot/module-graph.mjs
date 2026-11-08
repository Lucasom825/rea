/**
 * NEXUS REA 006 - domain-neutral ES module dependency verifier.
 * Reads JS source. Does not execute, import, transpile or install target code.
 * Recognizes static import/export-from, literal dynamic import(), and literal require().
 * No claim about runtime call graphs, dynamic specifiers or package resolution.
 */
import { createRequire } from "node:module";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const walk = (dir, files = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, files);
    else if (entry.isFile() && entry.name.endsWith(".js")) files.push(path);
  }
  return files;
};
const rel = (root, file) => relative(root, file).split(sep).join("/");
const inside = (root, filename) => {
  const r = relative(root, filename);
  return (
    r === "" || (!r.startsWith(".." + sep) && r !== ".." && !isAbsolute(r))
  );
};
function resolveSpecifier(root, from, specifier) {
  if (!specifier.startsWith(".")) return { kind: "external", specifier };
  const abs = resolve(dirname(from), specifier);
  if (!inside(root, abs)) return { kind: "out_of_scope", specifier };
  const candidates = extname(abs)
    ? [abs]
    : [abs, abs + ".js", join(abs, "index.js")];
  for (const target of candidates) {
    if (!inside(root, target)) continue;
    if (existsSync(target) && statSync(target).isFile()) {
      if (target.endsWith(".js"))
        return { kind: "internal", target: rel(root, target) };
      return { kind: "asset", target: rel(root, target) };
    }
  }
  return { kind: "unresolved", specifier };
}
export function scanModuleGraph(rootInput, { maxFiles = 500 } = {}) {
  const root = resolve(rootInput);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return { status: "INCONCLUSIVE", reason: "SOURCE_DIRECTORY_MISSING" };
  }
  const paths = walk(root).sort();
  if (paths.length === 0 || paths.length > maxFiles) {
    return {
      status: "INCONCLUSIVE",
      reason: "SOURCE_FILE_COUNT_OUT_OF_BOUNDS",
      files: paths.length,
    };
  }
  const edges = [],
    syntaxErrors = [],
    unresolved = [],
    dynamicUnknowns = [],
    inventory = [];
  for (const file of paths) {
    const source = readFileSync(file, "utf8");
    const sf = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const module = rel(root, file);
    const sha256 = createHash("sha256").update(source).digest("hex");
    inventory.push({ file: module, sha256, bytes: Buffer.byteLength(source) });
    for (const diag of sf.parseDiagnostics) {
      const lc = sf.getLineAndCharacterOfPosition(diag.start ?? 0);
      syntaxErrors.push({ file: module, line: lc.line + 1, code: diag.code });
    }
    const emit = (specifier, node, syntax) => {
      const point = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      const resolved = resolveSpecifier(root, file, specifier);
      const edge = {
        from: module,
        line: point.line + 1,
        syntax,
        specifier,
        ...resolved,
      };
      edges.push(edge);
      if (resolved.kind === "unresolved") unresolved.push(edge);
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        if (
          node.moduleSpecifier &&
          ts.isStringLiteralLike(node.moduleSpecifier)
        ) {
          emit(
            node.moduleSpecifier.text,
            node,
            ts.isImportDeclaration(node) ? "import" : "export_from",
          );
        }
      } else if (ts.isCallExpression(node)) {
        if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
          if (
            node.arguments.length === 1 &&
            ts.isStringLiteralLike(node.arguments[0])
          ) {
            emit(node.arguments[0].text, node, "import_dynamic_literal");
          } else
            dynamicUnknowns.push({
              file: module,
              line:
                sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
              kind: "dynamic_import_expression",
            });
        } else if (
          ts.isIdentifier(node.expression) &&
          node.expression.text === "require"
        ) {
          if (
            node.arguments.length === 1 &&
            ts.isStringLiteralLike(node.arguments[0])
          ) {
            emit(node.arguments[0].text, node, "require_literal");
          } else
            dynamicUnknowns.push({
              file: module,
              line:
                sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
              kind: "dynamic_require_expression",
            });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const internal = edges.filter((x) => x.kind === "internal");
  const uniquePairs = new Set(internal.map((x) => x.from + " -> " + x.target));
  return {
    status:
      syntaxErrors.length === 0 && unresolved.length === 0
        ? "STATIC_IMPORTS_VERIFIED"
        : "INCONCLUSIVE",
    scope:
      "Observed local JavaScript module imports only, not full runtime behavior",
    modules: inventory.length,
    inventory,
    edges,
    statistics: {
      internal_edges: internal.length,
      unique_internal_pairs: uniquePairs.size,
      external_edges: edges.filter((x) => x.kind === "external").length,
      boundary_edges: edges.filter((x) => x.kind === "out_of_scope").length,
      asset_edges: edges.filter((x) => x.kind === "asset").length,
      unknown_dynamic_imports: dynamicUnknowns.length,
      unresolved_edges: unresolved.length,
      syntax_errors: syntaxErrors.length,
    },
    unresolved,
    syntaxErrors,
    dynamicUnknowns,
    limitations: [
      "Static syntax only: imports do not prove functions actually execute",
      "Nonliteral dynamic imports/requires remain unconfirmed",
      "Only paths inside the selected source root are resolved",
      "Dependencies supplied by the npm ecosystem are not inspected",
    ],
  };
}
