# Publicação na VPS e APK Android

Servidor informado: `187.127.5.118`. Painel: `https://admin-weld.testes-techcode.shop`. API e APK: `https://api-weld.testes-techcode.shop`.

Esta configuração usa Docker para banco, API e painel, com Nginx instalado na VPS para os domínios e HTTPS. Os arquivos HTTP iniciais podem ser instalados antes de existir certificado; Certbot adiciona TLS e redirecionamento. O APK usa HTTPS. Nada foi publicado na VPS nesta preparação.

## 1. Preparar o servidor

Os registros DNS A dos dois subdomínios devem apontar para `187.127.5.118`. Se houver registros AAAA, devem apontar para um IPv6 funcional dessa VPS. Deixe as portas 80 e 443 acessíveis. Instale Docker com Compose v2, Node.js 22.13+ e Nginx. Os comandos de Nginx abaixo usam o layout Debian/Ubuntu.

O projeto foi clonado em `/var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA`. Exclua do envio `node_modules`, `apps/app/android`, `apps/app/ios`, `.expo`, `dist`, `.android-signing`, `artifacts`, `.env` local e arquivos de verificação. Os segredos de produção serão criados na VPS.

Na raiz do projeto, execute:

```sh
npm run setup:production -- --admin-email SEU_EMAIL
npm run docker:production:check
npm run docker:production
```

O setup gera `.env.production` com segredos e uma senha inicial aleatória. Leia `ADMIN_EMAIL`/`ADMIN_PASSWORD` nesse arquivo para entrar no painel. Executá-lo outra vez preserva o arquivo. O seed cria somente o primeiro administrador quando ainda não existe uma conta com esse cargo. Depois disso, preserva as contas, senhas e alterações feitas no painel, inclusive alterações de e-mail, inativações e exclusões. Para escolher sua senha inicial, edite `ADMIN_PASSWORD` antes da primeira subida.

### Recuperar a senha inicial

O login inicial é `ADMIN_EMAIL` e a senha inicial é `ADMIN_PASSWORD` do arquivo `.env.production` real, sem `.example`. Editar esse arquivo depois da criação da conta não altera sua senha no banco. Um container já iniciado também mantém as variáveis antigas até ser recriado; `docker compose restart` não carrega as novas variáveis.

Para aplicar explicitamente a senha do ENV ao administrador, com `scripts/reset-admin-password.cjs` disponível na VPS:

```sh
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
docker compose --env-file .env.production -f docker-compose.production.yml up -d --no-deps --force-recreate --wait api
docker compose --env-file .env.production -f docker-compose.production.yml exec -T api node < scripts/reset-admin-password.cjs
```

Antes de executar, confira `ADMIN_EMAIL` com o e-mail atual da conta e uma `ADMIN_PASSWORD` com pelo menos 12 caracteres e no máximo 72 bytes. O script lê as variáveis dentro do container, atualiza somente a conta com cargo `ADMIN` desse e-mail, restaura e ativa essa conta, invalida suas sessões anteriores e registra a recuperação na auditoria. Não imprime a senha nem apaga empresas, obras ou relatórios. A aplicação cotidiana do seed continua preservando senhas existentes. Os testes de implantação verificam a nova senha, preservação dos demais usuários e rejeição de credenciais inválidas ou contas de outra função.

O comando Docker aplica migrations, faz o seed e espera a saúde dos serviços. Banco e imagens/PDFs ficam nos volumes `weldcosta-production_postgres_data` e `weldcosta-production_report_storage`. Esta é uma instalação de produção separada do banco local de desenvolvimento; os dados locais não são copiados automaticamente.

| Serviço    | Endereço interno na VPS          |
| ---------- | -------------------------------- |
| API        | `http://127.0.0.1:13301`         |
| Painel     | `http://127.0.0.1:18085`         |
| PostgreSQL | Rede Docker, sem porta publicada |

As portas 13301/18085 ficam no loopback, destinadas ao Nginx da VPS. O Compose local existente permanece independente.

## 2. Instalar o arquivo Nginx com os dois domínios

Na raiz do projeto na VPS:

