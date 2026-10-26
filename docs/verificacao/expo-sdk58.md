# Expo Go — SDK 58

Atualizado em 26/10/2026 para abrir no Expo Go SDK 58 instalado no iPhone do usuário.

- Expo 58.0.19, React Native 0.88.0 e React/React DOM 19.3.0.
- Pacotes nativos alinhados ao `bundledNativeModules.json` do Expo 58. Overrides do monorepo atualizados e instalação deduplicada, incluindo React e React Native.
- Referências de componentes migradas para `ViewInstance`, `ScrollViewInstance` e `TextInputInstance`, conforme a API TypeScript estrita do React Native novo. Preservados os comportamentos de teclado, rolagem e seleção.
- Scripts de desenvolvimento e compilação resolvem o CLI e o autolinking a partir do workspace do app. Assim funcionam tanto com dependências na raiz quanto em `apps/app/node_modules`.
- `package-lock.json` atualizado para instalação reproduzível.
- Testes dos serviços mobile resolvem os módulos Expo a partir do workspace do app, incluindo o serializador real de uploads, sem depender da posição física de `node_modules`.

## Validação

- `expo install --fix`: dependências alinhadas.
- `expo-doctor`: 20/20 verificações passaram, sem módulos nativos duplicados.
- TypeScript e ESLint do app passaram; sintaxe dos scripts validada.
- 9 testes dos scripts de implantação e caminhos de compilação passaram.
- `npm test`: 27 arquivos e 159 testes passaram.
- Exportação limpa web, iOS e Android concluída, incluindo bytecode Hermes das plataformas nativas.
- Fluxo de desenho no Chromium com API simulada passou: extremidades e encaixe, medidas, bloqueio de imagem, ordem, grupos, duplicação, salvar/reabrir e mensagens de erro.
- `npm run dev:mobile` iniciou na porta 8085 e verificou a API online. Manifesto iOS respondeu HTTP 200 com `sdkVersion: 58.0.0`.

A execução nativa no iPhone ainda depende de o usuário abrir o projeto pelo Expo Go. Não foi gerado APK/IPA nem realizada publicação na VPS nesta atualização.

## Uso

```sh
npm run dev:mobile
```

O comando limpa o cache e usa a API HTTPS online já configurada. Feche o projeto antigo no Expo Go e leia o novo QR code com o celular na mesma rede do computador.

Após trocar o SDK, o próximo APK pode ser gerado com `npm run apk -- --clean` para regenerar o projeto Android com o template nativo novo.

Referências: [atualização do SDK](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/), [SDK 58](https://expo.dev/changelog/sdk-58), [migração do Router](https://docs.expo.dev/router/migrate/sdk-57-to-58/).
