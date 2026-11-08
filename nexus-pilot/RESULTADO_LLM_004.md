# NEXUS + REA — Piloto 004: modelo de IA real operando ferramenta MCP

**Data:** 08/11/2026  
**Veredito:** **MCP + modelo local operacionais; qualidade de explicação de código REPROVADA.**
Não implantar como agente autônomo do NEXUS neste estado.

## Escopo e controles

- Ferramenta: release oficial `rea-agents@6.8.0` servida por MCP stdio JSON-RPC.
- Cliente: `nexus-pilot/local-llm-agent.mjs`; allowlist efetiva no cliente de apenas `analyze_javascript_application` e `inspect_analysis_view`, que bloqueia outras operações.
- Inferência: modelos locais abertos `onnx-community/Qwen2.5-0.5B-Instruct` e `onnx-community/Qwen2.5-1.5B-Instruct`, formato ONNX `q4`, CPU em runner público do GitHub Actions via `@huggingface/transformers@4.3.2`. Pesos derivados de modelos Qwen com licença Apache 2.0. **Não são o modelo ChatGPT nem um conector oficial ChatGPT.**
- Objeto de análise: [TodoMVC JavaScript ES6, commit fixo](https://github.com/tastejs/todomvc/tree/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/javascript-es6), código público MIT; 11 arquivos com integridade de blob Git conferida. Nenhum código-alvo executado, nenhum dado privado coletado, nenhuma credencial de API externa usada.
- Repositório do usuário: `Lucasom825/rea`, branch `nexus/rea-pilot-001-20261108`. Sem alterações na `main`, merge ou deploy; nenhum sistema operacional do Memora, Supply Live ou Fraja alterado.
- Github Models **não foi usado**: serviço encerrado em 30/07/2026 conforme [anúncio oficial](https://github.blog/changelog/2026-07-01-github-models-is-being-fully-retired-on-july-30-2026/).
- GitHub informa que runners padrão de repositórios públicos não descontam computação cobrada. **Faturamento real da conta não foi auditado**, não presumir saldo/compromissos.

## Evidência de cada tentativa

| Tentativa | Modelo | Resultado operacional | Critério de qualidade | Run |
| --- | --- | --- | --- | --- |
| 1 | Qwen2.5 0.5B q4 | MCP e análise retida funcionaram; modelo escolheu `analyze_javascript_application` quando a tarefa exigia `inspect_analysis_view`; cliente bloqueou a escolha inadequada. | REPROVADO: planejamento da ferramenta | [42507968751](https://github.com/Lucasom825/rea/actions/runs/42507968751) |
| 2 | Qwen2.5 1.5B q4 | Modelo escolheu `(B)`, alternativa que representava `inspect_analysis_view`. O validador rejeitou por não produzir nome exato da ferramenta. | Escolha semanticamente correta, formato incorreto (ainda sem consulta via decisão do modelo) | [42508182100](https://github.com/Lucasom825/rea/actions/runs/42508182100) |
| 3 | Qwen2.5 1.5B q4 | Validador adaptado para registrar separadamente escolha e formato: `(B)` foi mapeada a `inspect_analysis_view`, chamada MCP real realizada e referências a **7/7 módulos** recuperadas. | REPROVADO: resposta genérica, sem `bindCallback` e sequência causal correta | [42508418784](https://github.com/Lucasom825/rea/actions/runs/42508418784) |
| 4 | Qwen2.5 1.5B q4 | MCP real e consulta retida repetidos com êxito, pergunta mais estrita e trechos de código ampliados. | REPROVADO: respondeu `create->addItem->model->save / INCONCLUSIVO`; falta `bindCallback`, `model` não é método, ordem incorreta | [42508686105](https://github.com/Lucasom825/rea/actions/runs/42508686105) |

Artefatos JSON originais anexados aos runs por retenção limitada de 3 dias; pelo menos as quatro versões foram recuperadas e inspecionadas. O workflow retorna `failure` quando o modelo não supera os critérios de qualidade; isto é comportamento desejado do portão do teste, não prova de falha do servidor MCP.

## Verdade conhecida a partir do código original

A cadeia **causal** de criação de item é:

1. **Configuração, antes do evento:** construtor do `Controller` chama `View.bindCallback("newTodo", ...)`, e `View.bindCallback` registra listener `change` em `this.$newTodo`.
2. **Evento do usuário:** callback do evento chama `Controller.addItem(title)`, que valida o título e aciona `this.model.create(title, callback)`.
3. **Modelo:** `Model.create` forma o item com `title.trim()` e `completed: false`, depois chama `this.storage.save(newItem, callback)`.
4. **Armazenamento:** `Store.save` insere/atualiza o item no estado `memoryStorage` e chama o callback de atualização de interface.

Arquivos originais: `src/view.js`, `src/controller.js`, `src/model.js`, `src/store.js` dentro de [TodoMVC ES6](https://github.com/tastejs/todomvc/tree/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/javascript-es6/src).

**Precisão temporal:** `bindCallback` instala o listener durante inicialização; não é chamado novamente necessariamente a cada criação de tarefa. O fluxo de evento subsequentemente passa por `addItem → create → save`. Portanto a sequência de quatro métodos é uma representação causal (setup + execução), não quatro chamadas sequenciais disparadas a cada evento.

A REA comprovou **inventário de módulos e referências**; os trechos do código-fonte original foram fornecidos ao modelo para o teste da cadeia de funções. Não atribuir ao MCP uma prova de execução dinâmica ou interpretação semântica integral.

## Decisão técnica

**Fatos:** servidor MCP e aplicação estática funcionam; um LLM de 1.5B selecionou uma ferramenta autorizada, e o cliente realizou a operação com evidência. O LLM falhou em duas avaliações da explicação causal, incluindo pergunta restrita.

**Inferência:** este modelo não é confiável o bastante para produzir, sem conferência, decisões técnicas de engenharia, relatórios de riscos ou propostas de alteração em sistemas produtivos.

**Regra do NEXUS:** respostas que afetem código, contratos ou decisões devem ter fontes inspecionáveis, critérios de avaliação e human review; se não passar, estado `INCONCLUSIVO/REPROVADO`, nunca aceitar resposta apenas por ser fluente. O portão já mostrou que detecta erros. Não converter a explicação correta acima em saída atribuída ao modelo.

**Próxima prova recomendada:** testar um modelo mais competente, preferencialmente um agente com suporte nativo a tool calling, mantendo isolamento e controle estrito de ferramenta; comparar decisões de ferramenta, precisão da cadeia causal, latência, custos e falsas afirmações em casos que não tenham a resposta no prompt. Configurar autorização para qualquer API paga ou dados privados antes de usá-los.

**Conclusão:** REA+MCP **operacional como infraestrutura**, modelo de IA pequeno **não qualificado** para análise técnica autônoma; integração permanente ao NEXUS **não realizada**.
