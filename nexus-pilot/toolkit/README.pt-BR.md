# REA Toolkit — análise pública JavaScript e revisão do motor

Este repositório contém o REA Toolkit e a auditoria independente de importações. A REA mantém o comportamento original de inferência para não quebrar os contratos CLI/MCP; candidatos não comprovados são diferenciados por confiança.
O botão utiliza a versão de código da branch selecionada: use `main` somente
após o PR de atualização ser integrado e a execução nessa branch ser validada.
Ela gera um relatório técnico em português, verificando o inventário de arquivos
e as importações da REA contra um parser independente de JavaScript.
**Não é um agente de IA autônomo**, nem substitui testes de execução.

## O que faz

1. Recebe um projeto público selecionado e um commit Git completo (40 caracteres).
2. Confirma que o repositório é público, impõe limites de tamanho e baixa o código no commit exato.
3. Instala dependências, compila a REA desta revisão GitHub e a executa em modo estático, com verificador independente de importações. **Não usa o pacote publicado `rea-agents@6.8.0`**; a auditoria mostra separadamente o que o extrator original não comprovou.
4. Compara os locais de importação por arquivo/linha/dependência, registra divergências e indica ressalvas.
5. Gera um relatório em português diretamente no **GitHub Actions > Summary**, acompanhado de arquivos JSON auditáveis com retenção de 3 dias.

## Como usar pelo iPhone ou computador

1. Abra o GitHub na conta `Lucasom825`, repositório `rea`.
2. Entre em **Actions** > **REA Toolkit - Analise de codigo publico**.
3. Toque em **Run workflow** e mantenha a branch `main`.
4. Escolha um tipo de análise:
   - `axios`: 72 módulos JavaScript, teste real de 12 comportamentos de funções puras, sem rede.
   - `todomvc`: sete módulos JavaScript, análise exclusivamente estática.
   - `nodered`: 47 módulos JavaScript do motor de fluxos Node-RED, revisão pública fixa; análise estática, sem executar o código.
   - `public`: outro repositório GitHub **público**, fornecendo `dono/repositorio`, SHA completo de 40 caracteres e pasta dos arquivos JavaScript.
5. Toque em **Run workflow**. Após o resultado, abra o resumo da execução e o artefato `rea-toolkit-public-analysis`.

Se o botão não aparecer na versão móvel, use o Safari no modo **Solicitar Site para Computador**.
O GitHub exige que o workflow exista na branch principal para apresentar esse botão.

Endereço do workflow após ativação:
https://github.com/Lucasom825/rea/actions/workflows/nexus-rea-toolkit.yml

## Exemplo de análise personalizada

- Tipo: `public`
- Repositório: `axios/axios`
- Commit: `a81d62a22e4b291a05d5b087a89fcc9d16075e83`
- Diretório: `lib`

Os modos `nodered` e `public` **não executam código do repositório**. O teste comportamental ocorre
apenas no preset `axios`, cujo código e commit específicos foram revisados para esse teste.

## Restrições de segurança e precisão

- Somente repositórios públicos, com revisão fixa, até 250.000 KB conforme metadados GitHub.
- Até 300 arquivos `.js` e 15 MB de fontes JS no diretório selecionado.
- Não envia contratos, segredos, documentos de clientes, áudios ou dados dos projetos privados.
- Não acessa Memora, Fraja, Supply Live, Liame ou qualquer ambiente de produção.
- Não depende de API paga de modelo de IA.
- **Importações estáticas não são comportamento comprovado.** Erros sintáticos, importações não resolvidas ou divergências relevantes geram status `INCONCLUSIVO`.
- Importações dinâmicas, módulos fora do escopo e registros não totalmente reconciliados recebem ressalvas explícitas.
- Runners e artefatos do GitHub podem ter limites e políticas de consumo; não há auditoria de faturamento da conta.
- A ferramenta analisa JavaScript; TypeScript puro, Python, Java, binários e aplicações que não estejam disponíveis como `.js` exigem metodologia própria.

## Evidências das provas

- Piloto Axios, workflow final de teste: https://github.com/Lucasom825/rea/actions/runs/42517590684
- Teste cruzado dos dois presets: https://github.com/Lucasom825/rea/actions/runs/42517744360
- Resultado validado: Axios 72/72 módulos, 199/199 importações do AST encontradas pela REA e 12 testes de funções puras; TodoMVC 7/7 módulos, 9/9 importações.
- Ambas as análises mantiveram ressalvas sobre ocorrências adicionais da REA que não são dependências distintas comprovadas.

## Histórico das validações e atualização Node-RED

O botão do Toolkit original foi executado duas vezes com sucesso no preset
Axios (runs 42526569587 e 42526593017). A opção `nodered` é incluída
nesta revisão e fica disponível no seletor quando o código atualizado
estiver efetivamente integrado à `main`.

