/**
 * Strict delivery boundary: the tiny local LLM is an optional formatter of
 * externally checked source facts, never an authority on arbitrary code.
 * A correct first line does NOT excuse invented prose or snippets afterward.
 */
export function validateConstrainedModelAnswer(answer,steps){
  const expected=steps.map(s=>s.className+'.'+s.method).join(' -> ');
  const lines=String(answer??'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const exactChain=lines.length>=1&&lines[0]===expected;
  const exactLimitation=lines.length>=2&&
    /^Análise estática não comprova execução real\.$/iu.test(lines[1]);
  const noAdditionalText=lines.length===2;
  const clean=exactChain&&exactLimitation&&noAdditionalText;
  return{
    pass:clean,
    reasons:[
      ...(!exactChain?['CHAIN_NOT_EXACT']:[]),
      ...(!exactLimitation?['STATIC_LIMITATION_MISSING_OR_MODIFIED']:[]),
      ...(!noAdditionalText?['EXTRA_UNVERIFIED_TEXT']:[]),
    ],
    expected_chain:expected,
    observed_lines:lines.length,
    exact_chain:exactChain,
    exact_limitation:exactLimitation,
    no_additional_text:noAdditionalText,
  };
}
