/**
 * NEXUS REA 004: genuine local LLM chooses a permitted MCP tool and explains
 * publicly licensed, pin-verified TodoMVC source. No paid API or credentials.
 * Experimental, bounded, not production. The model is NOT ChatGPT.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { pipeline, env } from '@huggingface/transformers';

const [targetArg, reportArg] = process.argv.slice(2);
if (!targetArg || !reportArg) {
  console.error('Usage: node local-llm-agent.mjs /absolute/todomvc-es6 /absolute/report.json');
  process.exit(64);
}
const target = resolve(targetArg), reportPath = resolve(reportArg);
const modelId = 'onnx-community/Qwen2.5-0.5B-Instruct';
const allowed = new Set(['analyze_javascript_application', 'inspect_analysis_view']);
env.cacheDir = join(process.env.RUNNER_TEMP || '/tmp', 'nexus-hf-cache');
const report = {
  pilot: 'NEXUS_REA_004',
  status: 'STARTED',
  model: modelId,
  model_quantization: 'q4',
  inference_location: 'GitHub Actions CPU, local ONNX',
  rea_version: '6.8.0',
  input_source: 'MIT TodoMVC JavaScript ES6, pinned commit ff43b02e59dfa604386bb382034b2cd07c2bcd8a',
  external_llm_api: false,
  paid_api_key: false,
  private_data_used: false,
  target_code_executed: false,
  production_changed: false,
  stages: [],
  observations: {},
};
let session = null;
const started = performance.now();
function stage(s) { report.stages.push(s); console.log('REA_LOCAL_AGENT_STAGE=' + s); }
function save() {
  report.duration_ms = Math.round(performance.now() - started);
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
}
function startMcp() {
  const child = spawn('npx', ['--yes','rea-agents@6.8.0','mcp'], {
    cwd: process.env.RUNNER_TEMP || '/tmp',
    env: { ...process.env, REA_MCP_TOOL_CATALOG_PROFILE: 'full' },
    stdio: ['pipe','pipe','pipe'],
    shell: false,
  });
  let buffer='', requestId=0, stopped=false, errTail='';
  const pending=new Map();
  function failAll(err) {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(err);
    }
    pending.clear();
  }
  child.stdout.on('data', chunk => {
    buffer+=chunk.toString('utf8');
    if (buffer.length > 16*1024*1024) {
      failAll(new Error('Oversized MCP frame'));
      child.kill('SIGTERM'); return;
    }
    let eol;
    while ((eol=buffer.indexOf('\n'))!==-1) {
      const line=buffer.slice(0,eol); buffer=buffer.slice(eol+1);
      if (!line.trim()) continue;
      let res;
      try { res=JSON.parse(line); }
      catch { failAll(new Error('Invalid MCP JSON')); child.kill('SIGTERM'); return; }
      if (res.id == null) continue;
      const p=pending.get(res.id); if(!p) continue;
      clearTimeout(p.timer); pending.delete(res.id);
      if (res.error) p.reject(new Error('MCP '+p.method+': '+JSON.stringify(res.error).slice(0,900)));
      else p.resolve(res.result);
    }
  });
  child.stderr.on('data', c=>{errTail=(errTail+c.toString('utf8')).slice(-900);});
  child.on('error', failAll);
  child.on('exit',(c,s)=>{stopped=true;failAll(new Error('MCP exited: '+(c==null?s:c)+' '+errTail));});
  return {
    call(method, params={}, ms=45000) {
      if(stopped) return Promise.reject(new Error('MCP not running'));
      if(method==='tools/call' && !allowed.has(params?.name)) {
        return Promise.reject(new Error('CLIENT_ALLOWLIST_BLOCKED:'+String(params?.name)));
      }
      return new Promise((accept,reject)=>{
        const id=++requestId;
        const timer=setTimeout(()=>{pending.delete(id);reject(new Error('MCP '+method+' timeout'));},ms);
        pending.set(id,{resolve:accept,reject,timer,method});
        child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n',error=>{
          if(error){clearTimeout(timer);pending.delete(id);reject(error);}
        });
      });
    },
    notify(method,params={}) {
      child.stdin.write(JSON.stringify({jsonrpc:'2.0',method,params})+'\n');
    },
    stop() {
      if(!stopped){child.stdin.end();child.kill('SIGTERM');}
    },
  };
}
function evidence(result) {
  if(!result || result.isError) {
    throw new Error('REA MCP isError: '+JSON.stringify(result?.content||result).slice(0,1200));
  }
  if(result.structuredContent && typeof result.structuredContent==='object') return result.structuredContent;
  for(const line of result.content||[]) {
    if(line.type==='text'){
      try {const v=JSON.parse(line.text);if(v&&typeof v==='object')return v;}catch{}
    }
  }
  throw new Error('REA MCP returned no Evidence payload');
}
function outputText(v) {
  const g=v?.[0]?.generated_text;
  if(typeof g==='string') return g;
  if(Array.isArray(g)) return String(g.at(-1)?.content??'');
  return JSON.stringify(g??v).slice(0,400);
}
function excerpt(file, marker, chars=480) {
  const raw=readFileSync(join(target,'src',file),'utf8');
  const pos=raw.indexOf(marker);
  if(pos<0)throw new Error('Pinned-source marker missing: '+file+' '+marker);
  return file+':\n'+raw.slice(Math.max(0,pos-50),pos+chars).trim();
}
try {
  session=startMcp();
  const init=await session.call('initialize',{
    protocolVersion:'2025-06-18',capabilities:{},
    clientInfo:{name:'nexus-rea-local-llm-eval',version:'0.1.0'},
  },120000);
  if(!init?.serverInfo?.name)throw new Error('MCP handshake missing server identity');
  session.notify('notifications/initialized');
  stage('MCP_INITIALIZED');
  const toolset=await session.call('tools/list',{},90000);
  const tools=toolset?.tools||[];
  for(const name of allowed){
    if(!tools.some(x=>x.name===name))throw new Error('Missing MCP tool '+name);
  }
  report.observations.server_tool_count=tools.length;
  report.observations.client_allowlist=[...allowed];
  const analyzed=evidence(await session.call('tools/call',{
    name:'analyze_javascript_application',
    arguments:{input_path:target,detail:'summary'},
  },420000));
  const parent=analyzed.normalized_result?.parent_evidence_id;
  if(typeof parent!=='string')throw new Error('No retained parent Evidence');
  report.observations.parent_evidence_id=parent;
  stage('REA_RETENTION_CREATED');

  const loadStart=performance.now();
  const generator=await pipeline('text-generation',modelId,{
    dtype:'q4',device:'cpu',
  });
  report.observations.model_load_ms=Math.round(performance.now()-loadStart);
  stage('OPEN_MODEL_LOADED_ON_CPU');

  const choicePrompt=[
    {role:'system',content:'You are a technical agent selecting a tool. Reply with exactly ONE tool name; no quotes or explanation.'},
    {role:'user',content:'REA analyzed JavaScript and retained its evidence. To inspect module references from the retained Evidence ID, which tool must you call? Choose: analyze_javascript_application OR inspect_analysis_view. Reply with the exact tool name only.'},
  ];
  const choiceResult=await generator(choicePrompt,{max_new_tokens:32,do_sample:false,return_full_text:false});
  const rawChoice=outputText(choiceResult);
  report.observations.model_raw_tool_choice=rawChoice.slice(0,350);
  const candidates=[...allowed].filter(name=>new RegExp('\\b'+name+'\\b').test(rawChoice));
  if(candidates.length!==1)throw new Error('Model failed unique tool selection: '+rawChoice.slice(0,140));
  const chosen=candidates[0];
  report.observations.model_selected_tool=chosen;
  if(chosen!=='inspect_analysis_view')throw new Error('Model selected wrong tool '+chosen);
  stage('MODEL_SELECTED_CORRECT_MCP_TOOL');

  const listed=evidence(await session.call('tools/call',{
    name:chosen,
    arguments:{
      source:{kind:'retained-evidence',evidence_id:parent},
      view:{kind:'javascript',collection:'modules',projection:'references',offset:0,limit:64},
    },
  },180000));
  const normalized=listed.normalized_result||{};
  const content=JSON.stringify(normalized);
  const seven=['app.js','controller.js','helpers.js','model.js','store.js','template.js','view.js'];
  const seen=seven.filter(x=>content.includes(x));
  report.observations.mcp_module_coverage=seen.length+'/7';
  report.observations.mcp_view_evidence_id=listed.evidence_id||null;
  if(seen.length!==7)throw new Error('MCP module verification incomplete');
  stage('LLM_SELECTED_TOOL_CALLED_REAL_MCP');

  const snippets=[
    excerpt('view.js','bindCallback(event, handler)',340),
    excerpt('controller.js','this.view.bindCallback("newTodo"',260),
    excerpt('controller.js','addItem(title) {',260),
    excerpt('model.js','create(title, callback) {',340),
    excerpt('store.js','save(updateData, callback, id) {',490),
    excerpt('app.js','function Todo(name) {',300),
  ].join('\n\n');
  const question='Explique o fluxo de criar uma nova tarefa TodoMVC, desde a View até Store, sem inventar banco de dados. Quais funcoes estao envolvidas?';
  const messages=[
    {role:'system',content:'Você é um agente de análise de código. Use somente os fatos fornecidos. Diferencie evidências da REA (módulos) e trechos originais do código. Se algo não estiver comprovado, declare incerteza. Responda em português, em até 110 palavras.'},
    {role:'user',content:'Pergunta: '+question+'\n\nMCP/REA confirmou os módulos: '+seen.join(', ')+'. Esses nomes NÃO provam chamadas internas.\n\nTrechos do código-fonte público verificado:\n'+snippets},
  ];
  const answerResult=await generator(messages,{max_new_tokens:200,do_sample:false,return_full_text:false});
  const answer=outputText(answerResult).trim();
  report.observations.model_answer=answer.slice(0,2400);
  report.observations.answer_question=question;
  report.observations.answer_evidence_sources='REA MCP module references + original pinned source excerpts';
  const expected=[
    ['view.js','bindCallback'],
    ['controller.js','addItem'],
    ['model.js','create'],
    ['store.js','save'],
  ];
  const includes=expected.map(([file,fn])=>({
    file,fn,present:new RegExp('\\b'+fn+'\\b','i').test(answer)
  }));
  const positions=expected.map(([,fn])=>answer.search(new RegExp('\\b'+fn+'\\b','i')));
  const allIncluded=includes.every(x=>x.present);
  const validOrder=positions.every((x,i)=>x>=0 && (i===0||x>positions[i-1]));
  const unsupportedDb=/\blocalStorage\b|\bSQL\b|\bMongoDB\b|\bPostgreSQL\b/i.test(answer);
  report.observations.rule_checks={
    methods:includes,
    methods_in_order:validOrder,
    unsupported_database_claim:unsupportedDb,
  };
  report.observations.answer_pass=allIncluded&&validOrder&&!unsupportedDb;
  report.status=report.observations.answer_pass?'PASS':'PARTIAL_OR_INCORRECT_ANSWER';
  stage('MODEL_ANSWER_EVALUATED_AGAINST_SOURCE');
  save();
  if(!report.observations.answer_pass)process.exitCode=2;
} catch(e) {
  report.status='FAILURE';
  report.failure=String(e?.message||e).slice(0,1200);
  stage('FAILURE_RECORDED');
  save();
  console.error('NEXUS_REA_LOCAL_AGENT_ERROR='+report.failure);
  process.exitCode=1;
} finally {
  session?.stop();
}
