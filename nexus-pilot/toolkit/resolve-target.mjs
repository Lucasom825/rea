/**
 * REA Toolkit: bounded source-only analysis input validation.
 * Custom targets MUST be public GitHub repositories pinned by a full SHA.
 */
const catalog=Object.freeze({
  axios:{repository:'axios/axios',commit:'a81d62a22e4b291a05d5b087a89fcc9d16075e83',scope:'lib',label:'Axios JavaScript 72 modules',behavior_demo:'axios'},
  todomvc:{repository:'tastejs/todomvc',commit:'ff43b02e59dfa604386bb382034b2cd07c2bcd8a',scope:'examples/javascript-es6/src',label:'TodoMVC JavaScript ES6',behavior_demo:'none'},
});
function fail(message){throw new Error('INVALID_INPUT: '+message);}
export function resolveTarget({preset='axios',repository='',commit='',scope=''}={}){
  if(!['axios','todomvc','public'].includes(preset))fail('preset must be axios, todomvc or public');
  const selected=preset==='public'
    ?{repository:String(repository),commit:String(commit),scope:String(scope),label:'External public GitHub repository',behavior_demo:'none'}
    :catalog[preset];
  const {repository:repo,commit:sha,scope:subdir}=selected;
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,98}\/[A-Za-z0-9][A-Za-z0-9._-]{0,98}$/.test(repo) ||
     repo.split('/').some(x=>x==='.'||x==='..'||x.endsWith('.git')))fail('invalid owner/repo');
  if(!/^[a-fA-F0-9]{40}$/.test(sha))fail('commit must be a full 40-character SHA-1');
  if(typeof subdir!=='string'||subdir.length>180||!subdir||
     subdir.startsWith('/')||subdir.includes('\\')||
     !/^[A-Za-z0-9_./-]+$/.test(subdir)||
     subdir.split('/').some(x=>x===''||x==='..'))fail('invalid relative JavaScript directory');
  return{
    preset,repository:repo,commit:sha.toLowerCase(),scope:subdir,
    label:selected.label,behavior_demo:selected.behavior_demo,
    read_only:true,source_execution_allowed:preset==='axios',
    private_repository_allowed:false,
    limits:{max_repository_size_kb:250000,max_js_files:300,max_js_bytes:15000000,max_evidence_bytes:90000000},
  };
}
if(process.argv[1]&&process.argv[1].endsWith('/resolve-target.mjs')){
  const [preset,repo,sha,scope]=process.argv.slice(2);
  const result=resolveTarget({preset:preset||'axios',repository:repo||'',commit:sha||'',scope:scope||''});
  console.log(JSON.stringify(result,null,2));
}
