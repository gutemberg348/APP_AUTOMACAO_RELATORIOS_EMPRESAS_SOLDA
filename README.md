# Weldcosta Inspeções Industriais

O frontend foi refinado com identidade visual, navegação adaptativa, formulários e componentes compartilhados. Consulte [docs/design-frontend.md](docs/design-frontend.md) para os detalhes e verificações de UI/UX.

Fundação real de um sistema modular de relatórios: Expo/React Native/Web + Express/TypeScript + Prisma/PostgreSQL, com npm workspaces. Escopo da primeira entrega e referências estão em [docs/primeira-entrega.md](docs/primeira-entrega.md) e [docs/referencias/README.md](docs/referencias/README.md).

## Requisitos

Node.js 22.13 ou superior, npm 10+, Docker/Compose. O frontend usa Expo SDK 57 e pode ser visualizado no Expo Go para Android e iOS. Android local exige JDK/Android SDK configurados; build em nuvem exige conta Expo/EAS. Não há Next.js, NestJS, Python, IA ou microserviços.

## Instalação local

Execute na raiz:

```sh
npm ci
npm run setup:env
npm run db:generate
npm run build
docker compose up -d postgres
npm run db:deploy
npm run db:seed
npm run dev:api
```

`setup:env` gera segredos locais distintos e preserva `.env` existente. Para acesso ao sistema, preencha **ADMIN_EMAIL** e **ADMIN_PASSWORD** no `.env` antes de executar o seed. A senha deve ter ao menos 12 caracteres e no máximo 72 bytes. Não existe conta ou senha padrão; o seed não sobrescreve senha de usuário existente e não importa dados dos PDFs.

Em outro terminal:

```sh
npm run dev:web
# ou, para Expo Go no Android/iOS
npm run dev:app
```

Web: `http://localhost:8085`; API: `http://localhost:3301`. O endpoint `/health` confirma a saúde do processo. A sessão web usa armazenamento da aba, a nativa usa SecureStore. Use HTTPS na publicação web para Safari/iPhone/iPad.

Para dispositivos em rede, copie `apps/app/.env.example` para `apps/app/.env` e configure `EXPO_PUBLIC_API_URL=http://IP-DO-COMPUTADOR:3301`. Com a API no Docker, defina `API_BIND_ADDRESS=0.0.0.0` no `.env` da raiz e execute `docker compose up -d api` para permitir acesso pela rede local. Adicione a origem do Expo web na LAN a `CORS_ORIGIN` da API. No emulador Android o host costuma ser `10.0.2.2`. O `.env` da raiz pertence à API/Compose; o `.env` do app define variáveis públicas do bundle. Nunca coloque segredos em `EXPO_PUBLIC_*`.

## Abrir no Expo Go

O projeto está alinhado ao SDK 57. Use o Expo Go correspondente, deixe o celular e o computador na mesma rede Wi-Fi e execute `npm run dev:app`. No iPhone/iPad, leia o QR code com a câmera; no Android, use o leitor do Expo Go. O comando inicia o servidor em modo Expo Go e LAN, na porta 8085.

Depois de trocar a versão do SDK, pare o servidor anterior com Ctrl+C e execute `npm run start --workspace @weldcosta/app -- --clear` para limpar o cache. Feche o projeto antigo no Expo Go e leia o novo QR code.

O TypeScript permanece na versão 5.9 do monorepo, excluído apenas da atualização automática do Expo. As dependências nativas seguem as versões recomendadas pelo SDK. A migração e as verificações estão em [docs/verificacao/expo-sdk57.md](docs/verificacao/expo-sdk57.md), seguindo o [guia oficial de atualização do Expo](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).

## Variáveis

| ENV                                           | Uso                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------- |
| DATABASE_URL                                  | Conexão PostgreSQL usada pelo Prisma/API local                                |
| POSTGRES_USER/PASSWORD/DB/PORT                | PostgreSQL no Compose; porta local padrão 5434                                |
| JWT_SECRET/JWT_EXPIRES_IN                     | Access JWT; segredo mínimo 32 caracteres; padrão 15m                          |
| REFRESH_TOKEN_SECRET/REFRESH_TOKEN_EXPIRES_IN | Segredo distinto; padrão 7d; durações aceitam s/m/h/d                         |
| PORT                                          | Porta API, padrão 3301                                                        |
| API_BIND_ADDRESS                              | Interface da API no Docker; padrão 127.0.0.1; 0.0.0.0 permite acesso pela LAN |
| CORS_ORIGIN                                   | Origens web permitidas, separadas por vírgula                                 |
| STORAGE_PATH                                  | Diretório privado, relativo a apps/api localmente; `/app/storage` no Docker   |
| PDF_CHROME_EXECUTABLE / PDF_DISABLE_SANDBOX   | Navegador do servidor para PDFs e configuração de sandbox                     |
| ADMIN_EMAIL/ADMIN_PASSWORD                    | Provisionamento optativo do primeiro administrador                            |
| SMTP_HOST/PORT/USER/PASS/FROM                 | Reservadas para a fase de e-mail; nenhum envio automático                     |
| EXPO_PUBLIC_API_URL                           | URL pública da API, configurada em apps/app/.env para o app                   |

