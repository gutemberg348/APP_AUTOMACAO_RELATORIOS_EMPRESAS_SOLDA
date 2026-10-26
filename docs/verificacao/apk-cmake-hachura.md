# APK no Windows e densidade da hachura

26/10/2026.

O log local do build de 13m07s identificou falha em `:expo-modules-core:buildCMakeRelWithDebInfo[armeabi-v7a]`: `ninja: error: manifest 'build.ninja' still dirty after 100 tries`. A pasta nativa resolvida pelo Expo ficava no caminho físico longo de `apps/app/node_modules/expo-modules-core/android/.cxx`, apesar do projeto principal usar unidade SUBST. Havia avisos do CMake de que arquivos de objeto não cabiam no limite de caminho.

O script passa a configurar `buildStagingDirectory` dos módulos Android em `.android-native/<projeto>` na raiz do workspace, antes que o plugin raiz Expo avalie as bibliotecas. A pasta é ignorada pelo Git. A revisão dos caches foi incrementada para renovar os intermediários nativos antigos uma vez; fontes e assinatura são preservadas. O patch permanece idempotente após prebuild.

A hachura nova usa espaçamento 4 (antes 8). O usuário pode diminuir até 2, em passos de 1. A renderização SVG/PDF usa o mesmo espaçamento e a validação compartilhada aceita o novo limite. Hachuras existentes preservam o valor salvo e podem ser ajustadas. Atualizar a API na VPS antes de salvar espaçamentos menores que 6. Sem migração de banco.

Validações: 9 testes dos scripts de implantação, 160 testes unitários, TypeScript do app/API e ESLint dos arquivos de desenho passaram. Teste da hachura verifica mais de 1,8× o número de traços com espaçamento 4 em relação a 8, direção, espessura fina, recorte e dados válidos.

A compilação release real passou por `expo-modules-core:buildCMakeRelWithDebInfo[arm64-v8a]` e `[armeabi-v7a]`, que falhava no build anterior, usando `.android-native/_expo-modules-core` como staging. Log completo em `artifacts/android/apk-build.log` (arquivo local ignorado).

**Resultado final:** `npm run apk` concluiu com `BUILD SUCCESSFUL in 24m 15s`, 603 tarefas. APK em `artifacts/android/weldcosta-release.apk`, version code 7, 100.965.441 bytes, API HTTPS online configurada. Assinatura v2 verificada pelo `apksigner verify --verbose`. SHA-256: `32793254c1bf3fa905f0553696683bbd307099a05ed1ca087085c5064f58087c`. Não foi instalado em aparelho nem enviado à VPS nesta verificação.

Referência da configuração: [Android Gradle — buildStagingDirectory](https://developer.android.com/reference/tools/gradle-api/8.3/com/android/build/api/dsl/Cmake#buildStagingDirectory).
