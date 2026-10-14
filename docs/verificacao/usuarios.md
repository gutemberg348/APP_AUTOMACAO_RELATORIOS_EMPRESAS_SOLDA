# Gestão de usuários — 14/10/2026

O administrador encontra **Usuários** no menu lateral ou em **Mais → Usuários** no celular. A área oferece cadastro, edição de nome/e-mail/telefone/perfil, alteração de senha, ativação, inativação, exclusão e restauração, com pesquisa, filtros e paginação.

Os perfis disponíveis são Administrador, Revisor, Inspetor, Operador e Visualizador. O acesso à gestão é controlado por permissões na interface e na API. As senhas exigem ao menos 12 caracteres e no máximo 72 bytes; não são retornadas pela API nem incluídas na auditoria.

Excluir uma conta retira seu acesso e a move para **Excluídos**, preservando relatórios e histórico. É possível restaurá-la nesse filtro. Seu e-mail continua reservado para evitar associar outra pessoa à mesma identidade. O administrador não pode inativar, excluir ou retirar o próprio perfil de administrador; a API também protege o último administrador ativo contra alterações simultâneas.

Alterações de senha, perfil, status e exclusão invalidam as sessões anteriores do usuário afetado. Os formulários preservam o preenchimento quando há erro, mostram a orientação necessária e oferecem recarregar em caso de alteração concorrente. Modais de senha usam rolagem com ajuste ao teclado.

## Verificações

- 34 testes de integração passaram em banco PostgreSQL descartável, incluindo autenticação, permissões, CRUD, concorrência, recuperação de conta e preservação de relatórios.
- 89 testes unitários e 9 testes de implantação passaram.
- Build da API e verificações TypeScript/ESLint passaram. Exportação Expo para web, iOS e Android passou.
- Chrome/Playwright com API simulada: cadastro, erros de preenchimento, edição, senha, inativação/ativação, exclusão/restauração, restrições do próprio administrador, navegação móvel e campo visível com viewport reduzida para simular teclado. Nenhum erro de execução ou transbordamento horizontal encontrado.
- API Docker local reconstruída e migration aplicada: saúde HTTP 200. Antes e depois, permaneceram 1 usuário, 3 empresas, 3 obras, 7 relatórios e 27 pontos. Nenhuma conta real teve senha ou status alterados na verificação.

Capturas locais: [painel](usuarios-desktop.png) e [celular](usuarios-mobile.png). A simulação do navegador não substitui validação em aparelhos físicos. Esta atualização ainda precisa ser enviada/publicada na VPS e incluída em um novo APK; o APK anterior não contém essa área.

## Login opcional no cadastro de pessoas

No cadastro ou edição de uma pessoa sem conta vinculada, o administrador pode marcar **Esta pessoa terá login?**. O e-mail informado passa a ser obrigatório; nome, e-mail e telefone são aproveitados para criar o usuário. São pedidos perfil de acesso (sugestão: Inspetor), senha e confirmação. Pessoa e usuário são salvos na mesma transação, sem criar cadastro parcial em caso de erro. Senhas e e-mails duplicados recebem orientação mantendo o preenchimento.

A opção também aparece no cadastro de pessoa aberto dentro do relatório. Pessoas sem login continuam funcionando como antes. Uma pessoa com login mostra a conta, seu perfil/status e **Gerenciar login**, sem pedir novamente a senha. Editar o contato ou a disponibilidade da pessoa nos relatórios não altera a conta de acesso; essas alterações ficam em Usuários.

A migration aditiva `202610140002_person_login` vincula pessoa e usuário. Foram aprovados 38 testes de integração (incluindo quatro novos cenários de login opcional), build, TypeScript, ESLint e exportação Expo web/iOS/Android. Verificação no navegador com API simulada cobriu criar e adicionar login, confirmação de senha, duplicidade, perfil escolhido, opção desligada, acesso restrito, conta vinculada e campo visível na simulação do teclado. Capturas: [cadastro no painel](pessoa-login-desktop.png) e [cadastro no celular](pessoa-login-mobile.png).

## Publicação

Após enviar os arquivos ao Git, execute na raiz do projeto na VPS:

```sh
git pull origin master
npm run docker:production
```

O Compose aplica a migration aditiva, executa o seed de permissões e reconstrói API/painel. O seed preserva os administradores existentes, sem recriar o e-mail inicial após uma alteração pelo painel. Para atualizar o app instalado, gere outro APK neste PC com `npm run apk`.
