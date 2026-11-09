# NEXUS → REA | Ponte supervisionada experimental 048

## Estado e arquitetura

Esta branch experimental acrescenta apenas um arquivo de solicitação e um workflow GitHub Actions. O motor REA permanece exatamente na revisão já integrada à `main` de 09/11/2026, commit `5d4514d98a3a4da58db08209ef38e8b41ec8aa06`. O workflow recusa alterações executáveis divergentes desse commit.

**NEXUS neste piloto significa ChatGPT como coordenador sob demanda**, utilizando o conector GitHub já autorizado. Não existe, por este piloto, serviço MCP novo instalado, agente autônomo, execução em segundo plano do ChatGPT ou integração com sistemas privados.

## Operação pelo ChatGPT, sem botão Run workflow

1. A pessoa solicita aqui a análise de um repositório público autorizado, com preset `axios`, `nodered`, `todomvc` ou `public` com repositório e SHA válido.
2. O coordenador verifica que o objetivo se limita a análise estática de código público e obtém permissão antes de modificar ou aplicar qualquer resultado a sistemas produtivos.
3. Através do conector GitHub, busca a versão atual de `nexus-pilot/requests/active.json` na branch `nexus/rea-nexus-bridge-048-20261109` e atualiza **somente esse arquivo**, com `schema_version: 1`, `request_id` único, `target` e os demais campos necessários. O `sha` do conteúdo lido é exigido para evitar sobrescrita concorrente.
4. O push dispara o workflow `.github/workflows/nexus-rea-nexus-bridge-048.yml` de maneira normal pelo GitHub Actions. O GitHub valida os campos, resolve os presets fixados, confirma que o projeto é público e impõe os limites de tamanho, licença e diretório da REA.
5. O coordenador consulta a execução GitHub correspondente ao novo commit, lê a conclusão do job e os logs `NEXUS_REA_REPORT_BEGIN` a `NEXUS_REA_REPORT_END`. Confere o `request_id` e `NEXUS_REQUEST_VALIDATED`, os indicadores, a aprovação técnica e as ressalvas antes de entregar qualquer interpretação.
6. Os arquivos originais de evidência permanecem no artefato `rea-nexus-request-output` com retenção de três dias; não confundir o relatório textual limitado dos logs com a evidência completa. Se o relatório estiver truncado ou não houver acesso ao artefato, declarar essa limitação.

## Contrato de entrada

```json
{
  "schema_version": 1,
  "request_id": "nexus-rea-048-nodered-20261109",
  "target": "nodered",
  "repository": "",
  "commit": "",
  "directory": "",
  "purpose": "Somente auditoria de código público"
}
```

Para o preset `public`, informar repositório GitHub público `dono/repositorio`, SHA completo de 40 caracteres e diretório JS. Para presets fixos, os campos `repository`, `commit` e `directory` devem ficar vazios.

## Provas de funcionamento

- Solicitação Axios feita por ChatGPT: https://github.com/Lucasom825/rea/actions/runs/42700722919 — SUCCESS. 72 arquivos JS, 199/199 locais de importação AST, sete ocorrências adicionais com ressalvas, relatório publicado.
- Solicitação Node-RED feita por ChatGPT alterando somente `active.json`: https://github.com/Lucasom825/rea/actions/runs/42701007533 — SUCCESS. 47 arquivos JS, 177/177 locais, quatro imports dinâmicos incertos, relatório publicado.
- Reprodução com relatório português legível diretamente nos logs pelo conector: https://github.com/Lucasom825/rea/actions/runs/42701365252 — SUCCESS; marcadores NEXUS_REA_REPORT_BEGIN/END presentes, relatório real lido no ChatGPT. Node-RED: 47 arquivos, 177/177 importações estáticas, quatro requires dinâmicos e 23.023 incógnitas semânticas; código-alvo não executado.
- Prova final da ponte com documento de operação presente e verificação da origem compilada: https://github.com/Lucasom825/rea/actions/runs/42701587897 — SUCCESS, relatório público recuperável em texto, artefato rea-nexus-request-output criado.
- Homologação original: https://github.com/Lucasom825/rea/actions/runs/42682294094 — SUCCESS na tentativa 2; PR #3 integrado e main validada.

## Segurança, limites e critérios de aceite

