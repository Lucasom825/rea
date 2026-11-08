# Piloto NEXUS + REA 001 — investigação controlada

Adição experimental à cópia Lucasom825/rea, preparada em 08/11/2026.
Não modifica a REA original, nem altera os sistemas Memora, Fraja ou Supply Live.

## Objetivo

Verificar a preparação do ambiente e, somente após aprovação e instalação isolada,
executar uma análise estática real de um aplicativo JavaScript sintético e autorizado.
A REA é candidata em avaliação, não um componente instalado do NEXUS.

## Testes offline reproduzíveis

Na raiz do fork:

~~~bash
node nexus-pilot/preflight.mjs --json
node --test nexus-pilot/tests/pilot.test.mjs
~~~

O preflight lê somente package.json e .nvmrc do projeto. Não instala nada,
não lê credenciais, não inicia a REA e não configura um agente.
Com --strict, encerra com status 2 caso o Node seja incompatível.

### Evidência obtida no primeiro teste local

- Ambiente de teste: Node v22.16.0.
- Metadados da REA revisados: pacote rea-agents 6.8.0; .nvmrc 24.22.1.
- Resultado: 3 testes Node passaram; o preflight reportou NODE_ENGINE_MISMATCH.
- A REA e a integração MCP não foram executadas ou homologadas.
- O teste local usou uma cópia mínima dos metadados do pacote na raiz temporária.
- No fork, o preflight lê os arquivos originais da própria REA.

## Próxima etapa, com ambiente isolado e Node compatível

Verificar a versão exigida pelo projeto e revisar SECURITY.md, DISCLAIMER.md,
docs/getting-started/installation.md e docs/getting-started/cli.md.
Somente se a instalação da versão publicada tiver sido autorizada:

~~~bash
npx -y rea-agents@6.8.0 analyze-javascript-application "$(pwd)/nexus-pilot/fixture" --json
~~~

Este é um comando documentado para análise estática de JavaScript.
Ele pode instalar e executar código de terceiros, portanto NÃO faz parte dos
testes offline e não deve rodar em ambiente de produção.
Se executado, armazenar os resultados Evidence em diretório privado fora do fork público.

## Critérios de aceite

1. Confirmar proveniência: original morluto/rea, versão, revisão e licença MIT.
2. Garantir versão Node compatível e execução isolada.
3. Executar análise real do diretório sintético; inspecionar Evidence e limitações.
4. Comparar achados com as quatro regras conhecidas em fixture/sourcing.js.
5. Medir duração, custo, consumo de recursos, falhas e utilidade para o NEXUS.
6. Não usar aplicativos ou dados confidenciais sem autorização específica.

## Restrições

Este fork é PÚBLICO: não enviar áudio, PDF de clientes, contratos, tokens,
credenciais ou capturas privadas. Não modificar workflows existentes do projeto
original, configurações de produção nem executar alvos desconhecidos.
Workflows experimentais novos foram adicionados apenas à branch isolada do piloto.
Não tratar teste de metadados como evidência de que a REA funciona.

Fontes técnicas: README.md, SECURITY.md, DISCLAIMER.md, AGENTS.md,
docs/getting-started/installation.md, docs/getting-started/cli.md.
Original: https://github.com/morluto/rea


## Atualização de execução — 08/11/2026

As etapas seguintes **já foram executadas**, com evidências verificadas:

- Piloto 001 (sintético): [GitHub Actions](https://github.com/Lucasom825/rea/actions/runs/42491577638).
- Piloto 002 (TodoMVC multimódulo): [GitHub Actions](https://github.com/Lucasom825/rea/actions/runs/42504343905).
- Piloto 003 (MCP stdio e Evidence): [GitHub Actions](https://github.com/Lucasom825/rea/actions/runs/42505202545).
- Validação adicional (cliente com duas ferramentas autorizadas): [GitHub Actions](https://github.com/Lucasom825/rea/actions/runs/42505900001).

Leia o relatório [RESULTADO_MCP_003.md](RESULTADO_MCP_003.md) para ver
o que funcionou, por que o filtro `REA_MCP_TOOL_FAMILIES` **não funciona
na versão publicada 6.8.0**, e o controle alternativo testado no cliente.
Não há LLM/autonomia NEXUS conectada à REA, instalação permanente,
merge na branch `main` ou execução em produção.
