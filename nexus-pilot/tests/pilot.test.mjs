import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { evaluateEngine, inspectReadiness } from '../preflight.mjs';
import { evaluateRequest } from '../fixture/sourcing.js';

const pilotRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

test('Node engine policy respects REA requirements', () => {
  const e = '^22.23.4 || ^24.22.1 || >=26.12.1';
  for (const good of ['v22.23.4', 'v22.25.0', 'v24.22.1', 'v24.30.0', 'v26.12.1', 'v27.0.0']) {
    assert.equal(evaluateEngine(good, e).compatible, true, good);
  }
  for (const bad of ['v22.16.0', 'v23.0.0', 'v24.22.0', 'v25.0.0', 'v26.12.0', 'v22.23.4-rc1', 'junk']) {
    assert.equal(evaluateEngine(bad, e).compatible, false, bad);
  }
  assert.equal(evaluateEngine('v24.22.1', 'not a valid engine').reason, 'UNSUPPORTED_ENGINE_SYNTAX');
});

test('preflight never claims the REA runtime or MCP connection was tested', () => {
  const r = inspectReadiness({ root: pilotRoot, nodeVersion: 'v22.16.0' });
  const pkg = JSON.parse(readFileSync(resolve(pilotRoot, 'package.json'), 'utf8'));
  assert.equal(r.package, 'rea-agents');
  assert.equal(r.package_version, pkg.version);
  assert.equal(r.node_compatible, false);
  assert.equal(r.rea_runtime_test, 'NOT_RUN');
  assert.equal(r.mcp_agent_connection, 'NOT_VERIFIED');
  assert.equal(r.external_execution, false);
  assert.equal(r.secrets_read, false);
});

test('synthetic sample produces deterministic human-review decisions', () => {
  assert.deepEqual(evaluateRequest({ estimatedAmount: 0, offersReceived: 2, isEmergency: false }),
    { status: 'INVALID', reason: 'AMOUNT_INVALID' });
  assert.deepEqual(evaluateRequest({ estimatedAmount: 120000, offersReceived: 1, isEmergency: false }),
    { status: 'REVIEW', reason: 'LARGE_REQUEST_INSUFFICIENT_OFFERS' });
  assert.deepEqual(evaluateRequest({ estimatedAmount: 1500, offersReceived: 3, isEmergency: true }),
    { status: 'REVIEW', reason: 'EMERGENCY_REQUIRES_REVIEW' });
  assert.deepEqual(evaluateRequest({ estimatedAmount: 1500, offersReceived: 2, isEmergency: false }),
    { status: 'READY_FOR_HUMAN', reason: 'DOCUMENTS_READY' });
});
