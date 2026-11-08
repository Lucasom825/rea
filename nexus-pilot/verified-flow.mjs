/**
 * NEXUS source verifier for a documented JavaScript MVC event-to-storage case.
 * Static-only TypeScript AST, independent of LLM output and REA graph. No target execution.
 * Unknown patterns MUST fail closed, not be interpreted as absent/unreachable.
 * This is a narrow TodoMVC-style benchmark, not a general JS proof engine.
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const visit=(node,cb)=>{cb(node);ts.forEachChild(node,c=>visit(c,cb));};
const ident=node=>node && ts.isIdentifier(node)?node.text:null;
const prop=node=>ts.isPropertyAccessExpression(node)?node.name.text:null;
const isThisField=node=>ts.isPropertyAccessExpression(node)&&node.expression.kind===ts.SyntaxKind.ThisKeyword;
const lit=node=>node&&ts.isStringLiteralLike(node)?node.text:null;
export function verifyEventFlow(root,eventName='newTodo'){
  const files=readdirSync(join(root,'src')).filter(f=>f.endsWith('.js'));
  const classes=new Map(),constructors=new Map(),appProps=new Map(),appFactories=new Map();
  const loc=(node,sf)=>{
    const p=sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return {file:sf.fileName.split('/').at(-1),line:p.line+1};
  };
  for(const file of files){
    const code=readFileSync(join(root,'src',file),'utf8');
    const sf=ts.createSourceFile(join(root,'src',file),code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
    if(sf.parseDiagnostics.length)return{status:'INCONCLUSIVE',reason:'PARSE_ERROR',file};
    visit(sf,node=>{
      if(ts.isClassDeclaration(node)&&node.name){
        const className=node.name.text,members=new Map();
        for(const m of node.members){
          if(ts.isMethodDeclaration(m))members.set(m.name.getText(sf),{node:m,sf,className});
          if(ts.isConstructorDeclaration(m))constructors.set(className,{node:m,sf});
        }
        classes.set(className,members);
      }
      if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&isThisField(node.left)&&ts.isNewExpression(node.right)){
        const name=ident(node.right.expression);
        if(name){appProps.set(prop(node.left),name);appFactories.set(name,node.right.arguments??[]);}
      }
    });
  }
  // Locate a unique constructor callback registration for the specified event.
  const registrations=[];
  for(const [className,c] of constructors){
    visit(c.node,node=>{
      if(!ts.isCallExpression(node)||prop(node.expression)!=='bindCallback')return;
      if(lit(node.arguments[0])!==eventName||!node.arguments[1])return;
      const targets=[];
      visit(node.arguments[1],sub=>{
        if(ts.isCallExpression(sub)&&isThisField(sub.expression)){
          targets.push({name:prop(sub.expression),ref:loc(sub,c.sf)});
        }
      });
      if(targets.length)registrations.push({controllerClass:className,targets,registration:loc(node,c.sf)});
    });
  }
  const bindingOwners=[...classes].filter(([,methods])=>methods.has('bindCallback'));
  if(registrations.length!==1||bindingOwners.length!==1){
    return{status:'INCONCLUSIVE',reason:'AMBIGUOUS_EVENT_BINDING',registrations:registrations.length,bindingOwners:bindingOwners.length};
  }
  const bindingOwner=bindingOwners[0][0],binding=bindingOwners[0][1].get('bindCallback');
  let listener=null;
  visit(binding.node,node=>{
    if(!ts.isCaseClause(node)||lit(node.expression)!==eventName)return;
    visit(node,sub=>{
      if(!ts.isCallExpression(sub))return;
      const bindingKind=ident(sub.expression);
      const domEventPosition=bindingKind==='$on'?1:bindingKind==='$delegate'?2:-1;
      if(domEventPosition<0||!lit(sub.arguments[domEventPosition]))return;
      let handlerUsed=false;
      visit(sub,other=>{if(ts.isCallExpression(other)&&ident(other.expression)==='handler')handlerUsed=true;});
      if(handlerUsed)listener=loc(sub,binding.sf);
    });
  });
  if(!listener)return{status:'INCONCLUSIVE',reason:'EVENT_LISTENER_UNCONFIRMED'};
  const reg=registrations[0];
  if(reg.targets.length!==1)return{status:'INCONCLUSIVE',reason:'MULTIPLE_EVENT_TARGETS'};
  const methodName=reg.targets[0].name,ctl=classes.get(reg.controllerClass)?.get(methodName);
  if(!ctl)return{status:'INCONCLUSIVE',reason:'CONTROLLER_HANDLER_UNRESOLVED'};
  // Confirm constructor parameter -> factory field wiring, rather than guessing from names.
  const classForProperty=(ownerClass,field)=>{
    const c=constructors.get(ownerClass);
    if(!c)return null;
    const params=c.node.parameters.map(p=>ident(p.name));
    let param=null;
    visit(c.node,node=>{
      if(!ts.isBinaryExpression(node)||node.operatorToken.kind!==ts.SyntaxKind.EqualsToken)return;
      if(isThisField(node.left)&&prop(node.left)===field&&ts.isIdentifier(node.right))param=node.right.text;
    });
    const index=params.indexOf(param),args=appFactories.get(ownerClass);
    const referenced=args?.[index];
    if(index<0||!referenced||!isThisField(referenced))return null;
    return appProps.get(prop(referenced))??null;
  };
  const connectedCalls=method=>{
    const calls=[];
    visit(method.node,node=>{
      if(!ts.isCallExpression(node))return;
      const call=node.expression;
      if(!ts.isPropertyAccessExpression(call)||!isThisField(call.expression))return;
      const targetClass=classForProperty(method.className,prop(call.expression));
      if(targetClass&&classes.get(targetClass)?.has(prop(call))){
        calls.push({className:targetClass,method:prop(call),ref:loc(node,method.sf)});
      }
    });
    return calls;
  };
  const paths=[];
  function search(method,path,visited,depth){
    if(depth>5)return;
    const key=method.className+'.'+method.node.name?.getText(method.sf);
    if(visited.has(key))return;
    const seen=new Set(visited);seen.add(key);
    let usedStorage=false,mutatedList=false,wroteStorage=false;
    visit(method.node,node=>{
      if(ts.isIdentifier(node)&&node.text==='memoryStorage')usedStorage=true;
      if(ts.isCallExpression(node)&&['push','splice','unshift'].includes(prop(node.expression)))mutatedList=true;
      if(ts.isBinaryExpression(node)&&node.operatorToken.kind===ts.SyntaxKind.EqualsToken&&node.left.getText(method.sf).includes('memoryStorage['))wroteStorage=true;
    });
    if(path.length>1&&usedStorage&&mutatedList&&wroteStorage){paths.push(path);return;}
    for(const edge of connectedCalls(method)){
      const next=classes.get(edge.className)?.get(edge.method);
      if(next)search(next,[...path,{...edge,methodNode:next}],seen,depth+1);
    }
  }
  search(ctl,[],new Set(),0);
  if(paths.length!==1||paths[0].length!==2){
    return{status:'INCONCLUSIVE',reason:'UNRESOLVED_OR_AMBIGUOUS_STORAGE_PATH',paths:paths.length};
  }
  const [step2,step3]=paths[0];
  const def=method=>loc(method.node,method.sf);
  return{
    status:'VERIFIED_STATIC_CHAIN',event:eventName,
    steps:[
      {className:bindingOwner,method:'bindCallback',...def(binding),phase:'listener_setup',listener_site:listener},
      {className:reg.controllerClass,method:methodName,...def(ctl),phase:'event_handler',registered_at:reg.registration},
      {className:step2.className,method:step2.method,...def(step2.methodNode),phase:'model_operation',called_at:step2.ref},
      {className:step3.className,method:step3.method,...def(step3.methodNode),phase:'storage_mutation',called_at:step3.ref}
    ],
    conditions:{listener_registration:true,constructor_wiring:true,controller_call:true,model_call:true,store_memory_mutation:true},
    limits:['Static links only; no runtime execution observed','Listener setup precedes the event; it is not called anew for every task']
  };
}
export function validatedExplanation(flow){
  if(flow.status!=='VERIFIED_STATIC_CHAIN'){
    return{status:'INCONCLUSIVE',message:'Cadeia nao confirmada estaticamente: '+flow.reason};
  }
  const [setup,ctl,mdl,store]=flow.steps;
  return{
    status:'VERIFIED_FROM_SOURCE_NOT_LLM',
    text:'Na estrutura analisada, '+setup.className+'.'+setup.method+
      ' registra o evento '+flow.event+'; quando ele ocorre, '+
      ctl.className+'.'+ctl.method+' chama '+mdl.className+'.'+mdl.method+
      ', que chama '+store.className+'.'+store.method+
      ' para atualizar o armazenamento em memoria. Trata-se de encadeamento estatico, nao de uma execucao observada.',
    sources:flow.steps.map(x=>x.file+':'+x.line)
  };
}
