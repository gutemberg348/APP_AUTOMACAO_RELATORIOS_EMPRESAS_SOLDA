# Perfis e empresas liberadas

| Perfil | Empresas e obras | Relatórios | Pessoas | Usuários | Tutoriais |
| --- | --- | --- | --- | --- | --- |
| Administrador | Todas; cadastra, edita e arquiva | Todos; cria, edita, analisa e aprova | Cadastro geral e responsáveis do relatório | Cadastra, edita, altera senha, ativa/inativa, exclui/restaura e libera empresas | Consulta e publica/edita/exclui |
| Gerente | Todas; cadastra, edita e arquiva | Todos; cria, edita, analisa e aprova | Cadastro geral e responsáveis do relatório | Sem gestão de usuários | Consulta |
| Inspetor | Apenas as liberadas; cadastra, edita e arquiva | Todos das empresas liberadas; cria, edita, analisa e aprova | Preenche responsáveis/assinaturas no relatório; sem cadastro geral | Sem acesso | Consulta |
| Operador | Seleciona empresa e obra liberadas no relatório; sem editar cadastros | Cria e preenche os próprios relatórios, envia para análise e baixa/compartilha PDF; não aprova | Preenche responsáveis/assinaturas no próprio relatório; sem cadastro geral | Sem acesso | Consulta |

Os quatro perfis acima são as opções de cadastro. Revisor e Visualizador permanecem nas contas antigas para preservar os registros, mas não podem ser escolhidos em novos cadastros. Ao editar uma dessas contas, selecione um perfil atual e confira as empresas liberadas; não há promoção automática para Gerente.

Todos os perfis começam na **Visão geral** após entrar ou abrir a raiz do app/painel. Essa opção aparece primeiro no menu; para o Operador, os números e relatórios exibidos continuam limitados às empresas liberadas e aos próprios relatórios.

## Liberar empresas

O administrador abre **Usuários → Novo usuário** ou **Editar dados**, escolhe **Inspetor** ou **Operador** e marca as empresas em **Empresas liberadas**. O campo permite pesquisar, marcar várias e remover acessos. No cadastro de uma pessoa com login, a mesma seleção acompanha a senha/perfil.

Sem empresas marcadas, a conta pode entrar, mas não terá empresas, obras ou relatórios disponíveis. A interface avisa isso durante o cadastro. Administrador e Gerente têm acesso a todas as empresas; não precisam de seleção. Quando um inspetor cadastra uma empresa nova, ela fica liberada para ele automaticamente.

Alterar empresas ou perfil invalida as sessões anteriores do usuário afetado. Ele entra novamente para carregar o acesso atualizado. Listas, buscas, filtros, estatísticas, obras, relatórios, fotos, assinaturas e PDFs respeitam o acesso na API, inclusive por URL direta. No caso do Operador, os relatórios também são filtrados pelo criador; informar outro criador nos filtros não amplia o acesso.

## Publicação

Depois de enviar as alterações ao Git, execute na VPS:

```sh
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
git pull origin master
npm run docker:production
```

A atualização aplica `202610140003_company_access` e atualiza as permissões dos perfis. O banco e os documentos são preservados. Em seguida, confira os usuários Inspetor/Operador e marque suas empresas. Para incluir a seleção de empresas e os menus no app instalado, gere um novo APK com `npm run apk` neste PC.

## Verificação

Build da API, TypeScript, ESLint e 116 testes unitários passaram. Os testes incluem escopos vazios/globais/restritos, propriedade dos relatórios, bloqueio de criação fora da empresa, gravação das empresas na transação de usuário, invalidação de sessões ao alterar o acesso e URLs diretas de obra/relatório/foto/PDF, com autenticação e banco simulados. A suíte com PostgreSQL não foi executada nesta etapa porque o Docker Desktop está desligado no PC; há cenários de integração para filtros, dashboard, alteração de empresas e invalidação de sessões em `apps/api/test/integration/company-access.test.ts`.

Exportação Expo web/iOS/Android aprovada. No Chrome/Playwright com API simulada, foram conferidos os quatro perfis, seleção múltipla de empresas, remoção/persistência da seleção, acesso global do Gerente, menus, fluxo empresa/obra/tipo do Operador e responsáveis preenchidos no relatório sem cadastro geral. Nenhum erro de execução ou transbordamento horizontal foi encontrado. Captura: [empresas liberadas](verificacao/empresas-liberadas-desktop.png). Não houve publicação na VPS nem novo build completo de APK nesta etapa.
