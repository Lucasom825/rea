# NEXUS + REA — Piloto 005: resposta verificada com bloqueio de alucinações

**Data:** 08/11/2026  
**Estado final:** **PASS no piloto de entrega verificada; modelo Qwen pequeno REPROVADO para resposta livre; NEXUS em produção NÃO integrado.**

## Por que corrigimos

O piloto 004 comprovou que o modelo de 1,5B podia selecionar a ferramenta MCP certa e ainda errar a cadeia causal. No primeiro teste deste piloto 005, o modelo acertou a primeira linha, mas acrescentou exemplos de código que **não existem** no repositório TodoMVC. O CI antigo aceitou essa resposta porque validava só o encadeamento inicial. A auditoria manual do JSON detectou o erro: não deve ser tratado como sucesso do modelo.

Execução inicial, que revelou lacuna no validador: https://github.com/Lucasom825/rea/actions/runs/42510226371 .

## Correção executada no fork, sem alterar a REA original

Criamos um controle em três camadas, na branch `nexus/rea-pilot-001-20261108` do repositório `Lucasom825/rea`:

1. **REA 6.8.0 via MCP** faz análise estática do TodoMVC real e retém Evidence; a chamada `inspect_analysis_view` recupera 7/7 módulos. O cliente permite só `analyze_javascript_application` e `inspect_analysis_view`.
2. **Verificador independente de AST** (`nexus-pilot/verified-flow.mjs`, TypeScript 5.9.3) lê os arquivos originais pinados, sem executar código-alvo, confirma registro do evento, injeção dos objetos nos construtores, caminhos de chamadas e escrita em `memoryStorage`, registrando linhas do código. Se algum elo não puder ser confirmado ou houver ambiguidade, retorna **INCONCLUSIVE**, não inventa uma ligação.
3. **Política de resposta rigorosa** (`nexus-pilot/answer-policy.mjs`) só aceita do LLM exatamente a cadeia qualificada e a frase de limite da análise estática, sem qualquer outro texto. Se houver código inventado, texto extra, ordem errada ou falta de ressalva, a saída do LLM é rejeitada. A resposta entregue vem exclusivamente do verificador de AST e é rotulada como `AST_STATIC_VERIFIER_FALLBACK`, nunca atribuída ao modelo.

Isso **não transforma o modelo pequeno num analista confiável**. Transforma um pipeline de demonstração em um mecanismo que consegue entregar apenas a conclusão estática verificada, mesmo quando a IA erra.

## Teste reproduzível aprovado

**GitHub Actions:** https://github.com/Lucasom825/rea/actions/runs/42510544617 — `success` em todas as etapas, com código original da fonte MIT TodoMVC (commit `ff43b02e59dfa604386bb382034b2cd07c2bcd8a`), onze blobs com SHA conferido.

- **5/5 testes de AST passaram**: cadeia original; mudança de chamada Model→Store rejeitada; nome do método alterado identificado; alteração de evento na View rejeitada; troca da fiação dos construtores rejeitada.
- **5/5 testes contra alucinação passaram**: formato estrito correto aceito; código inventado após linha correta rejeitado; ordem errada rejeitada; ressalva ausente rejeitada; alegação de execução indevida rejeitada.
- REA/MCP real: **7/7** módulos detectados; `inspect_analysis_view` chamado com Evidence retida.
- Verificador de AST: `VERIFIED_STATIC_CHAIN`.
- Modelo real Qwen2.5-1.5B-Instruct (q4/CPU): escolheu corretamente a consulta MCP por `(B)`, **mas resposta livre reprovada** por acrescentar trechos inventados; razões `STATIC_LIMITATION_MISSING_OR_MODIFIED` e `EXTRA_UNVERIFIED_TEXT`.
- Status final: `PASS_VERIFIED_DELIVERY_LLM_REJECTED_FALLBACK`, resposta entregue pelo verificador; duração total observada no cliente: **82.410 ms** (não é tempo exclusivo de REA ou modelo).
- Artefato JSON original disponível no run (retenção limitada); cópia ZIP enviada ao chat: `REA_NEXUS_piloto_005_final_evidence.zip`.

