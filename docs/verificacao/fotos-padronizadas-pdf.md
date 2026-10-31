# Fotos padronizadas no PDF - 30/10/2026

Os seis tipos ativos (EVS, EVD, LP, TH, ME e RDO) usam quadros de evidência em 4:3, com duas colunas de largura igual. O quadro tem aproximadamente 94,5 x 70,9 mm na área útil atual do A4. Uma foto isolada mantém a largura da coluna; no RDO ela não se expande mais para a página inteira.

Conforme a escolha posterior do usuário, o enquadramento agora usa `object-fit: fill`: a imagem inteira é redimensionada nos dois eixos para preencher o quadro até a borda, sem corte. A proporção original pode mudar, especialmente em fotos verticais ou muito largas. Faixas já existentes dentro do arquivo original continuam fazendo parte da imagem. A altura do quadro não depende do tamanho original da foto. O desenho/croqui não foi alterado.

As linhas de fotos agora calculam sua altura pelo quadro, em vez de comprimir as imagens para caber em uma altura fixa. A paginação existente transfere os blocos para a próxima folha quando necessário. Legendas, pontos, resultados e leituras continuam associados às fotos.

## Verificação

- Build da API e ESLint dos templates aprovados.
- 31 testes existentes de desenhos, imagens e correções de PDF aprovados.
- Chrome em modo de impressão: quatro proporções de imagem, nove fotos por relatório e cenário de foto única, em todos os cinco tipos. Conferidos quadros de dimensões iguais em 4:3, todas as evidências presentes e blocos dentro da página após paginação.
- A validação anterior com `contain` preservava proporções e podia deixar faixas. A regra posterior `fill` mantém as quatro extremidades e preenche o quadro, aceitando alteração de proporção conforme solicitado.
- Arquivos de conferência locais em `artifacts/photo-frames/`. Nenhuma publicação ou alteração de dados de produção foi realizada.

Validação da mudança para preenchimento: build da API e conferência no Chromium dos seis tipos passaram, com fotos de quatro proporções, pares e foto isolada. Os quadros mantêm 4:3 e `object-fit: fill`, todas as imagens permanecem presentes e a paginação fica dentro da folha. PDFs gerados em `artifacts/photo-frames-fill/`; página de fotos ME rasterizada e inspecionada, com marcas nas quatro extremidades visíveis e sem faixas acrescentadas pelo enquadramento.

## Preenchimento aplicado aos pixels e teste de salvamento

A API agora redimensiona a cópia exportada de cada foto de evidência para 1200 × 900, JPEG qualidade 90, após aplicar as marcações. O formato 4:3 fica no arquivo incorporado ao PDF, além do CSS. Fotografias verticais são esticadas sem recorte; originais, hashes e dados guardados continuam intactos. Essa preparação não se aplica às imagens do desenho: elas mantêm seu próprio enquadramento/recorte. Fotos com orientação EXIF são orientadas no processamento, e transparência é composta em branco no upload/exportação. O processamento das marcações limita os dois eixos a 2000 px para evitar bitmaps excessivamente altos em fotos estreitas.

Falhas de salvamento com detalhes de validação agora mostram qual campo da foto foi recusado (marcações, legenda ou vínculo), em vez de repetir somente “Confira os campos informados”. O botão Corrigir conserva a localização do ponto/foto e apresenta orientação para arquivo inválido, envio recusado ou marcações inválidas. Fotos pendentes continuam na fila para correção; as já enviadas são preservadas.

Validação: build shared/API, typecheck app, lint e 289 testes unitários passaram. Novo teste real `report-photos-all-types.test.ts`: seis casos, EVS/EVD/LP/TH/ME/RDO, com foto vertical, segunda cópia no mesmo ponto, arquivo inválido recusado e corrigido, foto com EXIF, edição de legenda/marcações, recusa de marcação inválida sem perder a anterior, leitura do arquivo original e geração de PDF. Os seis passaram em PostgreSQL isolado com Chromium. Também foram gerados seis PDFs com fotos de quatro proporções, pintadas, pares e foto única; dimensões incorporadas de 1200 × 900 e paginação conferidas. O PDF EVD foi rasterizado e inspecionado: foto vertical ocupa o quadro inteiro, com os quatro cantos preservados. Evidências em `artifacts/photo-frames-raster-fill/`.

Esses testes não reproduziram uma falha geral em todas as fotos. A mensagem exata e a versão do APK do usuário ainda são necessárias para identificar a falha específica relatada. Não houve deploy nem teste em aparelho físico nesta etapa.

Publicação: API/painel via `npm run docker:production` após enviar as alterações e executar `git pull`. Gerar/instalar novo APK para a orientação detalhada dos erros e a correção anterior de repetição por obra. O preenchimento das fotos no PDF depende da API atualizada e de baixar novamente, inclusive para relatórios antigos.

## Foto pequena recusada com aviso de 10 MB

Reproduzido antes da correção: JPEG de celular com 8000 × 6000 (48 MP), menor que 1 MB, recebia `INVALID_IMAGE` e mensagem sobre 10 MB. A causa era o limite de 40 milhões de pixels da leitura do Sharp, não o tamanho do arquivo.

A API inspeciona o cabeçalho sem decodificar e aceita até 128 MP, reduzindo para no máximo 2400 × 2400 antes de guardar. A proteção contra arquivos maiores que 10 MB continua. Resolução acima do limite, formato não aceito e conteúdo ilegível têm mensagens distintas. O handler multipart só menciona tamanho quando o erro é realmente `LIMIT_FILE_SIZE`; problemas de campo/formulário/marcações recebem outros códigos. O limite de assinatura de 5 MB também é preservado em sua mensagem. O fallback de orientação no app deixou de recomendar imagem de 10 MB para qualquer falha.

Regressão: o teste falhou com status 400 antes da correção e passou com status 201 depois, verificando a imagem guardada em 2400 × 1800. Testes de formulário real verificaram arquivo no campo errado, marcações maiores que o limite, arquivo acima de 10 MB, arquivo quebrado e formato não aceito. Cada um recebe motivo específico. A integração EVD envia e marca uma foto vertical de 48 MP, salva legenda, lê as dimensões reduzidas e gera o PDF. Os seis tipos passaram novamente. Resultado final desta etapa: build shared/API, typecheck app, lint, 299 testes unitários e seis testes de integração aprovados. Não houve teste no aparelho do usuário nem deploy.

## Publicação

A alteração é no gerador de PDF da API e requer atualizar os containers da VPS. Não exige migração de banco nem novo APK para modificar os PDFs gerados pelo servidor. PDFs que já foram baixados não mudam; gere uma nova prévia para ver o layout atualizado.
