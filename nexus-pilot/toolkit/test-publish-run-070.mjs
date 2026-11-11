import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";
import {execFileSync} from "node:child_process";
const script=resolve("nexus-pilot/toolkit/publish-run-summary-070.mjs");
const sha="a".repeat(40),evidence="ev_"+"f".repeat(64);
function fixture(){
  return {
    toolkit:"NEXUS_REA_TOOLKIT_007",status:"COBERTURA_ESTRUTURAL_COM_RESSALVAS",
    timestamp_utc:"2026-11-11T18:20:23.000Z",
    target:{preset:"public",repository:"axios/axios",commit:sha,scope:"lib"},
    checks:{
      source_executed:false,behavior_test_verified:false,
      rea_operation:"analyze_javascript_application",rea_evidence_id:evidence,
      ast_js_files:72,rea_parsed_js:72,rea_parse_failures:0,
      ast_import_sites:200,matched_import_sites:200,ast_unique_internal_import_pairs:178,
      additional_rea_unreconciled:7,rea_semantic_unknowns:13641
    },remaining_uncertainties:["UNKNOWN_IMPORTS"],structural_hubs:[{module:"utils.js",direct_dependents:30}]
  };
}
function run(input:unknown,overrides:Record<string,string>={}){
 const cwd=mkdtempSync(join(tmpdir(),"nexus070-"));
 const report=join(cwd,"private-raw-report.json");
 writeFileSync(report,JSON.stringify(input));
 const env={...process.env,
   GITHUB_REF:"refs/heads/nexus/rea-public-jobs-070-20261111",
   REA_PUBLIC_REPOSITORY:"axios/axios",REA_PUBLIC_SHA:sha,
   REA_PUBLIC_DIRECTORY:"lib",REA_PUBLIC_RUN_ID:"43012345000",REA_PUBLIC_ARTIFACT_ID:"300000012",
   REA_PUBLIC_REPORT_PATH:report,...overrides
 };
 try{
   const stdout=execFileSync(process.execPath,[script],{cwd,env,encoding:"utf8"});
   const outPath=join(cwd,"nexus-pilot/public-reports/by-run/43012345000.json");
   assert.ok(existsSync(outPath));
   const result=JSON.parse(readFileSync(outPath,"utf8"));
   return {ok:true,result,stdout};
 }catch(e){return {ok:false,err:String(e)};}
 finally{rmSync(cwd,{recursive:true,force:true});}
}
test("real public source report becomes bounded per-run metadata without raw evidence",()=>{
 const r=run(fixture());
 assert.equal(r.ok,true);
 if(!r.ok)return;
 assert.equal(r.result.target.repository,"axios/axios");
 assert.equal(r.result.checks.ast_import_sites,200);
 assert.equal(r.result.run_id,43012345000);
 assert.equal(r.result.checks.source_executed,false);
 assert.equal(r.result.report_sha256.length,64);
 assert.ok(!("raw_source" in r.result));
});
test("reject forged source, scope and any target execution",()=>{
 for(const modified of [
  {target:{...fixture().target,repository:"other/repo"}},
  {target:{...fixture().target,scope:"../../etc"}},
  {checks:{...fixture().checks,source_executed:true}},
  {checks:{...fixture().checks,behavior_test_verified:true}},
  {checks:{...fixture().checks,matched_import_sites:300}},
  {status:"SUCESSO_TOTAL"},
 ])assert.equal(run({...fixture(),...modified}).ok,false);
});
test("reject untrusted destination branch and unsafe directory",()=>{
 assert.equal(run(fixture(),{GITHUB_REF:"refs/heads/main"}).ok,false);
 assert.equal(run(fixture(),{REA_PUBLIC_DIRECTORY:"../../foo"}).ok,false);
 assert.equal(run(fixture(),{REA_PUBLIC_REPOSITORY:"evil.invalid/"}).ok,false);
});
