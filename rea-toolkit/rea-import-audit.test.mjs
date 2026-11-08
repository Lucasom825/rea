import test from 'node:test';
import assert from 'node:assert/strict';
import { auditReaImports } from './rea-import-audit.mjs';
const ast={modules:2,inventory:[{file:'a.js'},{file:'b.js'}],edges:[
  {from:'a.js',line:1,specifier:'./b.js'},
  {from:'a.js',line:2,specifier:'some-pkg'},
]};
function e(from,line,specifier,mode='import'){
  return {relation:'imports',properties:{specifier,resolution_mode:mode},evidence:{location:{value:{source:'lib/'+from,start:{line}}}}};
}
function run(edges,astGraph=ast){
  return auditReaImports(astGraph,{normalized_result:{graph:{edges}}});
}
test('two ground-truth import sites are matched',()=>{
  const s=run([e('a.js',1,'./b.js'),e('a.js',2,'some-pkg')]);
  assert.equal(s.status,'AST_SITE_COVERAGE_VERIFIED_WITH_UNCERTAIN_REA_EXTRAS');
  assert.equal(s.rea_exact_ast_site_matches,2);
  assert.equal(s.rea_additional_sites,0);
});
test('duplicate REA symbol edges do not inflate unique sites',()=>{
  const s=run([e('a.js',1,'./b.js'),e('a.js',1,'./b.js'),e('a.js',2,'some-pkg')]);
  assert.equal(s.rea_import_records,3);
  assert.equal(s.rea_unique_import_sites,2);
  assert.equal(s.rea_exact_ast_site_matches,2);
});
test('REA import candidate without explicit specifier remains unverified',()=>{
  const s=run([e('a.js',1,'./b.js'),e('a.js',2,'some-pkg'),e('a.js',9,null,'require')]);
  assert.equal(s.additional_without_explicit_specifier,1);
  assert.equal(s.does_not_measure_semantic_accuracy,true);
});
test('same specifier on another source line does not count as another validated import',()=>{
  const s=run([e('a.js',1,'./b.js'),e('a.js',2,'some-pkg'),e('a.js',5,'./b.js')]);
  assert.equal(s.additional_same_module_specifier_other_line,1);
  assert.equal(s.rea_exact_ast_site_matches,2);
});
test('unseen explicit dependency triggers investigation',()=>{
  const s=run([e('a.js',1,'./b.js'),e('a.js',2,'some-pkg'),e('a.js',18,'./unknown.js')]);
  assert.equal(s.status,'INCONCLUSIVE_REA_AST_DISAGREEMENT');
  assert.equal(s.additional_unmatched_explicit_specifier,1);
});
test('source import missing from REA is INCONCLUSIVE',()=>{
  const s=run([e('a.js',1,'./b.js')]);
  assert.equal(s.ast_sites_absent_from_rea,1);
  assert.equal(s.status,'INCONCLUSIVE_REA_AST_DISAGREEMENT');
});
test('module identity is required to match a site',()=>{
  const s=run([e('b.js',1,'./b.js'),e('a.js',2,'some-pkg')]);
  assert.equal(s.ast_sites_absent_from_rea,1);
  assert.equal(s.status,'INCONCLUSIVE_REA_AST_DISAGREEMENT');
});

test('custom scope paths normalize from REA to nested source module identity',()=>{
  const inventory={modules:2,inventory:[{file:'nested/a.js'},{file:'b.js'}],edges:[
    {from:'nested/a.js',line:3,specifier:'../b.js'},
  ]};
  const evidence={normalized_result:{graph:{edges:[{
    relation:'imports',
    evidence:{location:{value:{source:'examples/sample/src/nested/a.js',start:{line:3}}}},
    properties:{specifier:'../b.js'},
  }]}}};
  const r=auditReaImports(inventory,evidence);
  assert.equal(r.rea_exact_ast_site_matches,1);
  assert.equal(r.status,'AST_SITE_COVERAGE_VERIFIED_WITH_UNCERTAIN_REA_EXTRAS');
});