A prova isolada do Node-RED (commit público
`c694a9b04ccfdeff2923bf8419082595f4e27071`) executou REA 6.8.0 em 47
arquivos JS. O parser de referência encontrou 177 importações; apenas 153 foram
reconciliadas com a REA, com **24 locais ausentes**. O resultado técnico é
**INCONCLUSIVO**, mesmo com a execução e entrega de relatório bem-sucedidas.
A auditoria forense do artefato original identificou que os 24 locais constam no Evidence da REA como expressões `require(...)` literais com `properties.specifier=null`, distribuídos em `flows/Subflow.js` (10), `storage/localfilesystem/projects/Project.js` (10) e `telemetry/index.js` (4). Portanto são registros incompletos, não ausência integral da observação. Os 135 registros extras sem especificador se dividem em **24 requires literais que coincidem com AST**, **107 chamadas de métodos comuns rotuladas como imports** e **4 requires dinâmicos**. No **pacote antigo 6.8.0**, a comparação estrita permaneceu 153/177 e o status técnico foi **INCONCLUSIVO**. Na prova isolada com a **fonte do motor corrigida**, os 177/177 sítios do Node-RED foram reconciliados sem extras no grafo de importações. Essa prova não demonstra precisão semântica ou comportamento em execução.
Evidência: https://github.com/Lucasom825/rea/actions/runs/42527372456 . Auditoria detalhada em teste isolado: https://github.com/Lucasom825/rea/actions/runs/42528986976 .

Para não confundir conclusão do job com qualidade do resultado, a nova versão
adiciona anotação visível de alerta quando o relatório técnico for inconclusivo
e um mapa de módulos internos mais referenciados, gerado a partir do AST, sem
inferir comportamento. Publicação desta revisão depende de validação e revisão
humana. O código-fonte local da REA foi alterado e recompilado, mas **não foi publicada nova versão no npm**. Memora e NEXUS de produção permanecem inalterados.

### Histórico de provas do experimento de motor (substituído por revisão compatível)

- [Node-RED — experimento de motor posteriormente substituído, 145 testes aprovados, 177/177 importações no teste isolado](https://github.com/Lucasom825/rea/actions/runs/42530678687). A alteração rompeu contratos CLI/MCP em testes de aceitação mais amplos; seus números não são a situação do código atual.
- [Axios — experimento de motor posteriormente substituído, 199/199 importações no teste isolado](https://github.com/Lucasom825/rea/actions/runs/42530872243). Seus números não substituem os testes do motor atual.
- O workflow revisto faz o build da própria REA no GitHub Actions antes da análise. Isso pode aumentar o uso do GitHub Actions; disponibilidade, cotas e custo da conta não foram auditados.
- Para conferir qual motor está em uso, consulte a revisão GitHub do workflow executado. Antes da integração, a versão antiga de `main` ainda chama o pacote publicado no npm; esta revisão usa o motor compilado localmente.

## Revisão estável — contrato CLI/MCP preservado (08/11/2026)

Uma CI completa detectou mais de 100 falhas em cenários de carregadores
indiretos/ambíguos com a tentativa de classificação agressiva no motor.
Essa alteração foi **revertida**; o analisador preserva os candidatos de
importação que dependem de evidência incerta, explicitamente como
`interpretation: unproven-module-loader` e `confidence: low`.
O motor compilado e o auditor AST independente não executam o código-alvo.

Prova da nova revisão:
- [417 testes de aceitação/regressão CLI/MCP e 145 testes focados, Node-RED com 47 arquivos e relatório emitido](https://github.com/Lucasom825/rea/actions/runs/42535904524): SUCCESS.
- **Node-RED: AST verificou 177 locais sintáticos; REA confirmou estritamente
  153; outros 24 têm expressão literal, mas `properties.specifier=null`.
  Existem 20 chamadas ordinárias classificadas como possíveis imports e
  quatro requires dinâmicos não literais. O relatório é
  `INCONCLUSIVO` e `REA_TOOLKIT_TECHNICAL_APPROVAL=false`.
- A cobertura sintática AST não prova que o motor recuperou a semântica.
  Uma ação GitHub verde prova que o relatório saiu, não que o resultado
  técnico foi aprovado.

Essa é uma ferramenta de auditoria estrutural com ressalvas, **não um
reconstrutor automático de aplicações**. A publicação em main exige CI
completa bem-sucedida e revisão humana; a qualidade semântica geral
permanece não homologada.

## Próximos limites

A REA fica disponível como **analista estático de código público**.
Ela **não se torna automaticamente um agente do NEXUS**. Integração permanente
de modelo, chaves, dados privados ou produção requer uma etapa específica de
segurança e autorização.

## Como ler uma análise inconclusiva

Um relatório `INCONCLUSIVO` **é entregue normalmente** como artefato e no Summary,
mas **não está tecnicamente aprovado**. Isso ocorre, por exemplo, quando um import
identificado pelo parser de referência não é encontrado nas evidências da REA.
Em código Express (CommonJS), a comparação registrou 11 locais ausentes na REA:
https://github.com/Lucasom825/rea/actions/runs/42519609185.
Importações dinâmicas permanecem ressalvadas. O resultado nunca deve ser
apresentado como precisão universal da ferramenta.

Repositórios escolhidos pelo modo `public` devem exibir licença aberta
reconhecida pelo GitHub. A análise é restrita a código público em JavaScript
e não pode executar o código do alvo.

Em uma execução do GitHub Actions, a cor verde significa que o relatório foi
entregue; o **status técnico dentro do documento** é o critério de validade.

**A liberação em `main` depende da revisão humana exigida pelo PR**, incluindo
o aceite dos testes e dos limites das funções puras executadas no preset Axios.
