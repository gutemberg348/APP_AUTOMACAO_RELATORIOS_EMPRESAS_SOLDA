# Publicação na VPS e APK Android

Servidor informado: `187.127.5.118`. Painel: `https://admin-weld.testes-techcode.shop`. API e APK: `https://api-weld.testes-techcode.shop`.

Esta configuração usa Docker para banco, API e painel, com Nginx instalado na VPS para os domínios e HTTPS. Os arquivos HTTP iniciais podem ser instalados antes de existir certificado; Certbot adiciona TLS e redirecionamento. O APK usa HTTPS. Nada foi publicado na VPS nesta preparação.

## 1. Preparar o servidor

Os registros DNS A dos dois subdomínios devem apontar para `187.127.5.118`. Se houver registros AAAA, devem apontar para um IPv6 funcional dessa VPS. Deixe as portas 80 e 443 acessíveis. Instale Docker com Compose v2, Node.js 22.13+ e Nginx. Os comandos de Nginx abaixo usam o layout Debian/Ubuntu.

Envie o código para uma pasta, por exemplo `/opt/weldcosta`. Exclua `node_modules`, `apps/app/android`, `apps/app/ios`, `.expo`, `dist`, `.android-signing`, `artifacts`, `.env` local e arquivos de verificação. Os segredos de produção serão criados na VPS.

Na raiz do projeto, execute:

```sh
npm run setup:production -- --admin-email SEU_EMAIL
npm run docker:production:check
npm run docker:production
```

O setup gera `.env.production` com segredos e uma senha inicial aleatória. Leia `ADMIN_EMAIL`/`ADMIN_PASSWORD` nesse arquivo para entrar no painel. Executá-lo outra vez preserva o arquivo. O seed não troca a senha de administrador existente. Para escolher sua senha inicial, edite `ADMIN_PASSWORD` antes da primeira subida.

O comando Docker aplica migrations, faz o seed e espera a saúde dos serviços. Banco e imagens/PDFs ficam nos volumes `weldcosta-production_postgres_data` e `weldcosta-production_report_storage`. Esta é uma instalação de produção separada do banco local de desenvolvimento; os dados locais não são copiados automaticamente.

| Serviço    | Endereço interno na VPS          |
| ---------- | -------------------------------- |
| API        | `http://127.0.0.1:13301`         |
| Painel     | `http://127.0.0.1:18085`         |
| PostgreSQL | Rede Docker, sem porta publicada |

As portas 13301/18085 ficam no loopback, destinadas ao Nginx da VPS. O Compose local existente permanece independente.

## 2. Instalar os dois arquivos Nginx

Na raiz do projeto na VPS:

```sh
sudo install -m 644 docker/nginx/api-weld.conf /etc/nginx/sites-available/api-weld.conf
sudo install -m 644 docker/nginx/admin-weld.conf /etc/nginx/sites-available/admin-weld.conf
sudo ln -s /etc/nginx/sites-available/api-weld.conf /etc/nginx/sites-enabled/api-weld.conf
sudo ln -s /etc/nginx/sites-available/admin-weld.conf /etc/nginx/sites-enabled/admin-weld.conf
sudo nginx -t
sudo systemctl reload nginx
```

Crie os links apenas na primeira instalação. Se esses domínios já tiverem configuração, edite o bloco existente, evitando duplicação de `server_name`.

Confirme primeiro o HTTP:

```sh
curl --fail http://api-weld.testes-techcode.shop/health
curl --fail -I http://admin-weld.testes-techcode.shop/
```

Instale Certbot e o plugin Nginx conforme o sistema operacional da VPS. Depois:

```sh
sudo certbot --nginx --redirect -d api-weld.testes-techcode.shop -d admin-weld.testes-techcode.shop
sudo certbot renew --dry-run
curl --fail https://api-weld.testes-techcode.shop/health
curl --fail https://admin-weld.testes-techcode.shop/api/health
```

O `/health` deve retornar `{"success":true,"data":{"status":"ok"}}`. O painel usa `/api` na própria origem; o container encaminha essas chamadas à API. O APK usa o domínio da API diretamente. CORS permite o domínio HTTPS do painel. Os proxies aceitam o tamanho necessário aos tutoriais de até 100 MB e esperam até 300 segundos para envio/geração de PDF.

O Nginx da VPS substitui `X-Forwarded-For` com o IP do cliente. A API confia em um salto de proxy em produção para distinguir clientes no limite de tentativas de login.

## 3. Gerar o APK neste PC

Na raiz do projeto Windows, com dependências instaladas:

```powershell
npm run apk:check
npm run apk
```

O primeiro comando confere Java e Android SDK. O segundo confirma a API HTTPS em `/health`, prepara o projeto Android, configura assinatura de release e usa o Gradle Wrapper para `:app:assembleRelease`. Não precisa iniciar Metro nem entrar no EAS. O SDK pode ser informado em `ANDROID_HOME`; `JAVA_HOME` seleciona o JDK.

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

As variáveis do build são passadas ao processo, preservando `apps/app/.env` usado no Expo local. A URL da API é registrada como entrada da tarefa Gradle de bundle: trocar a URL faz o bundle ser reconstruído, evitando reutilizar um APK apontado ao servidor anterior. A configuração pública dos domínios fica em `config/deployment.json`; os dois arquivos Nginx e CORS também devem acompanhar uma eventual mudança de domínio.

## Atualização e diagnóstico

Após enviar código novo para a VPS:

```sh
npm run docker:production
npm run docker:production:logs
```

Para parar os serviços sem remover dados: `npm run docker:production:stop`. Faça backup do PostgreSQL e do volume de arquivos antes de migrations. Não remova volumes na atualização. O APK só precisa de novo build quando o frontend/app mudar; alterações da API entram pelo servidor.

O build APK completo e a conexão em um aparelho precisam ser conferidos após a publicação. `apk:check` verifica ferramentas, não garante que todas as dependências nativas já estejam baixadas; Gradle pode baixá-las no primeiro build.

Referências: [build local Expo](https://docs.expo.dev/guides/local-app-production/), [assinatura Android/React Native](https://reactnative.dev/docs/signed-apk-android), [proxy Nginx](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) e [HTTPS com Certbot](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal).
