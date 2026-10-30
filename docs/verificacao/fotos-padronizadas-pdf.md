# Fotos padronizadas no PDF - 30/10/2026

Os cinco templates ativos (EVS, LP, TH, ME e RDO) usam quadros de evidência em 4:3, com duas colunas de largura igual. O quadro tem aproximadamente 94,5 x 70,9 mm na área útil atual do A4. Uma foto isolada mantém a largura da coluna; no RDO ela não se expande mais para a página inteira.

O enquadramento usa a imagem inteira, centralizada e com proporção preservada. Fotografias verticais, quadradas ou muito largas podem ter faixas brancas no quadro. A altura do quadro não depende do tamanho original da foto. O desenho/croqui não foi alterado.

As linhas de fotos agora calculam sua altura pelo quadro, em vez de comprimir as imagens para caber em uma altura fixa. A paginação existente transfere os blocos para a próxima folha quando necessário. Legendas, pontos, resultados e leituras continuam associados às fotos.

## Verificação

- Build da API e ESLint dos templates aprovados.
- 31 testes existentes de desenhos, imagens e correções de PDF aprovados.
- Chrome em modo de impressão: quatro proporções de imagem, nove fotos por relatório e cenário de foto única, em todos os cinco tipos. Conferidos quadros de dimensões iguais em 4:3, todas as evidências presentes e blocos dentro da página após paginação.
- PDFs reais gerados com Chromium, rasterizados com PyMuPDF e inspecionados visualmente nos cinco tipos. As marcas nas quatro extremidades das imagens de teste ficam visíveis, sem cortes ou deformação.
- Arquivos de conferência locais em `artifacts/photo-frames/`. Nenhuma publicação ou alteração de dados de produção foi realizada.

## Publicação

A alteração é no gerador de PDF da API e requer atualizar os containers da VPS. Não exige migração de banco nem novo APK para modificar os PDFs gerados pelo servidor. PDFs que já foram baixados não mudam; gere uma nova prévia para ver o layout atualizado.
