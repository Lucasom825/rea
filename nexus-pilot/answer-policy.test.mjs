import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConstrainedModelAnswer as check } from './answer-policy.mjs';
const steps=[
  {className:'View',method:'bindCallback'},
  {className:'Controller',method:'addItem'},
  {className:'Model',method:'create'},
  {className:'Store',method:'save'},
];
const good='View.bindCallback -> Controller.addItem -> Model.create -> Store.save\nAnálise estática não comprova execução real.';
test('accepts exactly the two verified statements',()=>{
  assert.equal(check(good,steps).pass,true);
});
test('rejects fabricated source text after a correct first line',()=>{
  const forged=good+'\n\napp.js:\nthis.controller.addItem("fake");';
  const r=check(forged,steps);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('EXTRA_UNVERIFIED_TEXT'));
});
test('rejects wrong method order',()=>{
  const r=check(good.replace('Controller.addItem -> Model.create','Model.create -> Controller.addItem'),steps);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('CHAIN_NOT_EXACT'));
});
test('rejects missing static-vs-runtime limitation',()=>{
  const r=check('View.bindCallback -> Controller.addItem -> Model.create -> Store.save',steps);
  assert.equal(r.pass,false);
  assert.ok(r.reasons.includes('STATIC_LIMITATION_MISSING_OR_MODIFIED'));
});
test('rejects unsolicited confident runtime behavior claim',()=>{
  const r=check(good+'\nO programa executou este fluxo em produção.',steps);
  assert.equal(r.pass,false);
});
