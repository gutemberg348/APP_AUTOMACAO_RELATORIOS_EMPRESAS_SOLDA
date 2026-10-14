# Preparação de produção e build APK

Configuração pública: `config/deployment.json`, com VPS `187.127.5.118`, painel `https://admin-weld.testes-techcode.shop` e API `https://api-weld.testes-techcode.shop`.

Foram criados o Compose de produção, imagem do painel, arquivos Nginx para a VPS, setup de segredos separados e scripts npm de build APK com assinatura persistente. A API ganhou configuração de confiança no proxy, habilitada apenas no ambiente de produção/integração. Os arquivos locais de ambiente foram preservados e não foi feita publicação externa.

Verificações realizadas:

- Imagens `weldcosta-web:verification` e `weldcosta-api:verification` construídas com sucesso.
- Os dois arquivos Nginx da VPS passaram em `nginx -t` usando a imagem oficial.
- Compose de produção validado e iniciado em um projeto temporário com portas/volumes próprios. Health checks de banco, API e painel passaram.
- Login através do Nginx, listagem dos cinco tipos, criação de relatório de teste e PDF Chromium pela rota do proxy passaram. A navegação profunda do painel retornou o SPA; assets inexistentes e rotas da API inexistentes retornaram 404.
- Painel aberto no navegador em 390 × 844 px, autenticado no banco temporário; requisições usaram `/api` na mesma origem, com relatório e status visíveis, sem erro de runtime. Captura: `docker-production-panel.png`.
- Containers/volumes temporários removidos ao finalizar; o Compose local continuou rodando.
- `npm run apk:check` encontrou JDK 17 e Android SDK. Prebuild Android passou. O Gradle Wrapper 9.3.1 carregou o projeto, a configuração de assinatura e a tarefa `assembleRelease`; `:app:tasks --all` terminou com `BUILD SUCCESSFUL`.
- Uma tarefa Gradle temporária confirmou que o release seleciona `weldcostaRelease` e que o bundle registra `https://api-weld.testes-techcode.shop` como entrada; terminou com `BUILD SUCCESSFUL`. O script de verificação temporário foi removido.
- Três testes de automação verificaram URL pública HTTPS, reaplicação da assinatura sem duplicação, geração/preservação de credenciais e validação do ambiente de produção.
- Typecheck e lint passaram; 85 testes unitários e 24 testes de integração passaram. A nova integração verifica limitação de login por IP atrás do proxy.

Um primeiro teste de geração dos cinco PDFs excedeu 90 segundos durante compilação/empacotamento concorrentes. A repetição sem esses builds concluiu os 24 testes de integração com sucesso, incluindo os cinco PDFs, em 80,66 segundos.

O APK completo não foi gerado na preparação inicial descrita acima. As chaves de assinatura não foram criadas para aqueles testes de ferramentas.

## Build Windows concluído em 13/10/2026

O primeiro build completo falhou em `react_codegen_safeareacontext` por comprimento de caminho no Ninja. O script passou a compilar os módulos nativos em uma unidade temporária `subst`, normalizar o autolinking nessa unidade e executar Metro no caminho físico do workspace. A combinação evita tanto o caminho longo quanto os conflitos entre raízes `C:` e `W:` no codegen e nos vínculos do npm.

- `npm run apk` concluiu `:app:assembleRelease` com `BUILD SUCCESSFUL`, incluindo ARM64, ARM de 32 bits, x86 e x86_64. A reconstrução completa, ainda com os caches Kotlin antigos, levou 27 min 20 s.
- Artefato: `artifacts/android/weldcosta-release.apk`, 107.989.118 bytes, pacote `com.weldcosta.inspecoes`, versão `0.1.0`, version code `1`, Android mínimo API 24 e target API 36.
- `apksigner verify --verbose --print-certs` validou a assinatura v2, com certificado `CN=Weldcosta, OU=Inspecoes, O=Weldcosta, C=BR`, RSA de 3072 bits.
- A URL `https://api-weld.testes-techcode.shop` foi encontrada no bundle dentro do APK. O SHA-256 conferiu com `build-info.json`: `62cac86ffe0822111668f67e32cadd0334fdebba398e7025fe1f5500e654271a`.
- Sete testes de automação passaram, cobrindo URL HTTPS, assinatura persistente, credenciais de produção, unidade temporária/reutilizada, migração dos caches, normalização do autolinking e execução do bundle no caminho físico.
- O script também passou a usar `prebuild --no-clean` e desativar compilação incremental Kotlin no build Windows. O prebuild posterior reutilizou Android e preservou o log de objetos compilados, evitando descartar a compilação nativa em toda geração.
- Uma tarefa Gradle temporária conferiu a configuração final: limite CMake de 240 caracteres no app, bundle usando `expo-android-bundle.cjs` e `kotlin.incremental=false`. Terminou com `BUILD SUCCESSFUL` em 33 s; o arquivo de verificação e a unidade temporária foram removidos.

A instalação e o login desse APK em um celular físico ainda precisam ser conferidos. As verificações de teclado e áreas seguras realizadas no emulador estão em `teclado-safe-area.md`. A assinatura privada permanece em `.android-signing`, fora do Git e do APK.
