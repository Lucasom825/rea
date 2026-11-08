import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanModuleGraph } from './module-graph.mjs';

const axiosLib=process.env.REA_SECOND_TARGET;
if(!axiosLib)throw new Error('REA_SECOND_TARGET must point to a pinned public Axios lib directory');

function fixture(modules){
  const root=mkdtempSync(join(tmpdir(),'nexus-modules-'));
  try{
    for(const [p,source] of Object.entries(modules)){
      const file=join(root,p);
      mkdirSync(join(file,'..'),{recursive:true});
      writeFileSync(file,source);
    }
    return scanModuleGraph(root);
  } finally{rmSync(root,{recursive:true,force:true});}
}
test('independent Axios snapshot includes its 72 JavaScript modules',()=>{
  const result=scanModuleGraph(axiosLib);
  assert.equal(result.status,'STATIC_IMPORTS_VERIFIED',JSON.stringify(result.unresolved.slice(0,12)));
  assert.equal(result.modules,72);
  assert.equal(result.statistics.syntax_errors,0);
  assert.equal(result.statistics.unresolved_edges,0);
  assert.ok(result.statistics.unique_internal_pairs>=75,'Expected many cross-module dependencies');
  assert.ok(result.inventory.every(x=>/^[a-f0-9]{64}$/.test(x.sha256)));
});
test('known Axios imports are verified from their actual source positions',()=>{
  const graph=scanModuleGraph(axiosLib);
  const edges=graph.edges.filter(x=>x.kind==='internal');
  const expected=[
    ['axios.js','core/Axios.js'],
    ['axios.js','adapters/adapters.js'],
    ['core/Axios.js','core/InterceptorManager.js'],
    ['core/Axios.js','core/dispatchRequest.js'],
    ['core/dispatchRequest.js','adapters/adapters.js'],
    ['adapters/adapters.js','adapters/http.js'],
    ['adapters/adapters.js','adapters/xhr.js'],
    ['adapters/adapters.js','adapters/fetch.js'],
    ['defaults/index.js','platform/index.js'],
  ];
  for(const [from,to] of expected){
    assert.ok(edges.some(e=>e.from===from&&e.target===to&&e.line>0),
      'Missing verified source edge '+from+' -> '+to);
  }
});
test('unresolved local import triggers explicit INCONCLUSIVE',()=>{
  const result=fixture({'entry.js':"import x from './missing.js'; console.log(x);"});
  assert.equal(result.status,'INCONCLUSIVE');
  assert.equal(result.statistics.unresolved_edges,1);
});
test('broken JavaScript syntax is not silently accepted',()=>{
  const result=fixture({'entry.js':'export function broken( {'});
  assert.equal(result.status,'INCONCLUSIVE');
  assert.ok(result.statistics.syntax_errors>0);
});
test('literal dynamic import is tracked, non-literal remains unknown',()=>{
  const result=fixture({
    'entry.js':"import('./helper.js'); const path = './other.js'; import(path);",
    'helper.js':"export const value=1;",
  });
  assert.equal(result.status,'STATIC_IMPORTS_VERIFIED');
  assert.ok(result.edges.some(e=>e.syntax==='import_dynamic_literal'&&e.target==='helper.js'));
  assert.equal(result.statistics.unknown_dynamic_imports,1);
});
test('external npm dependency does not count as a missing local file',()=>{
  const result=fixture({'entry.js':"import foo from 'example-dependency'; export default foo;"});
  assert.equal(result.status,'STATIC_IMPORTS_VERIFIED');
  assert.equal(result.statistics.external_edges,1);
  assert.equal(result.statistics.unresolved_edges,0);
});
test('internal cycle is observable without claiming execution',()=>{
  const result=fixture({
    'a.js':"import {b} from './b.js'; export const a=b+1;",
    'b.js':"import {a} from './a.js'; export const b=a+1;",
  });
  assert.equal(result.status,'STATIC_IMPORTS_VERIFIED');
  assert.equal(result.statistics.unique_internal_pairs,2);
  assert.equal(result.scope.includes('runtime'),true);
});
test('missing source directory is fail-closed',()=>{
  const result=scanModuleGraph('/unlikely-nexus-nonexistent-directory-20261108');
  assert.equal(result.status,'INCONCLUSIVE');
});
