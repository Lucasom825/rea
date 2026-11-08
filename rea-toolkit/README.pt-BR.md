# REA Toolkit — Análise verificável de código público

Ferramenta experimental e **utilizável sob demanda** para analisar módulos JavaScript de repositórios públicos GitHub. Não utiliza um LLM para inventar explicações e não modifica o código-alvo.

## Como utilizar pelo GitHub

Quando esta versão estiver integrada à branch `main` do fork `Lucasom825/rea`:

1. Abra **Actions → REA Toolkit | Analise Verificada → Run workflow** no GitHub (no celular, use Safari e peça a versão para computador caso a opção não apareça).
2. Escolha o projeto `axios` ou `todomvc` e clique em **Run workflow**. Para outro repositório aberto e licenciado, escolha `public` e informe `owner/repo`, commit completo de 40 caracteres e diretório relativo de arquivos JavaScript.
3. Ao final, entre na execução e consulte **Summary**: o relatório em português será mostrado ali.
4. Na seção **Artifacts**, baixe `rea-toolkit-public-analysis`. Ele contém `report.pt-BR.md`, `report.json`, `source_graph.json`, `import_audit.json` e `REA_Evidence.json`. Retenção configurada em 3 dias.

**Importante:** enquanto o workflow estiver apenas na branch de revisão, o botão Run workflow da interface pode não estar disponível; GitHub exige que o workflow exista na branch padrão para oferecer o acionamento manual.

## O que os resultados significam

| Status | Interpretação |
| --- | --- |
| COBERTURA_ESTRUTURAL_CONFIRMADA | Módulos e importações passam nos controles empregados; não implica comportamento comprovado |
| COBERTURA_ESTRUTURAL_COM_RESSALVAS | Inventário estrutural passou, mas há importações ou classificações incertas |
| INCONCLUSIVO | Existe diferença material entre REA e análise independente; números e fontes são entregues para investigação, sem aprovação técnica |

Uma execução **concluída com sucesso** significa que o relatório foi gerado e guardado. **Não significa** que o resultado técnico é aprovado. Confira sempre o status dentro do relatório.

## Presets de teste

- **Axios:** revisão fixa `a81d62a22e4b291a05d5b087a89fcc9d16075e83`, pasta `lib`, 72 arquivos JavaScript. Também executa 12 verificações sem rede, restritas a três funções puras revisadas.
- **TodoMVC:** revisão fixa `ff43b02e59dfa604386bb382034b2cd07c2bcd8a`, pasta `examples/javascript-es6/src`, sete arquivos JavaScript; leitura estática apenas.
- **Repositório público:** exige commit fixo e licença aberta reconhecida no GitHub. Nunca executa o código do alvo; leitura estática apenas. Exemplos de licenças aceitas: MIT, Apache-2.0, BSD, ISC, MPL-2.0 e GPL-3.0.

## Segurança e limites

- Somente GitHub público, com hash de commit congelado. Repositório privado é recusado.
- Não use para Memora, Supply Live, Fraja, dados de clientes ou código confidencial: o fork é público e o GitHub Actions não foi homologado para esses dados.
- O workflow possui `permissions: contents: read`, checagem de visibilidade pública, diretório isolado, sem credenciais persistidas nos checkouts, sem API de modelo paga e sem deploy.
- Até 300 arquivos JavaScript, 15 MB somados de JS, 90 MB de Evidence e 15 minutos de execução por tentativa; limites de repositório também são aplicados.
- A ferramenta inspeciona importações e módulos: não garante análise correta de chamadas dinâmicas, todos os frameworks, APIs, banco de dados, semântica completa ou testes ponta a ponta.
- Não classifique um alerta como falha do código original: normalmente é uma lacuna de análise ou reconciliação que necessita investigação.

## Evidências de validação

- <https://github.com/Lucasom825/rea/actions/runs/42517744360>: presets Axios e TodoMVC aprovados.
- <https://github.com/Lucasom825/rea/actions/runs/42519609185>: três entradas testadas; a entrada `public` apontou ao Express MIT e produziu relatório **INCONCLUSIVO** de modo controlado, sem apresentar cobertura completa.
- Arquivos deste lançamento foram extraídos de testes anteriores, sem copiar a sequência de mais de 40 commits experimentais para `main`.

## Estado de produto

**Pronto para análise estática de projetos públicos com ressalvas explícitas.** Não é um agente autônomo, nem integração REA com o ChatGPT/NEXUS operacional. Qualquer liberação a dados privados exigirá arquitetura e autorização separadas.
