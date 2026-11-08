/**
 * NEXUS + REA 003: controlled MCP stdio probe, no external LLM.
 * Read-only: initialize/list/prompts/JS static analysis/view.
 * Never executes target code or writes to another system.
 */
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const [targetInput, reportInput] = process.argv.slice(2);
if (!targetInput || !reportInput) {
  console.error('Usage: node nexus-pilot/mcp-probe.mjs /absolute/target /absolute/report.json');
  process.exit(64);
}
const target = resolve(targetInput);
const reportFile = resolve(reportInput);
const report = {
  test: 'NEXUS_REA_003',
  subject: 'Pinned MIT TodoMVC JavaScript ES6; static inspection only',
  target: 'todomvc-es6',
  protocol: 'MCP stdio JSON-RPC',
  external_llm_used: false,
  autonomous_agent_integration: false,
  target_code_executed: false,
  service_change: false,
  stages: [],
  observed: {},
  status: 'INCOMPLETE',
};
const scope = process.env.NEXUS_REA_SCOPE?.trim() || '';
report.requested_tool_families = scope || 'full';
const started = performance.now();
let seq = 0;
let bytesReceived = 0;
let stderrTail = '';
let stdoutBuffer = '';
let terminated = false;
const pending = new Map();
const child = spawn('npx', ['--yes', 'rea-agents@6.8.0', 'mcp'], {
  cwd: process.env.RUNNER_TEMP || '/tmp',
  env: { ...process.env, REA_MCP_TOOL_CATALOG_PROFILE: 'full', ...(scope ? { REA_MCP_TOOL_FAMILIES: scope } : {}) },
  stdio: ['pipe', 'pipe', 'pipe'],
  shell: false,
});
function mark(stage) {
  report.stages.push(stage);
  console.log('NEXUS_REA_MCP_STAGE=' + stage);
}
function rejectAll(error) {
  for (const request of pending.values()) {
    clearTimeout(request.timer);
    request.reject(error);
  }
  pending.clear();
}
function receive(line) {
  if (!line.trim()) return;
  let message;
  try { message = JSON.parse(line); }
  catch { throw new Error('MCP server emitted non-JSON stdout'); }
  if (message.id === undefined || message.id === null) return;
  const req = pending.get(message.id);
  if (!req) return;
  pending.delete(message.id);
  clearTimeout(req.timer);
  if (message.error) {
    req.reject(new Error('MCP ' + req.method + ' error: ' + JSON.stringify(message.error).slice(0, 950)));
  } else {
    req.resolve(message.result);
  }
}
child.stdout.on('data', chunk => {
  bytesReceived += chunk.length;
  stdoutBuffer += chunk.toString('utf8');
  if (stdoutBuffer.length > 16 * 1024 * 1024) {
    rejectAll(new Error('MCP stdout line exceeded 16 MiB cap'));
    child.kill('SIGTERM');
    return;
  }
  let newline;
  while ((newline = stdoutBuffer.indexOf('\n')) !== -1) {
    const line = stdoutBuffer.slice(0, newline);
    stdoutBuffer = stdoutBuffer.slice(newline + 1);
    try { receive(line); }
    catch (error) { rejectAll(error); child.kill('SIGTERM'); }
  }
});
child.stderr.on('data', chunk => { stderrTail = (stderrTail + chunk.toString('utf8')).slice(-4000); });
child.on('error', rejectAll);
child.on('exit', (code, signal) => {
  terminated = true;
  rejectAll(new Error('MCP exited early (' + (code === null ? signal : code) + ')'));
});
const allowedToolCalls = new Set(['analyze_javascript_application', 'inspect_analysis_view']);
function call(method, params = {}, timeoutMs = 45000) {
  if (method === 'tools/call' && !allowedToolCalls.has(params?.name)) {
    return Promise.reject(new Error('CLIENT_ALLOWLIST_BLOCKED: ' + String(params?.name)));
  }
  if (terminated || child.stdin.destroyed) return Promise.reject(new Error('MCP child not active'));
  const id = ++seq;
  return new Promise((accept, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Timeout calling MCP ' + method + ' after ' + timeoutMs + 'ms'));
    }, timeoutMs);
    pending.set(id, { resolve: accept, reject, timer, method });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n', err => {
      if (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(err);
      }
    });
  });
}
function notify(method, params = {}) {
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
}
function unwrapTool(out) {
  if (!out || out.isError === true) {
    throw new Error('REA MCP tool isError: ' + JSON.stringify(out?.content ?? out).slice(0, 1200));
  }
  if (out.structuredContent && typeof out.structuredContent === 'object') return out.structuredContent;
  for (const c of out.content || []) {
    if (c.type === 'text') {
      try {
        const obj = JSON.parse(c.text);
        if (obj && typeof obj === 'object') return obj;
      } catch {}
    }
  }
  throw new Error('MCP tool returned no parseable structured evidence');
}
const wantedNames = [
  'analyze_javascript_application',
  'inspect_analysis_view',
  'guided_workflows',
  'trace_application_feature',
];
const save = () => writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', 'utf8');
try {
  const initialized = await call('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'nexus-rea-controlled-mcp-probe', version: '0.1.0' },
  }, 120000);
  if (!initialized?.serverInfo?.name || !initialized?.protocolVersion) {
    throw new Error('MCP initialize lacked server identity/protocol version');
  }
  mark('INITIALIZE_SUCCESS');
  report.observed.server_info = initialized.serverInfo;
  report.observed.negotiated_protocol = initialized.protocolVersion;
  notify('notifications/initialized');

  let cursor;
  const tools = [];
  for (let page = 0; page < 15; page += 1) {
    const result = await call('tools/list', cursor ? { cursor } : {}, 90000);
    tools.push(...(result?.tools ?? []));
    if (!result?.nextCursor) { cursor = null; break; }
    cursor = result.nextCursor;
    if (page === 14) throw new Error('Tool discovery pagination not finished');
  }
  const selectedTools = tools.filter(x => wantedNames.includes(x.name));
  report.observed.total_tools = tools.length;
  report.observed.selected_tools = selectedTools.map(t => ({
    name: t.name,
    required: t.inputSchema?.required ?? [],
    parameter_keys: Object.keys(t.inputSchema?.properties ?? {}),
  }));
  for (const required of ['analyze_javascript_application','inspect_analysis_view']) {
    if (!selectedTools.some(t => t.name === required)) {
      throw new Error('MCP did not advertise tool: ' + required);
    }
  }
  const clientTools = selectedTools.filter(t => allowedToolCalls.has(t.name));
  if (clientTools.length !== 2) throw new Error('Client tool allowlist did not select two known tools');
  report.observed.client_selected_schema_count = clientTools.length;
  report.observed.client_selected_tool_names = clientTools.map(t => t.name);
  let denied = false;
  try { await call('tools/call', { name: 'open_binary', arguments: {} }); }
  catch (err) { denied = String(err?.message).startsWith('CLIENT_ALLOWLIST_BLOCKED'); }
  if (!denied) throw new Error('Client failed to block a non-allowlisted tool');
  report.observed.nonallowlisted_tool_blocked = true;
  mark('TOOL_DISCOVERY_SUCCESS');

  const prompts = await call('prompts/list', {}, 30000);
  report.observed.prompt_names = (prompts?.prompts ?? []).map(x => x.name);
  if (report.observed.prompt_names.includes('investigate_feature')) {
    const guidance = await call('prompts/get', {
      name: 'investigate_feature',
      arguments: { feature: 'How does TodoMVC connect its modules?', document: 'TodoMVC ES6' },
    }, 45000);
    report.observed.guided_prompt_returned = Array.isArray(guidance?.messages) && guidance.messages.length > 0;
  } else {
    report.observed.guided_prompt_returned = false;
  }
  mark('PROMPT_DISCOVERY_COMPLETE');

  const analyzed = await call('tools/call', {
    name: 'analyze_javascript_application',
    arguments: { input_path: target, detail: 'summary' },
  }, 420000);
  const summaryEvidence = unwrapTool(analyzed);
  if (typeof summaryEvidence.evidence_id !== 'string') {
    throw new Error('Missing REA Evidence ID in MCP analysis result');
  }
  const parentId = summaryEvidence.normalized_result?.parent_evidence_id;
  if (typeof parentId !== 'string') {
    throw new Error('REA summary missing retained parent_evidence_id');
  }
  report.observed.analysis_summary_evidence_id = summaryEvidence.evidence_id;
  report.observed.parent_evidence_id = parentId;
  report.observed.analysis_authority = summaryEvidence.authority ?? null;
  report.observed.analysis_limitations = (summaryEvidence.limitations ?? []).length;
  mark('REAL_MCP_ANALYSIS_SUCCESS');

  const inspected = await call('tools/call', {
    name: 'inspect_analysis_view',
    arguments: {
      source: { kind: 'retained-evidence', evidence_id: parentId },
      view: { kind: 'javascript', collection: 'modules', projection: 'references', offset: 0, limit: 64 },
    },
  }, 180000);
  const evidence = unwrapTool(inspected);
  const view = evidence.normalized_result ?? {};
  const serialized = JSON.stringify(view);
  const seven = ['app.js','controller.js','helpers.js','model.js','store.js','template.js','view.js'];
  const observed = seven.filter(file => serialized.includes(file));
  report.observed.module_names_in_mcp_retrieval = observed;
  report.observed.module_retrieval_coverage = observed.length + '/' + seven.length;
  report.observed.view_evidence_id = evidence.evidence_id ?? null;
  report.observed.view_authority = evidence.authority ?? null;
  report.observed.view_limitations = (evidence.limitations ?? []).length;
  report.observed.view_coverage = view.coverage ?? null;
  if (observed.length !== seven.length) {
    throw new Error('Retained MCP module retrieval incomplete: ' + observed.length + '/7');
  }
  mark('RETAINED_EVIDENCE_QUERY_SUCCESS');
  report.observed.question = 'Quais módulos JavaScript compõem o aplicativo TodoMVC?';
  report.observed.answer = 'A evidência retida via MCP inclui: ' + observed.join(', ') + '.';
  report.observed.answer_origin = 'Deterministic from real tool response; not generated by an LLM';
  report.observed.stdout_bytes = bytesReceived;
  report.observed.total_elapsed_ms = Math.round(performance.now() - started);
  report.status = 'SUCCESS_MCP_CLIENT_NO_LLM';
  mark('PROTOCOL_PILOT_SUCCESS');
  save();
} catch (error) {
  report.status = 'FAILURE';
  report.error = String(error?.message ?? error).slice(0, 1600);
  report.observed.total_elapsed_ms = Math.round(performance.now() - started);
  report.observed.stderr_tail = stderrTail.slice(-1100);
  report.observed.stdout_bytes = bytesReceived;
  save();
  console.error('NEXUS_REA_MCP_FAILURE=' + report.error);
  process.exitCode = 1;
} finally {
  if (!terminated) { child.stdin.end(); child.kill('SIGTERM'); }
}
