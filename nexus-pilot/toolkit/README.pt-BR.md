# REA Toolkit 007 — análise pública de JavaScript, com evidência

Esta é a **primeira ferramenta pronta para ativação** da trilha REA/NEXUS.
Ela gera um relatório técnico em português, verificando o inventário de arquivos
e as importações da REA contra um parser independente de JavaScript.
**Não é um agente de IA autônomo**, nem substitui testes de execução.

## O que faz

1. Recebe um projeto público selecionado e um commit Git completo (40 caracteres).
2. Confirma que o repositório é público, impõe limites de tamanho e baixa o código no commit exato.
3. Executa a REA 6.8.0 em modo estático e um segundo verificador de importações.
4. Compara os locais de importação por arquivo/linha/dependência, registra divergências e indica ressalvas.
5. Gera um relatório em português diretamente no **GitHub Actions > Summary**, acompanhado de arquivos JSON auditáveis com retenção de 3 dias.

## Como usar pelo iPhone ou computador (depois da ativação em `main`)

1. Abra o GitHub na conta `Lucasom825`, repositório `rea`.
2. Entre em **Actions** > **REA Toolkit - Analise de codigo publico**.
3. Toque em **Run workflow** e mantenha a branch `main`.
4. Escolha um tipo de análise:
   - `axios`: 72 módulos JavaScript, teste real de 12 comportamentos de funções puras, sem rede.
   - `todomvc`: sete módulos JavaScript, análise exclusivamente estática.
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

O modo `public` **não executa código do repositório**. O teste comportamental ocorre
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

## O que falta para liberar o botão de uso

No GitHub, aprovar o PR de ativação para `main` **após revisão**. Esta edição
foi construída em uma branch independente para evitar misturar dezenas de commits
experimentais com os arquivos necessários à ferramenta. Nenhuma produção é
alterada pelo PR em si; a publicação só ocorre quando a revisão é aprovada e
o PR é integrado à branch principal.

## Próximos limites

A REA fica disponível como **analista estático de código público**.
Ela **não se torna automaticamente um agente do NEXUS**. Integração permanente
de modelo, chaves, dados privados ou produção requer uma etapa específica de
segurança e autorização.
