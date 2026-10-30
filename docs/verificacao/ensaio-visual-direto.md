# Ensaio Visual Direto (EVD)

Novo tipo independente do EVS / Endoscopia. O relatório enviado pelo usuário foi conferido visualmente nas oito páginas digitalizadas. A implementação reutiliza o fluxo e o template do EVS com título de capa e identificação `RELATÓRIO DE ENSAIO VISUAL DIRETO`.

## Funcionalidade

- Cadastro do tipo EVD por migração e seed idempotentes; preserva o tipo EVS e seus relatórios.
- Formulário e dados-base da obra incluem desenho de referência/revisão, metal de adição e EPS/revisão. Tipo de ensaio inicial: `EVS DIRETO`. Procedimentos, normas, critérios, materiais, nomes e assinaturas do arquivo de referência não são importados como dados de produção.
- Registros de inspeção com item, desenho, diâmetro, junta/intervalo, sinete de raiz, sinete de acabamento e laudo A/R/EC. Cada registro abre separadamente; os demais fecham. Até 200 registros, com campos opcionais no rascunho.
- Tabela própria no PDF, com continuação após 20 registros. Campos extensos têm prévia na célula e conteúdo integral abaixo, sem perda de dados.
- Desenhos, pontos, fotos padronizadas, anotações, laudo final, assinaturas e permissões reutilizam o EVS existente.
- Erros dos registros mantêm caminho e orientação; Corrigir abre a seção e o registro indicado.

## Verificação executada

- Build shared/API, typecheck do app, exportação web e ESLint dos arquivos alterados aprovados.
- 36 testes unitários aprovados (novo tipo, rascunhos, erros, PDF e troca rápida de status).
- PostgreSQL 17 descartável: migração e seed aprovados. Teste específico passa por listagem do novo tipo, criação com dados-base, salvamento de registros, rejeição de laudo inválido com caminho correto e preservação dos dados, PDF real e envio para análise com aviso de dados incompletos.
- Navegador com viewport de celular: seleção do novo tipo, método inicial direto, preenchimento dos novos campos, registros em acordeão, salvamento, solicitação de PDF após aviso e Corrigir para o segundo registro sem perder as edições.
- PDF real com 23 registros em duas tabelas, desenho, fotos e assinaturas; também testado com textos extensos. Paginação e dados conferidos. Páginas da capa, identificação, tabelas e conclusão rasterizadas com PyMuPDF e inspecionadas visualmente.
- Evidências locais em `artifacts/visual-direct/`.

Comando para repetir o teste em banco isolado:

```bash
npm run test:integration -- test/integration/visual-direct.test.ts
```

A tentativa inicial da suíte geral encontrou testes antigos desatualizados. Na auditoria de 30/10/2026, o import de Expo e as fixtures foram corrigidos, a cobertura geral foi estendida ao EVD e os 47 testes de integração passaram. Consulte `auditoria-2026-10-30.md` para o resultado consolidado.

## Publicação

Atualizar API/web na VPS e gerar novo APK, ou recarregar o Expo com o código atualizado. `npm run docker:production` executa a migração e o seed antes de iniciar a API. O novo tipo aparecerá como `Ensaio Visual Direto` na escolha do modelo. Nenhum deploy, push ou APK foi executado nesta etapa.
