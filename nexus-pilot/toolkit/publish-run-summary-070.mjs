/**
 * NEXUS 070: bounded, public, per-run result publication.
 * This job is separate from the source-only REA analyzer.
 * Never accepts arbitrary write path or publishes full REA evidence.
 */
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {join} from "node:path";

const target = {
  repository: String(process.env.REA_PUBLIC_REPOSITORY ?? ""),
  commit: String(process.env.REA_PUBLIC_SHA ?? ""),
  directory: String(process.env.REA_PUBLIC_DIRECTORY ?? ""),
};
const runId = Number(process.env.REA_PUBLIC_RUN_ID);
const artifactId = Number(process.env.REA_PUBLIC_ARTIFACT_ID);
const branch = String(process.env.GITHUB_REF ?? "");
const inputPath = String(process.env.REA_PUBLIC_REPORT_PATH ?? "");
const repoRe = /^[A-Za-z0-9][A-Za-z0-9._-]{0,98}\/[A-Za-z0-9][A-Za-z0-9._-]{0,98}$/;
const scopeRe = /^[A-Za-z0-9_./@-]{1,180}$/;
if (branch !== "refs/heads/nexus/rea-public-jobs-070-20261111" ||
    !repoRe.test(target.repository) || target.repository.split("/").some(x=>x==="."||x===".."||x.endsWith(".git")) ||
    !/^[a-f0-9]{40}$/i.test(target.commit) ||
    !scopeRe.test(target.directory) || target.directory.split("/").some(x=>x==="."||x===".."||x==="") ||
    !Number.isSafeInteger(runId) || runId < 1 ||
    !Number.isSafeInteger(artifactId) || artifactId < 1 ||
    !inputPath) throw Error("REF_OR_TARGET_UNVERIFIED");

const raw = readFileSync(inputPath);
if (!raw.length || raw.length > 100000) throw Error("REPORT_TOO_LARGE_OR_EMPTY");
const r = JSON.parse(raw.toString("utf8")), c = r?.checks || {}, src = r?.target || {};
if (r?.toolkit !== "NEXUS_REA_TOOLKIT_007" || src.preset !== "public" ||
    src.repository !== target.repository || src.commit.toLowerCase() !== target.commit.toLowerCase() ||
    src.scope !== target.directory ||
    c.source_executed !== false || c.behavior_test_verified !== false ||
    c.rea_operation !== "analyze_javascript_application" ||
    !/^ev_[a-f0-9]{64}$/.test(String(c.rea_evidence_id ?? "")) ||
    !["COBERTURA_ESTRUTURAL_CONFIRMADA", "COBERTURA_ESTRUTURAL_COM_RESSALVAS", "INCONCLUSIVO"].includes(r.status) ||
    !Array.isArray(r.remaining_uncertainties) || !Array.isArray(r.structural_hubs))
    throw Error("REPORT_PROVENANCE_OR_SCHEMA_FAILED");
const keys=["ast_js_files","rea_parsed_js","rea_parse_failures",
 "ast_import_sites","matched_import_sites","ast_unique_internal_import_pairs",
 "additional_rea_unreconciled","rea_semantic_unknowns"];
const checks=Object.fromEntries(keys.map(k=>{
  const n=c[k];
  if (!Number.isSafeInteger(n) || n < 0 || n > 1_000_000) throw Error("INVALID_METRIC_"+k);
  return [k,n];
}));
if (checks.rea_parsed_js !== checks.ast_js_files ||
    checks.matched_import_sites > checks.ast_import_sites) throw Error("INCONSISTENT_METRICS");
const clean=(t,max=140)=>String(t??"").replace(/[\r\n<>&]/g," ").slice(0,max);
const result={
 schema:"NEXUS_REA_PUBLIC_SUMMARY_V1",source:"Lucasom825/rea",run_id:runId,artifact_id:artifactId,
 run_url:"https://github.com/Lucasom825/rea/actions/runs/"+runId,
 target,
 status:r.status,created_at:String(r.timestamp_utc??""),evidence_id:c.rea_evidence_id,
 report_sha256:createHash("sha256").update(raw).digest("hex"),
 checks:{...checks,source_executed:false,behavior_test_verified:false},
 uncertainties:r.remaining_uncertainties.slice(0,12).map(x=>clean(x)),
 structural_hubs:r.structural_hubs.slice(0,8).map(x=>({
   module:clean(x.module),direct_dependents:Number.isSafeInteger(x.direct_dependents) ? x.direct_dependents : 0
 })),
 limitations:[
   "Código público analisado somente estaticamente; comportamento não comprovado.",
   "Nenhum aplicativo externo foi executado, instalado ou reconstruído.",
   "A conformidade de licença e segurança exige revisão humana."
 ]
};
const folder="nexus-pilot/public-reports/by-run";
mkdirSync(folder,{recursive:true});
const output=join(folder,runId+".json");
writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx"});
console.log("NEXUS070_PUBLIC_RESULT_PUBLISHED="+output);
