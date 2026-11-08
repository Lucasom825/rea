# NEXUS + REA — Piloto 006: aplicação independente Axios (72 módulos)

**Data:** 08/11/2026  
**Veredito:** análise estrutural da REA 6.8.0 confirmada em um **segundo projeto independente**, com comparação automatizada. **Sem comprovação de interpretação completa do comportamento, autonomia do LLM ou implantação NEXUS.**

## Referência auditada

- Projeto original: [axios/axios](https://github.com/axios/axios), licença MIT.
- Revisão pública congelada: [a81d62a22e4b291a05d5b087a89fcc9d16075e83](https://github.com/axios/axios/tree/a81d62a22e4b291a05d5b087a89fcc9d16075e83).
- Escopo: diretório `lib/`, com 72 arquivos JavaScript, obtidos por checkout do commit exato. Hash Git do checkout e licença verificados antes de ler código. Nenhum código-alvo executado.
- Fork do usuário: `Lucasom825/rea`, branch experimental `nexus/rea-pilot-006-axios-20261108`. Não modificar a branch `main` da REA, projetos comerciais ou contas de terceiros.
- CI final [GitHub Actions 42513988250](https://github.com/Lucasom825/rea/actions/runs/42513988250): **SUCCESS**.
- Execução [42513646705](https://github.com/Lucasom825/rea/actions/runs/42513646705) preservou Evidence completa antes da inclusão do comparador automatizado.
- Código do verificador: `nexus-pilot/module-graph.mjs`, `nexus-pilot/rea-import-audit.mjs` e seus testes, no próprio fork.

## Resultados observados e sua interpretação

| Métrica | Valor verificado | Interpretação válida |
| --- | ---: | --- |
| Arquivos JS do Axios | 72 | Inventário `lib/` |
| Arquivos JS processados pela REA | 72/72 | Cobertura de análise estática |
| Falhas de parse da REA | 0 | Sem erro sintático detectado |
| Dependências internas distintas conforme AST | 177 | Pares `arquivo origem → arquivo destino` resolvidos |
| Importações externas identificadas conforme AST | 22 | Referências de pacotes externas, não inspecionadas |
| Locais de importação distintos conforme AST | 199 | 177 locais internos + 22 externos |
| Locais AST reconciliados com REA | 199/199 | Cobertura exata por `arquivo + linha + specifier` |
| Registros `imports` no grafo REA | 439 | **Não** são 439 importações distintas |
| Locais únicos REA após deduplicação | 240 | Inclui casos sem specifier explícito |
| Locais REA adicionais à AST | 41 | 34 sem specifier + 7 com mesmo specifier em outra linha |
| Dependências explicitamente nomeadas na REA sem origem identificada na AST | 0 | Na comparação de site/specifier; não é prova de precisão absoluta |
| Nós no grafo da aplicação REA | 318 | Estrutura observada |
| Relações no grafo da aplicação REA | 682 | Diversos tipos, não apenas importações |
| Nós semânticos REA | 21.987 | Cobertura ampla de entidades do parser |
| Achados classificados como `semantic unknowns` | 7.268 | **Não equivalem a erros**, sinalizam limites da inferência |
| Regressões do verificador e do auditor | 15/15 PASS | 8 import graph + 7 comparador AST↔REA |

**Atenção:** o auditor de importações foi programado para reprovar quando houver local de importação encontrado no AST e ausente na REA, ou dependência explícita na REA não reconciliável com o AST. A categoria de 41 casos não coincide com a semântica usual de “falsos positivos”: alguns são projeções de símbolos individuais em uma declaração; outros não possuem `specifier` literal. Classificar como **não esclarecidos**, não como erros comprovados.

## Evidência original reproduzível

- `nexus-rea-axios-evidence.json`: 41.408.890 bytes, SHA-256 **`7eec4255ab53781af5aef8a8352992a047d115e6eaa98f52a617ed5975b94ec4`**.
- Evidence ID: `ev_412d3e62b58742fc2b5520b049f7024f7d412a03c2f7ce275e6b51f42fb68c7e`.
- `nexus-axios-source-graph.json`: inventário, hashes SHA256 dos 72 arquivos, imports e linhas.
- `nexus-rea-axios-comparison.json`: resumo REA x AST.
- `nexus-rea-axios-import-audit.json`: auditoria reproduzível de sites e categorias.
- Artefatos disponíveis em [Actions run 42513988250](https://github.com/Lucasom825/rea/actions/runs/42513988250), retenção de três dias; ZIP completo também gerado como anexo desta conversa. Hash do JSON foi conferido em cópia baixada.

## Testes adversariais

O verificador independente foi executado no Axios e contra amostras controladas: importação inexistente, arquivo com sintaxe quebrada, `import()` literal versus dinâmico, dependência externa npm, ciclo entre módulos e diretório inexistente. O auditor foi testado com registros duplicados, specifier ausente, desvio de linha, dependência explícita sem fundamento no AST, importação esperada faltante e mudança de módulo de origem. **Testes não permitem concluir que todos os padrões de JavaScript estão cobertos.**

## Consequências para NEXUS

**FATO:** a REA já analisou, sob controle, duas bases públicas arquiteturalmente diferentes (TodoMVC e Axios), com cobertura de módulos e importações observada. O verificador AST independente permite detectar divergências sem confiança cega no resultado do modelo de IA.

**INFERÊNCIA:** a REA pode servir como ferramenta adicional de *discovery*, inventário e engenharia reversa, especialmente quando não se tem o código-fonte. Quando o repositório já é nosso e o código está disponível, a inspeção direta do código e testes geralmente são a primeira opção; REA não substitui isso.

**NÃO COMPROVADO:** precisão da análise de regras de negócio em sistemas arbitrários; execução dinâmica; ganho de produtividade em Memora/Supply/Fraja; baixo custo operacional sustentado; integração MCP de modelo confiável ao NEXUS. O Qwen 1.5B já foi reprovado em análise de cadeia causal no piloto 005. Não alegar solução autônoma universal.

**Próxima prova:** em projeto isolado e com autorização apropriada, testar uma aplicação com dependências de runtime/HTTP e um cenário de comportamento observável, cruzando a análise estática da REA com testes reais. Fazer isso num repositório privado, separado do fork público, caso envolva código confidencial. Não tocar em produção sem aprovação específica.

**Mudanças:** somente nova branch e arquivos `nexus-pilot/` + workflow novo. Não houve merge em `main`, deploy, gastos contratados, token privado, acesso a contas ou dados confidenciais.
