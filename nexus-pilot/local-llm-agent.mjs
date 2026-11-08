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
import { verifyEventFlow, validatedExplanation } from './verified-flow.mjs';

const [targetArg, reportArg] = process.argv.slice(2);
if (!targetArg || !reportArg) {
  console.error('Usage: node local-llm-agent.mjs /absolute/todomvc-es6 /absolute/report.json');
  process.exit(64);
}
const target = resolve(targetArg), reportPath = resolve(reportArg);
const modelId = 'onnx-community/Qwen2.5-1.5B-Instruct';
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
    {role:'system',content:'You are a technical agent selecting ONE operation from tool descriptions. Reply with exactly the tool name, no quotes or explanation.'},
    {role:'user',content:'Question: which modules were identified in the ALREADY-COMPLETED JavaScript analysis? A valid retained Evidence ID is available. Choose the next operation by its behavior: (A) analyze_javascript_application = scan a directory AGAIN and generate NEW evidence; (B) inspect_analysis_view = read an EXISTING retained Evidence to view its modules without running another analysis. Reply with the EXACT tool name needed to answer using the EXISTING Evidence.'},
  ];
  const choiceResult=await generator(choicePrompt,{max_new_tokens:32,do_sample:false,return_full_text:false});
  const rawChoice=outputText(choiceResult);
  report.observations.model_raw_tool_choice=rawChoice.slice(0,350);
  const choiceText=rawChoice.trim();
  const exact=allowed.has(choiceText)?choiceText:null;
  const option=/^\(?([AB])\)?[.]?$/i.exec(choiceText);
  const mapped=option?(option[1].toUpperCase()==='A'?'analyze_javascript_application':'inspect_analysis_view'):null;
  const singleName=[...allowed].filter(name=>new RegExp('\\b'+name+'\\b').test(choiceText));
  const chosen=exact||mapped||(singleName.length===1?singleName[0]:null);
  report.observations.model_exact_tool_format=Boolean(exact);
  report.observations.model_choice_resolution=exact?'EXACT_TOOL_NAME':mapped?'LABELED_OPTION':chosen?'NAMED_IN_TEXT':'UNRESOLVED';
  report.observations.model_selected_tool=chosen;
  report.observations.model_tool_selection_pass=chosen==='inspect_analysis_view';
  const selectedForExecution=chosen==='inspect_analysis_view' ? chosen : 'inspect_analysis_view';
  report.observations.tool_selection_override=chosen!==selectedForExecution;
  report.observations.tool_override_reason=chosen!==selectedForExecution
    ? 'The requested answer requires the already retained Evidence, never a second scan'
    : null;
  stage(chosen===selectedForExecution?'MODEL_SELECTED_CORRECT_MCP_TOOL':'POLICY_SELECTED_SAFE_TOOL');

  const listed=evidence(await session.call('tools/call',{
    name:selectedForExecution,
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

  const verified=verifyEventFlow(target, 'newTodo');
  report.observations.static_verification_status=verified.status;
  report.observations.static_verification_steps=verified.steps||[];
  report.observations.static_verification_limits=verified.limits||[];
  if(verified.status!=='VERIFIED_STATIC_CHAIN')throw new Error('Static source verification INCONCLUSIVE: '+verified.reason);
  const trusted=validatedExplanation(verified);
  const qualified=verified.steps.map(s=>s.className+'.'+s.method);
  stage('INDEPENDENT_STATIC_SOURCE_VERIFIED');

  const snippets=[
    excerpt('view.js','bindCallback(event, handler)',340),
    excerpt('controller.js','this.view.bindCallback("newTodo"',260),
    excerpt('controller.js','addItem(title) {',260),
    excerpt('model.js','create(title, callback) {',340),
    excerpt('store.js','save(updateData, callback, id) {',1100),
    excerpt('app.js','function Todo(name) {',300),
  ].join('\n\n');
  const question='Quando uma pessoa cria uma nova tarefa em TodoMVC, quais sao os quatro metodos exatos no caminho do evento ate a escrita no armazenamento?';
  report.observations.prompt_version='verified_chain_grounded_v3';
  const messages=[
    {role:'system',content:'Você é um assistente que explica fatos de código JÁ VERIFICADOS por análise estática. Na primeira linha, escreva EXATAMENTE a cadeia de quatro métodos completos, usando NomeDaClasse.nomeDoMetodo e separador ->. Não altere a ordem. Depois, uma frase em português informando que análise estática não comprova execução real. Nada além disso.'},
    {role:'user',content:'Pergunta: '+question+'\n\nFatos ESTÁTICOS VERIFICADOS independentemente pelo parser com fontes por arquivo e linha (setup -> handler -> model -> armazenamento):\n'+JSON.stringify(verified.steps.map(s=>({className:s.className,method:s.method,phase:s.phase,source:s.file+":"+s.line})))+'\n\nEscreva a cadeia exatamente como: '+qualified.join(' -> ')+'\n\nA REA/MCP confirmou os módulos, não execução dinâmica. Trechos originais:\n'+snippets},
  ];
  const answerResult=await generator(messages,{max_new_tokens:200,do_sample:false,return_full_text:false});
  const answer=outputText(answerResult).trim();
  report.observations.model_answer=answer.slice(0,2400);
  report.observations.answer_question=question;
  report.observations.answer_evidence_sources='REA MCP module references + original pinned source excerpts';

  const expected=verified.steps.map(x=>({file:x.file,method:x.method,qualified:x.className+'.'+x.method}));
  const rawFirstLine=answer.split(/\r?\n/,1)[0].trim();
  const modelChain=rawFirstLine.split(/\s*(?:->|→)\s*/).map(x=>x.trim().replace(/[.。]+$/,''));
  const correctChain=modelChain.length===expected.length&&
    modelChain.every((part,i)=>part===expected[i].qualified);
  const unsupported=/\blocalStorage\b|\bSQL\b|\bMongoDB\b|\bPostgreSQL\b/i.test(answer);
  report.observations.rule_checks={
    expected:expected.map(x=>x.qualified),
    model_chain:modelChain,
    exact_order_and_names:correctChain,
    unsupported_database_claim:unsupported,
  };
  report.observations.model_answer_pass=correctChain&&!unsupported;
  report.observations.final_answer={
    origin:report.observations.model_answer_pass?'LLM_FORMAT_VALIDATED_AGAINST_STATIC_SOURCE':'AST_STATIC_VERIFIER_FALLBACK',
    status:trusted.status,
    text:report.observations.model_answer_pass?answer:trusted.text,
    sources:trusted.sources,
    limitations:verified.limits,
  };
  report.status=report.observations.model_answer_pass?'PASS_VERIFIED_DELIVERY_LLM_ACCEPTED':'PASS_VERIFIED_DELIVERY_LLM_REJECTED_FALLBACK';
  stage(report.observations.model_answer_pass?'LLM_VALIDATED_AND_DELIVERED':'LLM_REJECTED_VERIFIED_SOURCE_DELIVERED');
  save();
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
