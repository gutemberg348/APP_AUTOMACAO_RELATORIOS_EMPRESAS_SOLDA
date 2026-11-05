# Três duplas de fotos por folha

Alteração de 05/11/2026 nos PDFs de EVS, EVD, LP, TH, ME e RDO.

A paginação limita cada folha a três duplas (seis fotos). A altura dos quadros é calculada pelo espaço disponível, descontando os cabeçalhos e informações reais. Os quadros de uma mesma sequência mantêm dimensões iguais, inclusive quando sobra uma única foto na última dupla. As imagens continuam preenchendo todo o quadro, sem recorte.

Quando uma foto tem menos campos acima que sua vizinha, um espaçamento alinha o início das imagens. Isso não cria linhas de informação vazias. No LP, continua valendo a regra de não imprimir faixas de texto abaixo das fotos.

Leituras de espessura e legendas longas são preservadas. A paginação pode usar menos duplas e criar continuação quando esses dados exigirem espaço; não reduz a foto abaixo de 35 mm de altura nem elimina informações para forçar seis fotos.

Verificação realizada:

- Build da API, lint e 64 testes existentes de layout, leituras, correções e observações internas.
- Chromium com os seis modelos e cenários de 12, 7, 6 e 1 foto: até três duplas por folha, todas as imagens preservadas, quadros iguais, imagens alinhadas e nenhum bloco ultrapassando a página.
- Cenários com 36 leituras de fotos de ME e legendas extensas de TH/EVS: dados e fotos preservados em continuações.
- Seis PDFs gerados e suas páginas de fotos renderizadas com PyMuPDF para inspeção visual. Evidência de teste em `artifacts/photo-three-pairs/` (ignorada pelo Git).

O ajuste é da API. Depois da publicação, basta gerar ou baixar novamente o PDF do relatório existente; os cadastros e fotos não precisam ser refeitos. Não há nova migração de banco nem mudança adicional de APK para esta alteração de layout.
