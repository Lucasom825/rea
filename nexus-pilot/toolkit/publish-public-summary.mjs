/**
 * NEXUS 069: Publish only a bounded, non-secret projection of the VERIFIED
 * public REA artifact. This script runs in its own write-permitted job;
 * the REA analysis job remains contents:read and credential-persistence:off.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const input=process.env.NEXUS_REA_REPORT_PATH;
const runId=Number(process.env.NEXUS_REA_RUN_ID);
const artifactId=Number(process.env.NEXUS_REA_ARTIFACT_ID);
if (!input || !Number.isSafeInteger(runId) || runId < 1 ||
    !Number.isSafeInteger(artifactId) || artifactId < 1) throw Error('Missing trusted run/artifact IDs');
const raw=readFileSync(input);
if (!raw.length || raw.length > 100000) throw Error('Bounded report missing/oversized');
const r=JSON.parse(raw.toString('utf8')), t=r?.target??{}, c=r?.checks??{};
if(r?.toolkit!=='NEXUS_REA_TOOLKIT_007' ||
   t.repository!=='axios/axios' || t.scope!=='lib' ||
   t.commit!=='4ee8d46fc463770b8f5da718d5449a5b027b2c08' ||
   !['COBERTURA_ESTRUTURAL_CONFIRMADA','COBERTURA_ESTRUTURAL_COM_RESSALVAS','INCONCLUSIVO'].includes(r.status) ||
   c.source_executed!==false || c.behavior_test_verified!==false ||
   c.rea_operation!=='analyze_javascript_application' ||
   !/^ev_[a-f0-9]{64}$/.test(c.rea_evidence_id??'') ||
   !Array.isArray(r.hard_failures) || !Array.isArray(r.remaining_uncertainties) ||
   !Array.isArray(r.structural_hubs)) throw Error('Report identity or schema mismatch: not publishing');
const num=(key)=>{const v=c[key];if(!Number.isSafeInteger(v)||v<0||v>1000000)throw Error('Invalid '+key);return v;};
const clean=(value,max=120)=>String(value??'').slice(0,max).replace(/[\r\n<>&]/g,' ');
const metrics=['ast_js_files','rea_parsed_js','rea_parse_failures','ast_import_sites',
  'matched_import_sites','ast_unique_internal_import_pairs',
  'additional_rea_unreconciled','rea_semantic_unknowns'];
const checks=Object.fromEntries(metrics.map(k=>[k,num(k)]));
checks.source_executed=false;
checks.behavior_test_verified=false;
if(checks.rea_parsed_js!==checks.ast_js_files || checks.matched_import_sites>checks.ast_import_sites)
  throw Error('Inconsistent structural evidence');
const result={
  schema:'NEXUS_REA_PUBLIC_SUMMARY_V1',
  source:'Lucasom825/rea',
  run_id:runId,
  artifact_id:artifactId,
  run_url:'https://github.com/Lucasom825/rea/actions/runs/'+runId,
  target:{repository:t.repository,commit:t.commit,directory:t.scope},
  status:r.status,
  created_at:String(r.timestamp_utc??''),
  evidence_id:c.rea_evidence_id,
  report_sha256:createHash('sha256').update(raw).digest('hex'),
  checks,
  uncertainties:r.remaining_uncertainties.slice(0,12).map(x=>clean(x)),
  structural_hubs:r.structural_hubs.slice(0,8).map(x=>({
    module:clean(x.module),
    direct_dependents:Number.isSafeInteger(x.direct_dependents)?x.direct_dependents:0
  })),
  limitations:[
    'Análise somente estática de código público: comportamento de aplicativo não comprovado.',
    'Nenhum aplicativo foi instalado, portado ou reconstruído.',
    'Licença e segurança requerem revisão humana.'
  ]
};
mkdirSync('nexus-pilot/public-reports',{recursive:true});
writeFileSync('nexus-pilot/public-reports/axios-lib-latest.json',JSON.stringify(result,null,2)+'\n');
console.log('NEXUS069_PUBLIC_SUMMARY_VALIDATED=true');
console.log('NEXUS069_REPORT_ID='+result.evidence_id);
