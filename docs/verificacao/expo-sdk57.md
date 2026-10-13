# Expo Go — SDK 57

Atualização realizada em 7 de outubro de 2026 para compatibilidade com o Expo Go SDK 57 informado pelo usuário.

## Alterações

- Expo 57.0.27, React Native 0.86.3 e React/React DOM 19.2.3.
- Constants, Font, Linking, Router, SecureStore, StatusBar, Screens, Safe Area Context, SVG e React Native Web alinhados ao `bundledNativeModules.json` oficial do SDK.
- Plataformas Android, iOS e web habilitadas; identificador iOS e suporte a iPad configurados.
- `npm run dev:app` inicia explicitamente em modo Expo Go e LAN, na porta 8085.
- Lockfile regenerado para resolver o conflito do npm entre as versões 56 e 57 do Router; instalação limpa com `npm ci`, sem ignorar validação de peers. As versões diretas dos outros pacotes foram preservadas.
- TypeScript 5.9 preservado no monorepo por meio de `expo.install.exclude`; a validação de dependências nativas permanece habilitada.
- `API_BIND_ADDRESS` permite publicar a API Docker na LAN quando configurado como `0.0.0.0`; o padrão do repositório continua sendo `127.0.0.1`.

Em desenvolvimento local, endereços de API privados usam o host LAN informado pelo Expo no app e o host do navegador na web, preservando porta e caminho. Isso evita que uma mudança de IP do computador interrompa a conexão do celular. URLs públicas e builds de produção mantêm `EXPO_PUBLIC_API_URL`. Túneis do Expo não são usados como host da API. Na web pela LAN, o endereço deve também estar autorizado em `CORS_ORIGIN` da API.

### Correção de dependências e conexão em 11/10/2026

Foram encontrados o IP anterior `192.168.0.8` na configuração local e módulos transitivos fora das versões do SDK: Worklets 0.13.0, Reanimated 4.7.1 e Gesture Handler 3.3.0. O IP atual verificado foi `192.168.0.3`; a API respondeu HTTP 200 em `/health` pela LAN. As três dependências foram alinhadas ao `bundledNativeModules.json` (0.10.1, 4.5.1 e 2.32.0) com overrides no workspace para evitar cópias incompatíveis. Expo Asset também é dependência explícita do app.

Após alterar dependências nativas, encerre o Metro anterior e execute `npm run dev:app:clean`. Feche completamente o Expo Go e leia o novo QR code. O erro `main has not been registered` é consequência de uma falha anterior de inicialização; corrigir apenas o endereço da API não resolve uma falha ao carregar `ExpoAsset`. Dependências e bundles podem ser verificados no computador, mas a confirmação da execução nativa exige abrir o projeto no aparelho com o Expo Go compatível.

Verificação desta correção: `expo-doctor` com 21/21 verificações, `expo install --check`, árvore de dependências sem duplicações de Worklets/Reanimated/Gesture Handler, TypeScript, ESLint, 70 testes unitários e exportação limpa web/iOS/Android. O fluxo de pontos foi novamente conferido no navegador em quatro larguras com API simulada. A versão instalada no Expo Go do iPhone e a execução nativa ainda precisam ser confirmadas no aparelho.

Se estiver usando a API Docker, aplique a imagem e o ambiente atuais com `docker compose up -d --no-deps api` depois de `docker compose build api`. Um simples `docker compose restart api` não atualiza as variáveis do container nem aplica uma imagem reconstruída. O banco e os arquivos ficam nos volumes existentes.

### Rota de conferência das fotos da galeria

O container antigo ainda em execução não possuía `POST /reports/media/check`; uma imagem válida reproduziu HTTP 404 com `Rota não encontrada`. A imagem atualizada foi aplicada somente ao serviço API, preservando os volumes e o Expo em execução. A mesma conferência retornou HTTP 200 com a impressão SHA-256; uma imagem inválida retornou `INVALID_IMAGE`, sem criar registros. A origem web atual da LAN também foi confirmada no CORS.

Cinco anexos já referenciados no banco existiam no armazenamento local, mas faltavam no volume Docker. Foram copiados apenas esses arquivos ausentes, sem sobrescrever arquivos existentes ou alterar registros. O fluxo de escolha por **Galeria de fotos** foi conferido no navegador com API simulada. A abertura do seletor nativo no iPhone continua dependendo de conferência no aparelho.

## Verificações

A atualização intermediária para SDK 56 passou em `expo install --check` e no TypeScript antes da migração para 57.

Na versão final:

- `npm ci`: instalação concluída.
- `npx expo install --check`: dependências alinhadas.
- `npx expo-doctor@latest`: 21 de 21 verificações aprovadas.
- `npm run typecheck`: API, app e shared aprovados.
- `npm run lint`: aprovado.
- `npm test`: 20 testes aprovados.
- `npm run build`: shared e API compilados.
- `npx expo export --platform all --clear`: web e bytecode Hermes de iOS/Android gerados.
- Saúde da API e login/logout do administrador verificados pelo IP da LAN.
- Manifesto de desenvolvimento solicitado como iOS: SDK `57.0.0`, três plataformas e endereço do computador na LAN confirmados.
- Smoke test no Chrome a 390 px: login real, dashboard e navegação para relatórios, sem erros de execução/console nem transbordamento horizontal.

Export em `apps/app/dist`:

| Plataforma | Bundle                                       |
| ---------- | -------------------------------------------- |
| Web        | `entry-3e093da825f9918189fc3375614d7049.js`  |
| iOS        | `entry-0085416fc9bb084b81ad1000b34af3e8.hbc` |
| Android    | `entry-d881a14f25f8829f06e66dc0e5998d4f.hbc` |

A geração dos bundles valida a resolução e a compilação das três plataformas. A abertura no Expo Go do aparelho físico depende da leitura do QR code pelo usuário; nenhum APK ou IPA foi gerado nesta atualização.

## Abrir o projeto

Com API em funcionamento e celular/computador na mesma rede Wi-Fi:

```sh
npm run dev:app
```

Para reiniciar após uma atualização de SDK, pare o servidor anterior com Ctrl+C e execute:

```sh
npm run start --workspace @weldcosta/app -- --clear
```

Feche o projeto antigo no Expo Go e leia o novo QR code. No iPhone/iPad, use a câmera do aparelho.

## Referências

- [Guia oficial de atualização do Expo SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/).
- [Notas de lançamento do SDK 56](https://expo.dev/changelog/sdk-56).
- [Notas de lançamento do SDK 57](https://expo.dev/changelog/sdk-57).
