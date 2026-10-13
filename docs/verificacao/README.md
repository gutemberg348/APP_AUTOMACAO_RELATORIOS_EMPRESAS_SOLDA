# Verificação da primeira entrega — 07/10/2026

Este registro descreve a entrega inicial. A verificação atual de preenchimento, imagens e PDFs está em [Relatórios e PDFs — 08/10/2026](relatorios-pdf.md).

A verificação do editor isométrico, pontos numerados e pranchas vetoriais está em [Desenhos técnicos — 08/10/2026](desenhos-tecnicos.md).

- Schema Prisma validado e cliente gerado; migration inicial aplicada e seed executado no PostgreSQL local.
- Seed sem ADMIN_EMAIL/ADMIN_PASSWORD: nenhum usuário foi criado no banco de desenvolvimento.
- TypeScript strict, ESLint e build do backend/shared verificados.
- 20 testes unitários: schemas dos cinco tipos, regras de transição/permissões, configuração de campos, storage e traversal/links.
- 10 testes de integração executados em PostgreSQL Docker temporário: login, refresh/reuso/logout, RBAC, CRUD, associações, filtros, edição concorrente, correção/revisão/aprovação, bloqueio do PDF pendente e auditoria.
- Export Expo Web gerado e dependências conferidas com `expo install --check`.
- Fluxo verificado em Chrome via Playwright com API e banco temporário reais: login → empresa → obra → EVS → salvar rascunho → enviar à revisão → aprovar. Nenhum erro de JavaScript. As contas e registros de verificação ficaram somente no banco temporário, removido ao terminar.
- Login conferido em 1440px e 390px; relatório conferido em 390px. Capturas locais estão nesta pasta, ignoradas pelo Git.
- Dockerfile compilado; Compose com PostgreSQL e API verificado. Portas de desenvolvimento: API 3301 e Expo 8085, escolhidas para evitar outros aplicativos desta máquina.

APK Android, execução em aparelho e Safari/iPhone/iPad não foram verificados. Não há deploy de produção. Upload SHA-256, editor e PDFs finais ainda não são funcionalidades desta entrega.

Vitest foi atualizado para a linha 5. As dependências transitivas `deepmerge-ts` e `mysql2` usam overrides com versões corrigidas, validadas pelos comandos Prisma e testes. A auditoria das dependências da API/shared sem dependências de desenvolvimento retorna zero vulnerabilidades. O tooling Expo/React Native ainda possui alertas transitivos (incluindo `braces` e `node-forge` sem correção compatível indicada pela auditoria); o audit global não deve ser considerado limpo. Não se forçou downgrade do SDK para eliminar mensagens do auditor.