- **Somente código-fonte público** e revisões imutáveis; sem dados de clientes, contratos, Memora, Fraja, Liame ou integrações produtivas.
- Não executar automaticamente software terceiro; apenas testes de funções puras previamente revisadas no preset Axios.
- Não conceder acesso irrestrito ao GitHub. O conector só atualiza um arquivo de solicitação em branch experimental, nunca o motor da REA ou a `main` sem autorização específica.
- Relatório `INCONCLUSIVO` não pode ser chamado de aprovação técnica; importações estáticas não demonstram comportamento funcional nem reprodução integral de sistemas.
- Custos/cotas de GitHub Actions dependem da conta e não foram auditados; não afirmar custo monetário universal zero.
- O sistema está pronto para **piloto supervisionado em ChatGPT com conector GitHub**, não para disponibilidade permanente, MCP REA instalado ou operação produtiva.
- Para declarar o piloto plenamente operacional, confirmar solicitação por ChatGPT, workflow correspondente, log com relatório real, inspeção do conteúdo, status de artefato e separação entre evidência, hipótese e conclusão.


## Próxima fase 049 — Construção e adaptação supervisionadas

**Objetivo aprovado pelo usuário em 09/11/2026:** quando solicitado, o Nexus não deve apenas apresentar o relatório de engenharia de software da REA. Deve usar a evidência para (a) criar um sistema novo, quando adequado, ou (b) implementar melhorias em sistemas existentes autorizados. Esta é uma **meta operacional**, não uma funcionalidade implementada automaticamente nem uma autorização para mudanças produtivas.

**Fluxo por solicitação e sem implantação automática:**

1. **Pedido e escopo:** identificar o projeto externo público analisado, a funcionalidade desejada, o destino da melhoria e critérios objetivos de aceite. Se a pessoa não indicar o aplicativo de destino, apresentar alternativas antes de qualquer alteração.
2. **Elegibilidade e licença:** confirmar texto da licença, obrigações de atribuição/copyleft e titularidade; distinguir código reutilizável de comportamento que pode ser implementado independentemente. Repositório público sem licença não autoriza copiar ou distribuir código. Não contornar controles técnicos ou licenças comerciais.
3. **Duas fontes de verdade:** (i) REA analisa SOMENTE código público, em commit imutável; seu mapa é estrutural e não demonstra funcionamento. (ii) GitHub/conector autorizado lê o repositório de destino e seus requisitos, testes, interface, banco, integrações e restrições. NUNCA subir arquivos privados do destino ao workflow público do REA.
4. **Diagnóstico de adequação:** estabelecer o que já existe no destino, o que será aproveitado de terceiro (se licenciado), o que será reimplementado e o que não pode ser comprovado. Elaborar plano incremental, testes de regressão e migração/rollback quando houver banco de dados.
5. **Implementação:** criar branch isolada no repositório de destino autorizado; editar código, dependências e testes; apresentar diff, requisitos atendidos, limites e custos previsíveis. Reutilizar módulos próprios e evitar duplicar um aplicativo já existente.
6. **Validação:** executar CI disponível, verificar builds e testes relevantes; quando possível, validar comportamento com dados de teste não sensíveis. Não concluir por mero sucesso de CI se falta prova funcional. Abrir PR para revisão.
7. **Entrega e autorização:** PR/preview e instruções de teste; merge, deploy, migração de banco, despesas e mudanças em produção SOMENTE com autorização específica do usuário e verificações atualizadas. Não dizer "pronto para usar" sem prova no ambiente apropriado.
8. **Memória e aprendizado:** registrar fontes, revisão SHA, versão inicial/final, hipóteses, defeitos, testes, limitações e decisões confirmadas no Memória Viva; não gravar tokens, dados privados completos ou conteúdo sensível.

**Critério inicial de sucesso da Fase 049:** um caso real pequeno de recurso permitido por licença, incorporado em uma branch de teste do sistema de destino, com código existente preservado, teste de regressão e demonstração do comportamento solicitado. Somente após esse marco poderemos dizer que a função **analisar → implementar → testar** foi provada; a integração automática do gerador ao REA permanece NÃO VALIDADA até então.

**Capacidades atuais comprovadas:** GitHub conectado permite criar branches, editar/criar arquivos, abrir PR e inspecionar CI; a REA via GitHub fornece análise de fontes públicas e relatório, com ressalvas. O modelo de IA coordena sob demanda no ChatGPT; não há agente gerador 24/7. Ferramentas de publicação podem ter custos e permissões não auditadas.
