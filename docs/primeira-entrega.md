# Fundação implementada

Este documento registra a primeira entrega. O escopo atual de preenchimento pela obra, pontos, imagens, responsáveis e PDFs está em [relatórios e PDFs](relatorios-pdf.md); as pendências abaixo refletem a fundação original.

## Estrutura

```text
apps/
  api/
    prisma/                   schema, migration inicial e seed
    src/
      config/                 ENV validado
      errors/                 erros de domínio
      middlewares/            autenticação, permissões e erros
      modules/
        auth/ companies/ projects/ report-types/ reports/ dashboard/
        pdf/ drawings/        contratos para etapas futuras
      prisma/                 cliente PostgreSQL
      services/storage/       interface e implementação local privada
      utils/
    test/unit/ test/integration/
  app/
    app/(auth)/               login
    app/(protected)/          dashboard, empresas, obras e relatórios
    components/ features/ hooks/ services/ stores/ utils/
packages/shared/src/
  enums/ permissions/ schemas/reports/ types/
docker/                       Dockerfile e exemplo Nginx
scripts/                      setup ENV e testes PostgreSQL isolados
docs/referencias/              análise dos PDFs e manifesto
materiais_base/                PDFs originais preservados
```

## Tabelas Prisma

17 modelos: `User`, `Role`, `Permission`, `RolePermission`, `Company`, `Project`, `ReportType`, `Report`, `ReportPoint`, `ReportMedia`, `ReportDrawing`, `ReportSignature`, `ReportPdf`, `TrainingCategory`, `TrainingContent`, `AuditLog`, `RefreshToken`.

`SystemSetting` é opcional no escopo e não foi criado. Todos os 17 modelos possuem tabela na migration `202610070001_initial`. Tabelas de fases futuras estão criadas, sem endpoints funcionais anunciados para elas.

## Endpoints disponíveis

Todas as rotas abaixo, exceto saúde e POSTs de autenticação, exigem Bearer access token. Permissões são verificadas no backend.

| Método   | Rota                             | Comportamento                                        |
| -------- | -------------------------------- | ---------------------------------------------------- |
| GET      | `/health`                        | Saúde do processo                                    |
| POST     | `/auth/login`                    | Login com `email/password`                           |
| POST     | `/auth/refresh`                  | Rotação com `refreshToken`                           |
| POST     | `/auth/logout`                   | Revoga a família de refresh tokens                   |
| GET      | `/auth/me`                       | Perfil público e permissões atuais                   |
| GET/POST | `/companies`                     | Listar/criar clientes                                |
| GET/PUT  | `/companies/:id`                 | Consultar/editar                                     |
| PATCH    | `/companies/:id/status`          | ACTIVE/ARCHIVED                                      |
| GET      | `/companies/:companyId/projects` | Obras do cliente                                     |
| GET/POST | `/projects`                      | Listar/criar obras                                   |
| GET/PUT  | `/projects/:id`                  | Consultar/editar                                     |
| PATCH    | `/projects/:id/status`           | ACTIVE/ARCHIVED                                      |
| GET      | `/report-types`                  | Tipos ativos paginados                               |
| GET      | `/report-types/:id`              | Configuração do tipo                                 |
| GET/POST | `/reports`                       | Listar/criar rascunho                                |
| GET/PUT  | `/reports/:id`                   | Consultar/salvar dados                               |
| DELETE   | `/reports/:id`                   | Exclusão lógica de rascunho, corpo `{version}`       |
| PATCH    | `/reports/:id/status`            | Transição, corpo `{status, version, revisionNotes?}` |
| GET      | `/dashboard`                     | Totais, contagens por tipo, recentes e em revisão    |

Listagens: `page` (1), `limit` (20, máximo 100), `sortBy`, `sortOrder` (desc), `search` quando aplicável. Companies/projects permitem `name`, `createdAt`, `updatedAt`; reports permitem `number`, `title`, `reportDate`, `createdAt`, `updatedAt`.

