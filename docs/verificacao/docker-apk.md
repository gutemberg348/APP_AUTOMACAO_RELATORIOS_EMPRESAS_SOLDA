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

O APK completo não foi gerado nesta preparação. A validação do certificado HTTPS, acesso externo e instalação do APK em aparelho ficam para depois da configuração da VPS, conforme `docs/publicacao-vps-apk.md`. As chaves de assinatura só são criadas quando o comando de build APK é executado; não foram criadas para os testes de ferramentas.
