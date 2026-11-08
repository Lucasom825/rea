# REA Toolkit 007 — análise pública de JavaScript, com evidência

Esta ferramenta já está disponível em `main` como o primeiro piloto REA/NEXUS.
Ela gera um relatório técnico em português, verificando o inventário de arquivos
e as importações da REA contra um parser independente de JavaScript.
**Não é um agente de IA autônomo**, nem substitui testes de execução.

## O que faz

1. Recebe um projeto público selecionado e um commit Git completo (40 caracteres).
2. Confirma que o repositório é público, impõe limites de tamanho e baixa o código no commit exato.
3. Executa a REA 6.8.0 em modo estático e um segundo verificador de importações.
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

## Estado da publicação e da nova opção Node-RED de uso

O botão do Toolkit original já existe em `main` e foi executado duas vezes com
sucesso no preset Axios (runs 42526569587 e 42526593017). A opção `nodered`
é proposta nesta branch de melhoria; **ainda não está publicada em main**.

A prova isolada do Node-RED (commit público
`c694a9b04ccfdeff2923bf8419082595f4e27071`) executou REA 6.8.0 em 47
arquivos JS. O parser de referência encontrou 177 importações; apenas 153 foram
reconciliadas com a REA, com **24 locais ausentes**. O resultado técnico é
**INCONCLUSIVO**, mesmo com a execução e entrega de relatório bem-sucedidas.
Houve ainda 135 ocorrências extras da REA sem especificador literal verificável.
Evidência: https://github.com/Lucasom825/rea/actions/runs/42527372456 .

Para não confundir conclusão do job com qualidade do resultado, a nova versão
adiciona anotação visível de alerta quando o relatório técnico for inconclusivo
e um mapa de módulos internos mais referenciados, gerado a partir do AST, sem
inferir comportamento. Publicação desta revisão depende de validação e revisão
humana; não muda a REA 6.8.0 nem altera Memora ou NEXUS de produção.

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