### Conteúdo de referência e fontes de verdade

`View.bindCallback` (view.js:138) configura o listener `newTodo` (listener em view.js:141). O handler `Controller.addItem` está em controller.js:56, com registro do callback no construtor em controller.js:11; ele chama `Model.create` (model.js:17; chamada em controller.js:60), que chama `Store.save` (store.js:83; chamada em model.js:25). O armazenamento é em memória; não é um banco de dados SQL. **Listener é configurado na inicialização; não é chamado novamente a cada criação da tarefa.** A análise estática não comprova execução em runtime.

Fonte primária: https://github.com/tastejs/todomvc/tree/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/javascript-es6/src

## Limitações honestas e próximas provas

- O verificador atual é **especializado no padrão MVC/evento de criação TodoMVC** e em uma escrita de memória reconhecível. Não serve como prova geral de qualquer framework, fluxo assíncrono, banco de dados ou aplicativo desconhecido. Não validar outro projeto com este mesmo algoritmo sem adaptar e testar.
- A versão publicada REA 6.8.0 anuncia 229 ferramentas; o cliente aplica allowlist de duas. Isso NÃO configura autorização no servidor.
- A resposta é baseada em AST, e os arquivos são públicos. Não há integração permanente com agente ChatGPT, Memora, Supply Live, Fraja ou NEXUS produtivo.
- Nenhum código foi incorporado à branch `main`; não houve deploy, contratação, API paga, uso de dados privados ou alteração contratual.
- Próxima prova útil: generalizar extração para **mais dois fluxos independentes** (remoção e conclusão de tarefas, por exemplo), com situações negativas e versão de modelo mais competente. Testar somente depois uma integração permanente por ambiente e credenciais autorizadas.

**Veredito executivo:** a operação segura de análise do caso de demonstração está validada; a confiabilidade do modelo em livre geração continua insuficiente, mas agora **não compromete o resultado entregue**.


## Complemento 005-B — mais dois fluxos independentes (08/11/2026)

Após a aprovação do fluxo de criação, o verificador foi ampliado para os registros de evento DOM implementados com `$delegate`, e para remoção de itens em armazenamento, além da criação original com `$on`. O objetivo foi verificar alguma generalização dentro do **mesmo aplicativo público**, sem afirmar suporte universal a JavaScript.

**CI final aprovado:** https://github.com/Lucasom825/rea/actions/runs/42511257954 — `success` em todas as etapas.

Agora os testes verificam **13 cenários**: oito testes independentes de verificação estrutural e mutações + cinco testes contra alucinações. Os três fluxos estáticos identificados são:

| Evento do TodoMVC | Cadeia de referência derivada do AST |
| --- | --- |
| `newTodo` | `View.bindCallback → Controller.addItem → Model.create → Store.save` |
| `itemRemove` | `View.bindCallback → Controller.removeItem → Model.remove → Store.remove` |
| `itemToggle` | `View.bindCallback → Controller.toggleComplete → Model.update → Store.save` |

Além dos testes negativos anteriores, foi testada a remoção de `todos.splice` na implementação de exclusão; o verificador recusou confirmar a cadeia quando a mutação não podia ser provada.

**Diferença entre componentes:** o verificador AST passou nos três fluxos; o modelo Qwen foi executado somente com a pergunta `newTodo`, selecionou a ferramenta MCP correta e obteve 7/7 módulos, mas **sua resposta livre continuou reprovada** devido a trechos adicionais não sustentados. O resultado entregue foi o fallback AST com referências, `PASS_VERIFIED_DELIVERY_LLM_REJECTED_FALLBACK`, duração total do cliente 84.349 ms. Isso reforça o valor do controle de qualidade, NÃO comprova melhora do raciocínio do modelo.

Os resultados permanecem limitados ao padrão implementado pelo TodoMVC. A lógica ainda não foi ensaiada com frameworks/bancos/serviços diferentes, nem foi integrada ao NEXUS produtivo ou à conta ChatGPT como ferramenta permanente. Versão oficial Memória Viva não foi alterada.
