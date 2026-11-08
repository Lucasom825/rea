# REA + NEXUS — Piloto 003: cliente MCP e evidências retidas

Data: 08/11/2026. Estado: **CONEXÃO MCP E ANÁLISE ESTÁTICA CONFIRMADAS; IA AUTÔNOMA NÃO CONECTADA**.

## Objetivo e isolamento

Validar um cliente MCP stdio real contra `rea-agents@6.8.0` em Node 24.22.1,
sem instalar a REA em sistemas produtivos. Alvo público e permitido:
[tastejs/todomvc, JavaScript ES6](https://github.com/tastejs/todomvc/tree/ff43b02e59dfa604386bb382034b2cd07c2bcd8a/examples/javascript-es6).
Onze arquivos selecionados foram obtidos por commit fixo e tiveram SHA de blob conferido.
O aplicativo analisado NÃO foi executado.

Implementação no fork: `nexus-pilot/mcp-probe.mjs` e
`.github/workflows/nexus-rea-mcp-pilot.yml`, somente na branch
`nexus/rea-pilot-001-20261108`; branch principal e código original da REA intactos.

## Resultado observado: conexão MCP sem modelo de IA

Execução inicial **SUCCESS**:
https://github.com/Lucasom825/rea/actions/runs/42505202545

- `initialize` real via JSON-RPC em stdio; servidor `rea` versão `6.8.0`.
- Versão de protocolo MCP negociada: `2025-06-18`.
- `tools/list`: **229 ferramentas anunciadas** no catálogo completo.
- `prompts/list`: **6 prompts guiados**; `prompts/get` retornou instruções de `investigate_feature`.
- `tools/call:analyze_javascript_application` executado no TodoMVC real, em `detail: summary`.
- Análise gerou Evidence ID `ev_16e56d1966e67b295ee34f804e3b80f39eca790bbb275c25fb50b00e50fed7d3`,
  vinculada ao parent retido `ev_f1eb60cae9d10b47fa797b393cd9977b56d30d55e7220a26b49c6262d5daeec5`.
- `tools/call:inspect_analysis_view` conseguiu consultar novamente o parent retido
  em **uma sessão MCP**; retornou as referências dos sete módulos JS esperados:
  `app.js`, `controller.js`, `helpers.js`, `model.js`, `store.js`,
  `template.js`, `view.js`.
- Consulta reportou 45 registros examinados de 45 disponíveis naquela visão,
  e **17 limitações** na Evidence. Isso NÃO comprova entendimento integral
  de comportamento, chamadas dinâmicas ou regras de negócio.
- Duração observada do cliente MCP até a resposta: **12.518 ms**,
  incluindo inicialização e resolução do pacote, não apenas processamento.

Artefato original disponível no próprio run por retenção limitada de 3 dias.
A resposta textual do piloto foi **determinística a partir dos dados da REA**,
não gerada por LLM. Portanto, não declarar integração de agente ChatGPT/Codex
ou autonomia NEXUS.

## Experimento adicional: restringir ferramentas

Execução: https://github.com/Lucasom825/rea/actions/runs/42505409422

Mesmo cliente executado duas vezes, uma sem restrição e outra solicitando
`REA_MCP_TOOL_FAMILIES=application,session`.

| Medida | Completo | Escopo solicitado |
| --- | ---: | ---: |
| `tools/list` | 229 | 229 |
| Análise e consulta Evidence | sucesso | sucesso |
| Módulos obtidos | 7/7 | 7/7 |

**A asserção de redução falhou, corretamente.** A execução global do workflow
ficou FAILURE no comparador, embora cada teste individual de protocolo/análise
tenha reportado SUCCESS. O filtro solicitado não reduziu o catálogo anunciado.
A causa ainda NÃO foi isolada: é necessário verificar propagação da variável
para o executável publicado, configuração efetiva e divergência entre versão
do pacote e documentação/código-fonte. Não atribuir redução de tokens ou custo.

## Critérios para a próxima prova

1. Resolver ou contornar comprovadamente a questão do catálogo de ferramentas.
2. Integrar REA a **um agente de IA real e autorizado** em ambiente segregado.
3. Dar uma pergunta técnica que dependa de relações do TodoMVC, não apenas
   nomes de módulos: por exemplo, o caminho `View → Controller → Model → Store`.
4. Confrontar cada alegação do agente com os arquivos do TodoMVC e Evidence da REA,
   quantificando acerto, extrapolação, desconhecidos e tempo/custo.
5. Só propor conexão permanente ao NEXUS se a prova mostrar vantagem material.
   Nenhum acesso a Memora, Fraja, Supply Live, chaves ou dados particulares nesta fase.

**Sem merge, sem deploy, sem cópia de dados privados e sem alegação de economia financeira.**
Fonte canônica de execução: GitHub Actions e artefatos JSON dos dois runs acima.


## Diagnóstico confirmado do filtro (continuação do piloto)

A origem do desacordo com a documentação foi identificada comparando a versão
**publicada** e o código **mais recente**:

- Release oficial [rea-agents-6.8.0](https://github.com/morluto/rea/releases/tag/rea-agents-6.8.0),
  publicado em 25/10/2026.
- No tag `rea-agents-6.8.0`, `src/config/mcpToolFamilies.ts` não existe e
  `src/server/createServer.ts` não contém o parser da variável
  `REA_MCP_TOOL_FAMILIES`.
- Na branch `main` atual do fork, essa configuração já existe no código,
  ainda com versão declarada do pacote `6.8.0`. Versão do código-fonte
  não prova que um recurso esteja disponível no artefato publicado.
- Conclusão: a versão publicada e executada **6.8.0 não implementa o filtro**;
  por isso o teste restrito não diminuiu as 229 ferramentas. Não se trata de
  ganho de performance comprovado nem de proteção obtida no servidor.

## Contorno verificado: allowlist no nosso cliente

GitHub Actions **SUCCESS**:
https://github.com/Lucasom825/rea/actions/runs/42505900001

O cliente `nexus-pilot/mcp-probe.mjs` foi atualizado para aceitar somente
`analyze_javascript_application` e `inspect_analysis_view` em operações
`tools/call`. Uma tentativa de invocar `open_binary` foi recusada **antes de
enviar o pedido ao servidor**. A validação conferiu no JSON original:

- Servidor ainda anuncia **229** ferramentas.
- Cliente seleciona explicitamente **2** ferramentas; chamada não autorizada bloqueada.
- Análise e consulta retida continuam com **7/7** módulos do TodoMVC.
- Teste do cliente: **8.915 ms**, incluindo inicialização e download/resolução
  por npm. Sem inferência de ganho de velocidade, custo ou redução de tokens.
- **Não é um controle de autorização do servidor MCP**: outro cliente conectado
  ainda pode acessar o catálogo completo. O guard protege apenas as chamadas
  originadas pelo cliente de teste.

Ainda não existe conexão MCP direta com um modelo de IA do NEXUS, nem teste
com prompts interpretados por um LLM. A próxima etapa permanece a integração
controlada a um modelo de IA autorizado, com comparação do raciocínio e das
citações de Evidence contra o código real.