```sh
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo install -m 644 docker/nginx/weldcosta.conf /etc/nginx/sites-available/weldcosta.conf
for old in api-weld.conf admin-weld.conf; do
  if [ -L "/etc/nginx/sites-enabled/$old" ]; then
    sudo unlink "/etc/nginx/sites-enabled/$old"
  fi
done
sudo ln -sfn /etc/nginx/sites-available/weldcosta.conf /etc/nginx/sites-enabled/weldcosta.conf
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

`weldcosta.conf` reúne painel e API. Os arquivos individuais continuam disponíveis como alternativa; ative somente uma das opções. Os comandos acima desativam apenas os links antigos deste projeto. Se esses domínios tiverem outra configuração, edite o bloco existente, evitando duplicação de `server_name`. Depois de configurar HTTPS, preserve o arquivo da VPS editado pelo Certbot nas atualizações do aplicativo.

Confirme primeiro o HTTP:

```sh
curl --fail http://api-weld.testes-techcode.shop/health
curl --fail -I http://admin-weld.testes-techcode.shop/
```

Instale Certbot e o plugin Nginx conforme o sistema operacional da VPS. Depois:

```sh
sudo certbot --nginx --redirect -d api-weld.testes-techcode.shop -d admin-weld.testes-techcode.shop
sudo certbot renew --cert-name api-weld.testes-techcode.shop --dry-run
curl --fail https://api-weld.testes-techcode.shop/health
curl --fail https://admin-weld.testes-techcode.shop/api/health
```

O `/health` deve retornar `{"success":true,"data":{"status":"ok"}}`. O painel usa `/api` na própria origem; o container encaminha essas chamadas à API. O APK usa o domínio da API diretamente. CORS permite o domínio HTTPS do painel. Os proxies aceitam o tamanho necessário aos tutoriais de até 100 MB e esperam até 300 segundos para envio/geração de PDF.

O teste acima seleciona somente o certificado que reúne os dois domínios do Weldcosta. Sem `--cert-name`, `renew --dry-run` testa todos os certificados da VPS. `--dry-run` faz uma simulação e não salva novos certificados. Se a emissão e instalação já tiveram sucesso, uma falha `rateLimited / Service busy; retry later` na simulação não invalida o certificado ativo: repita apenas o teste específico mais tarde, sem solicitar outra emissão. Referência: [renovação e seleção de certificado no Certbot](https://eff-certbot.readthedocs.io/en/stable/using.html#renewing-certificates).

O Nginx da VPS substitui `X-Forwarded-For` com o IP do cliente. A API confia em um salto de proxy em produção para distinguir clientes no limite de tentativas de login.

## 3. Gerar o APK neste PC

Na raiz do projeto Windows, com dependências instaladas:

```powershell
npm run apk:check
npm run apk
```

O primeiro comando confere Java e Android SDK. O segundo confirma a API HTTPS em `/health`, prepara o projeto Android, configura assinatura de release e usa o Gradle Wrapper para `:app:assembleRelease`. Não precisa iniciar Metro nem entrar no EAS. O SDK pode ser informado em `ANDROID_HOME`; `JAVA_HOME` seleciona o JDK.

No Windows, o script associa temporariamente o projeto a uma letra de unidade livre, usando `subst`, e compila por esse caminho curto. Não move nem copia o projeto. Quando o caminho de build muda, renova os caches gerados de CMake e autolinking, preservando fontes, arquivos enviados e chave de assinatura. Também limita o comprimento dos nomes de objetos CMake a 240 caracteres. Isso evita o erro `ninja: error: mkdir(...react_codegen_safeareacontext...): No such file or directory` provocado pelos caminhos extensos do build nativo. A unidade criada pelo script é liberada ao terminar; uma associação preexistente ao projeto é reutilizada e preservada. Referências: [subst no Windows](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/subst) e [CMAKE_OBJECT_PATH_MAX](https://cmake.org/cmake/help/latest/variable/CMAKE_OBJECT_PATH_MAX.html).

O autolinking nativo é normalizado para essa unidade para evitar misturar raízes `C:` e `W:` no codegen. Já o empacotamento JavaScript usa `scripts/expo-android-bundle.cjs` para executar Metro no caminho físico do projeto, onde os vínculos de workspaces do npm e os hashes de arquivos concordam. Essa adaptação é exclusiva do build Windows e não modifica a configuração do Expo Go ou do painel web.

Nesse build Windows, a compilação incremental do Kotlin é desativada: alguns módulos Expo mantêm o caminho físico, e os caches incrementais não conseguem relativizar esses arquivos contra a unidade virtual. Os demais caches do Gradle continuam disponíveis.

O prebuild usa `--no-clean` para atualizar a pasta Android existente e aproveitar os arquivos nativos já compilados. O Expo SDK 57 recria essa pasta por padrão; repetir isso em todo build descarta esses caches. Se precisar recriar o projeto Android gerado, use `npm run apk -- --clean`; a chave em `.android-signing` continua fora dessa pasta.

Saída: **`artifacts/android/weldcosta-release.apk`**. O arquivo `artifacts/android/build-info.json` registra URL da API, version code, horário e SHA-256. O APK contém seu bundle e acessa a API publicada; não usa o Expo do computador.

Para compilar enquanto a VPS ainda está sendo preparada, mantendo a mesma URL final:

```powershell
npm run apk -- --skip-api-check
```

Esse APK poderá conectar depois que a API HTTPS estiver publicada. Para outro servidor ou para retomar um version code anterior em outra máquina:

```powershell
npm run apk -- --api-url https://api-weld.testes-techcode.shop --version-code 10
```

O version code cresce a cada build concluído. A assinatura é criada uma vez em `.android-signing` e reutilizada. **Guarde um backup dessa pasta**, incluindo `credentials.json`, `weldcosta-release.jks` e `last-build.json`, para atualizar o app instalado. Essa pasta contém material privado e é excluída do Git e das imagens Docker.

As variáveis do build são passadas ao processo, preservando `apps/app/.env` usado no Expo local. A URL da API é registrada como entrada da tarefa Gradle de bundle: trocar a URL faz o bundle ser reconstruído, evitando reutilizar um APK apontado ao servidor anterior. A configuração pública dos domínios fica em `config/deployment.json`; o arquivo Nginx ativo e CORS também devem acompanhar uma eventual mudança de domínio.

## Atualização e diagnóstico

### Gestão de usuários

O administrador acessa **Usuários** no menu lateral do painel. No celular, o acesso fica em **Mais → Usuários**. É possível cadastrar, editar nome/e-mail/telefone/perfil, alterar senha, ativar, inativar, excluir e restaurar contas. Exclusão mantém os relatórios e o histórico associados; as contas aparecem no filtro **Excluídos** para restauração. O e-mail de uma conta excluída permanece reservado.

Em **Pessoas e assinaturas**, o administrador também pode marcar **Esta pessoa terá login?**, aproveitando o e-mail do cadastro e informando perfil/senha. Pessoa e usuário são criados juntos. A atualização inclui a migration aditiva `202610140002_person_login`; cadastros existentes permanecem sem login até essa opção ser escolhida.

Depois de enviar esta atualização ao Git, execute na VPS:

```sh
cd /var/www/solda/APP_AUTOMACAO_RELATORIOS_EMPRESAS_SOLDA
git pull origin master
npm run docker:production
```

O comando reconstrói API/painel, aplica a migration `202610140001_user_management` e cadastra as permissões. Atualize a página do painel; se estiver usando um APK anterior, gere um novo neste PC com `npm run apk` para incluir a área de usuários. Os testes e detalhes estão em [verificação de usuários](verificacao/usuarios.md).

### Diagnóstico de build

Se o build apresentar `TS2307` para `../../services/storage/local-storage-provider`, confira se os arquivos `apps/api/src/services/storage/local-storage-provider.ts` e `storage-provider.ts` estão no repositório. A regra de arquivos privados deve ser `/storage/` (somente a pasta de dados da raiz). A regra `storage/` também exclui a pasta de código, fazendo o build funcionar no PC e falhar em um clone novo. Inclua os dois arquivos de código no commit, envie a correção e atualize a VPS antes de reconstruir. Os erros `TS7006` derivados desse módulo ausente são consequência da falta das declarações de tipo.

Após enviar código novo para a VPS:

```sh
npm run docker:production
npm run docker:production:logs
```

Para parar os serviços sem remover dados: `npm run docker:production:stop`. Faça backup do PostgreSQL e do volume de arquivos antes de migrations. Não remova volumes na atualização. O APK só precisa de novo build quando o frontend/app mudar; alterações da API entram pelo servidor.

O build APK completo e a conexão em um aparelho precisam ser conferidos após a publicação. `apk:check` verifica ferramentas, não garante que todas as dependências nativas já estejam baixadas; Gradle pode baixá-las no primeiro build.

Referências: [build local Expo](https://docs.expo.dev/guides/local-app-production/), [assinatura Android/React Native](https://reactnative.dev/docs/signed-apk-android), [proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) e [HTTPS com Certbot](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal).
