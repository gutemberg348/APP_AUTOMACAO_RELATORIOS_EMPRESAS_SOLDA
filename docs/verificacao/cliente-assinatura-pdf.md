# Cliente na conclusão do PDF — 31/10/2026

- Nos seis modelos (EVS, EVD, LP, TH, ME e RDO), o campo CLIENTE tem linha de assinatura em branco, nome da empresa vinculada abaixo em maiúsculas e data em branco.
- O nome vem de `report.company.name`, inclusive em relatórios antigos. Não depende de cadastrar um representante ou preencher novamente o relatório.
- Nomes, registros e imagens de representantes já cadastrados permanecem no aplicativo e no banco, mas não são impressos nesse campo. Outros responsáveis mantêm nomes, registros, datas e assinaturas.
- A geração não tenta carregar o arquivo da assinatura de CLIENTE, pois ele não é usado no PDF. Um arquivo antigo indisponível não bloqueia a geração por esse motivo.
- Preview, geração e download utilizam os templates atuais; baixar novamente após publicar a API. PDFs já baixados não são alterados.

Validação: build da API, 314 testes unitários aprovados e seis PDFs reais gerados em Chromium, reabertos e rasterizados. Conferidos linha vazia, nome da empresa, outras assinaturas e paginação. Evidências locais: `artifacts/client-signature/`.

Publicação: após enviar o código ao repositório, `git pull origin master && npm run docker:production:api` na pasta do projeto na VPS. Esta regra do PDF não exige recompilar o APK.