`GET /reports`: `companyId`, `projectId`, `reportTypeId`, `status`, `createdById`, `dateFrom`, `dateTo`, `search` por número/título. Datas: AAAA-MM-DD. `GET /projects`: `companyId`, `status`, `search`. Companies: `status`, `search`.

## Telas disponíveis

Login, dashboard, empresas/listagem/criação/detalhe/edição/arquivamento, obras/listagem/criação/detalhe/edição/arquivamento, relatórios/listagem/filtros/criação/seletor de tipo/detalhe/edição de rascunho/revisão/aprovação/solicitação de correção.

Há formulário inicial em etapas específico por tipo, com os campos cadastrais e técnicos principais, inclusive materiais LP e manômetro TH. Fluxos completos de pontos, fotos, descontinuidades em lista, assinaturas e desenho ainda não fazem parte desta fase. Salvamento de rascunho é manual; autosave será incluído na fase dos formulários completos. Android e web compartilham os componentes; o APK e a execução em aparelhos não foram validados nesta etapa.

## Regras e decisões registradas

- Rascunho aceita número/título/data ausentes; envio exige esses campos comuns e os campos técnicos configurados pelo tipo. Não se inventaram requisitos técnicos obrigatórios.
- Correção usa `IN_REVIEW → DRAFT` com `revisionNotes` obrigatório e autoria da revisão; não se adicionou outro status. Reenvio limpa a nota.
- Edição normal é bloqueada em APPROVED/FINISHED. IN_REVIEW aceita edição apenas com `reports.review` e `reports.edit`.
- `reports.edit.allFields` permite edição completa aos cargos ADMIN/INSPECTOR nos status permitidos. Reviewer/operator têm edição de campos somente quando configurada em `ReportType.config.editableFieldsByRoleCode`; configuração inicial vazia bloqueia alterações desses cargos. A configuração é feita administrativamente no banco nesta etapa; a tela administrativa de políticas virá depois.
- Exemplo de configuração: `{ "submissionRequiredKeys": ["testFluid"], "editableFieldsByRoleCode": { "OPERATOR": ["specificData.observation"], "REVIEWER": ["specificData.observation"] } }`. A autorização usa caminhos exatos, inclusive para alterações/remoções dentro de objetos.
- Tipos novos podem usar `config.customFields` com `text/number/boolean/date` e obrigatoriedade configurável. Schemas técnicos mais complexos podem ser adicionados ao registro compartilhado.
- `version` é obrigatório para atualização/transição/exclusão; conflito retorna 409. A empresa da obra e os vínculos/tipo do relatório são imutáveis após criação nesta fundação, evitando inconsistências históricas.
- Não há unicidade nem numeração automática do relatório. O SHA-256 de mídia possui restrição única para impedir duplicidades concorrentes quando o upload for implementado.
- FINISHED requer geração de PDF. Como os templates finais foram explicitamente adiados, a ação retorna **501 PDF_NOT_READY** e preserva APPROVED, sem registrar finalização fictícia.
- Refresh tokens são JWTs separados, armazenados somente por SHA-256, rotacionados a cada uso, com detecção de reuso e revogação da família. Logout revoga refresh; access token previamente emitido expira em 15 minutos por padrão. Usuário desativado é bloqueado em toda requisição.
- Web guarda a sessão em `sessionStorage` da aba; Android usa Expo SecureStore. Não há funcionalidade offline nesta etapa.
- Não há fileserver público. A implementação local de storage rejeita traversal, caminhos absolutos e links, e não sobrescreve arquivos.

## Próximas etapas

Formulários completos e autosave; pontos/mídia e uploads Multer com validação MIME/limite/hash calculado pelo backend; editor SVG; templates HTML/Puppeteer e versionamento de PDFs; assinaturas; gestão de usuários/cargos e políticas; treinamentos; SMTP. Auditoria de login e CRUD/transições já é gravada; consulta administrativa da auditoria virá depois. Não foram instalados Multer/Puppeteer/SMTP, pois ainda não são usados.