## Banco e migrations

```sh
npm run db:generate
npm run db:deploy
npm run db:seed
# Depois de alterar schema.prisma, criar uma migration de desenvolvimento:
npm run db:migrate --workspace @weldcosta/api -- --name nome_da_alteracao
```

Migration inicial: `apps/api/prisma/migrations/202610070001_initial/migration.sql`. Os 17 modelos e índices estão descritos no documento da entrega. PostgreSQL usa volume persistente; relatórios não têm sequência ou número globalmente único.

## Docker e publicação

Para a VPS `187.127.5.118`, os arquivos de produção e o comando de APK local estão em [docs/publicacao-vps-apk.md](docs/publicacao-vps-apk.md). Domínios configurados: `admin-weld.testes-techcode.shop` e `api-weld.testes-techcode.shop`. Use `npm run setup:production -- --admin-email SEU_EMAIL` e `npm run docker:production` na VPS; depois de configurar Nginx/HTTPS, use `npm run apk` neste PC. O Compose abaixo continua sendo o ambiente local.

```sh
npm run setup:env
docker compose up -d --build
docker compose logs -f api
docker compose down
```

O Compose local aplica migrations e seed idempotente antes de iniciar a API; Expo roda fora do Docker. Volumes `postgres_data` e `report_storage` preservam banco e arquivos. `docker compose down` preserva volumes; não use `down -v` se precisar dos dados. O runtime da API executa como usuário `node`. O Compose de produção acrescenta o painel compilado, servido por `docker/nginx.conf`, e mantém portas internas no loopback para o Nginx da VPS. Os arquivos dos dois domínios ficam em `docker/nginx/`; a instalação e o HTTPS estão no guia de publicação.

```sh
# Export web; para publicar com o exemplo Nginx, configure API relativa antes:
# apps/app/.env: EXPO_PUBLIC_API_URL=/api
npm run export:web --workspace @weldcosta/app
```

Arquivos gerados: `apps/app/dist`. Não se realizou publicação externa.

## Android APK direto

Para gerar com o Gradle instalado neste PC: `npm run apk:check` e `npm run apk`, na raiz. Saída: `artifacts/android/weldcosta-release.apk`, já vinculado à API HTTPS configurada. Veja [publicação e APK](docs/publicacao-vps-apk.md) para assinatura, ferramentas e preparação da VPS. A alternativa EAS em nuvem segue abaixo.

```sh
cd apps/app
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
```

O perfil `preview` em `eas.json` gera APK para distribuição interna; configure `EXPO_PUBLIC_API_URL` no ambiente EAS apontando à API HTTPS acessível ao dispositivo. Não há publicação na Play Store. A alternativa EAS exige vincular sua conta/projeto Expo. `npm run android --workspace @weldcosta/app` inicia um build de desenvolvimento; `npm run apk` gera o APK de release local com assinatura própria.

## Verificações

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run build
npm run export:web --workspace @weldcosta/app
```

Testes unitários verificam schemas, workflow/permissões, dados-base e storage. Integração cria PostgreSQL e storage temporários, aplica migrations/seed e verifica autenticação/refresh, RBAC, CRUD, filtros, concorrência, coleções, upload/deduplicação e geração/finalização dos cinco PDFs. Os recursos temporários são removidos ao terminar e o banco de desenvolvimento é preservado.

## Limites desta fase

Estão disponíveis autenticação, empresas, obras, tipos, relatórios e dashboard; formulários dos cinco modelos com dados-base da obra preenchidos e editáveis, pontos/soldas/medições, descontinuidades, imagens e identificação dos responsáveis; prévia e PDF final gerados pelo backend. Veja [relatórios e PDFs](docs/relatorios-pdf.md) para campos, endpoints, configuração e fluxo. O [editor de desenhos técnicos](docs/desenhos-tecnicos.md) oferece malha isométrica/ortogonal, tubulações, símbolos, cotas informadas, pontos numerados, múltiplas pranchas, edição e PDF vetorial. Fotos podem ser identificadas e vinculadas aos pontos após o envio. Importação DWG/DXF, assinatura digital, autosave, treinamentos, SMTP e gestão de usuários permanecem pendentes. O salvamento do rascunho é manual.

A configuração do monorepo segue a [documentação Expo](https://docs.expo.dev/guides/monorepos/); Prisma 7 usa configuração e adaptador PostgreSQL conforme a [documentação oficial](https://www.prisma.io/docs/orm/v7). Versões utilizadas estão fixadas no lockfile.
