# Pincéis e marcações nas fotos

29/10/2026.

## Uso

- Atalho “Pincéis e cores” no desenho e nas observações. Paleta com caneta, caneta tinteiro, lápis, pincel e marca-texto, prévia de cada traço, cores e espessura entre 0,5 e 60. Marca-texto transparente. Borracha com ícone próprio remove traços/formas/textos tocados, preservando imagens e pontos de inspeção; desfazer recupera a exclusão.
- Nas fotos dos pontos e nas fotos adicionais, “Ver e pintar foto” abre a prévia com a foto inteira, zoom, desenho e texto. Funciona antes do primeiro upload e com fotos já enviadas. Usuários sem permissão de upload têm a prévia somente para consulta.
- “Salvar marcações” prepara a edição para o salvamento do relatório; o cartão explica que é preciso salvar o relatório para gravar e incluir no PDF. Cancelar descarta apenas a sessão atual de edição. A miniatura e a prévia mostram as marcações já preparadas.
- A pintura é vetorial e separada do arquivo original. A borracha não apaga pixels da foto. A validação de foto repetida continua baseada no SHA-256 da imagem original; pintar não libera a mesma foto para outro ponto.
- PDF compõe as marcações sobre a imagem sem cortar a foto nem mudar sua proporção. Textos digitados seguem o padrão de maiúsculas do documento. Fotos não marcadas seguem o caminho de renderização anterior.

## Persistência e falhas

`report_media.annotations` (JSONB opcional) armazena as marcações. Upload multipart e PATCH validam somente traços, formas e textos, cores HEX, limites e identificações únicas. A edição de mídia preserva arquivo, hash, vínculo com o ponto e legenda. Controle de versão, permissão e auditoria são mantidos. Edições pendentes continuam disponíveis após erro para nova tentativa; um upload idempotente com marcações mais novas atualiza as marcações sem criar outra foto.

## Verificações

- 169 testes em 28 arquivos passaram, incluindo serialização de pincéis, transparência por pixels da imagem final, proporção e bytes originais preservados, payload de upload, PATCH sem reenvio, falha/repetição, upload idempotente e rejeição de marcações inválidas.
- Builds de shared/API, Prisma generate, TypeScript do app, ESLint e exportação web passaram.
- Chromium com API simulada: foto já enviada abre, recebe marca-texto vermelho, salva/reabre, apaga/desfaz, recebe pincel azul e cancela sem perder a edição anterior. Testado em 390 × 844 e 320 × 640. Salvamento enviou marcações via PATCH sem alterar ponto/legenda ou reenviar imagem.
- Foto pendente: seleção de arquivo, prévia antes do upload, pintura, reabertura e envio da imagem original com as marcações no mesmo multipart passaram.
- Desenho/observações: prévia do lápis, seleção de pincel, texto colorido, fechar/reabrir e salvar passaram.
- PDF real EVS com original e versão marcada lado a lado foi renderizado com PyMuPDF e inspecionado visualmente. Artefatos locais em `docs/verificacao/photo-paint-qa.pdf`, `photo-paint-pdf.png` e `photo-paint-editor.png` (ignorados pelo Git).
- Fluidez e gestos em aparelho físico ainda precisam de conferência no Expo Go/APK.

## Implantação

Atualizar API e app juntos. A migração `20261029000000_photo_annotations` adiciona a coluna opcional sem alterar arquivos ou dados existentes. O comando `npm run docker:production` já executa `db:deploy` no início do container. Em implantação sem Docker, executar `npm run db:deploy` antes de iniciar a API. API antiga não aceita as marcações nem as novas espessuras/pincéis. Nenhum APK foi gerado nem houve implantação na VPS nesta tarefa.
