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

### Pontos e fotos ausentes no APK instalado

O formulário atual inclui pontos de solda para EVD independentemente da empresa/obra. Padrões da obra preenchem valores, não removem seções. Um APK anterior à inclusão do EVD pode receber o novo tipo da API e apresentar o formulário genérico (dados iniciais e desenho), sem pontos/fotos. Atualizar somente a VPS não atualiza o JavaScript empacotado no APK.

Conferência no navegador em viewport de celular e API simulada: EVD novo e existente em duas empresas/obras com padrões diferentes, quatro cenários. Todos exibiram registros de inspeção, seção Pontos de solda, criação do primeiro ponto, Selecionar as duas fotos e Adicionar foto 1 ao ponto 1. Evidência local em `artifacts/evd-company-sections.png`. Não houve reprodução no APK instalado do usuário nem teste em aparelho físico.

No computador, `npm run apk` recompila o shared e empacota o código atual. Instalar `artifacts/android/weldcosta-release.apk` como atualização do aplicativo existente. Os relatórios salvos permanecem no servidor e não precisam ser recriados.

### Revisão do formulário incompleto em 31/10/2026

O usuário confirmou APK atualizado e selo EVD. Portanto, a hipótese de APK anterior não explica sozinha o relato. Foi conferido o bundle Hermes do APK local (versão 13): seus bytes coincidem com o bundle gerado e o source map contém EVD nos códigos, nos campos técnicos e na inclusão de pontos/fotos e registros. Não houve acesso ao aparelho do usuário; a causa específica nele permanece sem reprodução.

- A composição das seções foi isolada e verificada: EVD tem Identificação, Dados do ensaio, Registros de inspeção, Desenho técnico, Pontos de solda, Laudo e Responsáveis.
- Atalho **Pontos e fotos** e índice **Todas as seções** permitem abrir os campos diretamente, fechando o desenho e levando a rolagem à seção escolhida. Laudo e responsáveis continuam na conclusão.
- O scroll da página mantém os filhos nativos anexados (`removeClippedSubviews=false`) para evitar descarte visual durante mudanças de altura dos acordeões. Isso é uma proteção de apresentação; não comprova a causa no aparelho.
- Modelos desconhecidos sem campos personalizados exibem aviso com nome/código e orientação de atualização, em vez de formulário genérico incompleto.
- 18 testes unitários de seções/correções, typecheck e ESLint aprovados. Teste no navegador com viewport de celular: EVD novo/existente em duas empresas/obras, criação do primeiro ponto e acesso às duas fotos; atalhos para dados técnicos e fotos; modelo desconhecido com aviso explícito. Dois testes de integração do EVD aprovados em PostgreSQL isolado, incluindo salvamento, fotos, PDF e escopo por obra.

Estas alterações são do aplicativo e do painel web. No APK instalado exigem nova compilação/instalação; não exigem mudança da API nem recriação dos relatórios. A exibição no aparelho físico ainda precisa ser confirmada.

Atualizar API/web na VPS e gerar novo APK, ou recarregar o Expo com o código atualizado. `npm run docker:production` executa a migração e o seed antes de iniciar a API. O novo tipo aparecerá como `Ensaio Visual Direto` na escolha do modelo. Nenhum deploy, push ou APK foi executado nesta etapa.
