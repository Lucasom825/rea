import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyEventFlow, validatedExplanation } from './verified-flow.mjs';

const sourceRoot=process.env.REA_TEST_TARGET;
if(!sourceRoot)throw new Error('REA_TEST_TARGET must point at the pinned public TodoMVC');

function mutated(edit){
  const root=mkdtempSync(join(tmpdir(),'rea-verified-mutation-'));
  cpSync(join(sourceRoot,'src'),join(root,'src'),{recursive:true});
  try {
    edit(root);
    return verifyEventFlow(root);
  } finally {
    rmSync(root,{recursive:true,force:true});
  }
}
function rewrite(root,file,oldText,newText){
  const path=join(root,'src',file),before=readFileSync(path,'utf8');
  if(!before.includes(oldText))throw new Error('Fixture assumption changed: '+file+' '+oldText);
  writeFileSync(path,before.replaceAll(oldText,newText));
}

test('pinned real TodoMVC yields a cited four-step static flow',()=>{
  const result=verifyEventFlow(sourceRoot,'newTodo');
  assert.equal(result.status,'VERIFIED_STATIC_CHAIN',JSON.stringify(result));
  assert.deepEqual(result.steps.map(s=>s.className+'.'+s.method),
    ['View.bindCallback','Controller.addItem','Model.create','Store.save']);
  assert.deepEqual(result.steps.map(s=>s.file),
    ['view.js','controller.js','model.js','store.js']);
  assert.ok(result.steps.every(s=>Number.isInteger(s.line)&&s.line>0));
  assert.equal(validatedExplanation(result).status,'VERIFIED_FROM_SOURCE_NOT_LLM');
  assert.ok(result.limits.some(t=>t.includes('Static')));
});

test('broken Model to Store link becomes INCONCLUSIVE, not an invented chain',()=>{
  const result=mutated(root=>rewrite(root,'model.js','this.storage.save(','this.storage.persist('));
  assert.equal(result.status,'INCONCLUSIVE',JSON.stringify(result));
});

test('renamed handler is discovered rather than hard-coded',()=>{
  const result=mutated(root=>rewrite(root,'controller.js','addItem','createTodo'));
  assert.equal(result.status,'VERIFIED_STATIC_CHAIN',JSON.stringify(result));
  assert.equal(result.steps[1].method,'createTodo');
});

test('changed View listener event is not silently treated as change',()=>{
  const result=mutated(root=>rewrite(root,'view.js','"change"','"input"'));
  assert.equal(result.status,'INCONCLUSIVE',JSON.stringify(result));
});

test('swapped factory constructor wiring rejects the causal path',()=>{
  const result=mutated(root=>rewrite(root,'app.js',
    'new Controller(this.model, this.view)',
    'new Controller(this.view, this.model)'));
  assert.equal(result.status,'INCONCLUSIVE',JSON.stringify(result));
});
