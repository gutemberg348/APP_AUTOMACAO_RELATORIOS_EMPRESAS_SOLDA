# Líquido Penetrante: fichas de soldas e Dados Gerais

## Alterações de 30/10/2026

- Dimensão retirada das fichas de LP e da consulta resumida no app. A dimensão de pontos antigos também deixa de ser impressa nos rodapés das fotos do LP. A espessura geral do ensaio permanece na tabela de Dados Gerais, conforme a referência. Outros tipos de relatório mantêm seus campos de dimensão.
- Uma ficha pode representar uma solda ou um grupo, como `01 - 02 - 03`, no campo `Soldas nesta ficha / foto`. Resultado, descontinuidade e fotos pertencem a essa ficha. Não é necessário duplicar a foto em pontos diferentes.
- O vínculo das fotos continua por ID do ponto; editar a identificação do grupo preserva fotos e marcações. Depois de `01 - 02 - 03`, a próxima ficha sugere `04`, e seu grupo pode ser editado antes de criar. A criação em lote orienta a usar um número inicial individual para evitar repetir grupos parcialmente.
- Dados Gerais do PDF refeitos como formulário: condições do ensaio em cinco colunas, materiais utilizados, opções de penetrante/remoção com marcação, fabricantes/marcas/lotes/validades, descontinuidades com coluna de área/linha e legenda em três colunas. O quadro usa quase toda a altura útil da folha.
- Novo campo opcional `Área / linha inspecionada`, em Dados gerais, para o bloco à esquerda das descontinuidades.
- Tipo de penetrante e técnica de remoção têm seletores no app. Descrições personalizadas continuam aceitas; valores antigos conhecidos são reconhecidos e descrições adicionais não são descartadas.
- A tabela imprime até 12 descontinuidades por quadro, com continuação e texto integral dos valores longos fora das células, sem truncamento definitivo.

## Verificação

- Build shared/API, typecheck do app, exportação web e ESLint dos arquivos alterados aprovados.
- 227 testes unitários aprovados em 38 arquivos. Testes específicos do LP cobrem grupos, sequência, dimensões antigas omitidas, espessura geral preservada, opções antigas/customizadas, dados extensos e escape de HTML.
- PostgreSQL isolado: criação de dois grupos, upload de foto, alteração do grupo, preservação do ID/vínculo da foto, salvamento dos materiais e geração real de PDF aprovados.
- Interface de celular no navegador: dimensão ausente, grupo editado, nova ficha com sugestão 04, seletor de materiais, descrição personalizada e salvamento com foto preservada aprovados.
- PDF real do LP gerado no Chromium, rasterizado com PyMuPDF e inspecionado. Também conferidos 25 registros de descontinuidade e campos extensos com conteúdo integral nas continuações. Fotos preservam quadros iguais em 4:3.
- Evidências locais em `artifacts/lp-faithful/`. Nenhum deploy, push, alteração de dados de produção ou geração de APK nesta etapa.

## Publicação

Atualizar API/web na VPS para aplicar o novo template e aceitar o campo de área; atualizar o APK ou recarregar o Expo para os novos campos, seletores e orientações. Não foi adicionada migração de banco nesta alteração de LP. PDFs já existentes não mudam: gere uma nova prévia.

Teste de integração reproduzível:

```bash
npm run test:integration -- test/integration/lp-weld-groups.test.ts
```
