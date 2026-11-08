/**
 * NEXUS/REA preflight: read-only and offline. No child processes or secrets.
 * A supported Node version does NOT prove REA or an MCP client is running.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(thisFile), '..');

function parseVersion(value) {
  const match = String(value).trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function compare(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

export function evaluateEngine(version, engineRange) {
  const candidate = parseVersion(version);
  if (!candidate || typeof engineRange !== 'string' || !engineRange.trim()) {
    return { compatible: false, reason: 'INVALID_VERSION_OR_ENGINE' };
  }
  const terms = engineRange.split(/\s*\|\|\s*/);
  let accepted = false;
  for (const term of terms) {
    const match = term.match(/^(\^|>=)(\d+\.\d+\.\d+)$/);
    if (!match) return { compatible: false, reason: 'UNSUPPORTED_ENGINE_SYNTAX' };
    const minimum = parseVersion(match[2]);
    const comparable = compare(candidate, minimum);
    if ((match[1] === '^' && candidate[0] === minimum[0] && comparable >= 0) ||
        (match[1] === '>=' && comparable >= 0)) accepted = true;
  }
  return { compatible: accepted, reason: accepted ? 'SUPPORTED' : 'NODE_ENGINE_MISMATCH' };
}

export function inspectReadiness({ nodeVersion = process.version, root = repoRoot } = {}) {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const preferred = readFileSync(resolve(root, '.nvmrc'), 'utf8').trim();
  const support = evaluateEngine(nodeVersion, pkg.engines?.node);
  return {
    pilot: 'NEXUS_REA_001',
    package: pkg.name,
    package_version: pkg.version,
    local_node: nodeVersion,
    required_node: pkg.engines?.node ?? null,
    upstream_recommended_node: preferred,
    node_compatible: support.compatible,
    node_status: support.reason,
    rea_runtime_test: 'NOT_RUN',
    mcp_agent_connection: 'NOT_VERIFIED',
    external_execution: false,
    secrets_read: false,
    target: 'nexus-pilot/fixture (synthetic, owned by this fork)',
    next_step: support.compatible
      ? 'Install in an isolated environment after review, then run documented static JavaScript analysis.'
      : 'Use the pinned Node version in .nvmrc in an isolated environment before running REA.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log('Usage: node nexus-pilot/preflight.mjs [--json] [--strict]');
  } else if (args.some((arg) => !['--json', '--strict'].includes(arg))) {
    console.error('Unsupported argument. Use --help.');
    process.exitCode = 64;
  } else {
    const report = inspectReadiness();
    console.log(JSON.stringify(report, null, 2));
    if (args.includes('--strict') && !report.node_compatible) process.exitCode = 2;
  }
}
