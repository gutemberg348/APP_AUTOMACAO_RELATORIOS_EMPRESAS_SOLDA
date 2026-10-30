# Imagem recortada e resposta dos gestos

Problema relatado: depois de recortar, o contorno se deslocava sem a imagem; desenhar e arrastar ficava pesado.

## Correções

- A imagem usa coordenadas locais de um grupo único de translação/rotação. O recorte é um clipPath, sem outro viewport SVG dentro da imagem. App e PDF compartilham o cálculo do enquadramento; o arquivo original continua intacto.
- A tela usa um SVG externo com elementos memoizados. Fotos ficam em componentes Image nativos, com a fonte estável. Editar um elemento não serializa as fotos em XML nem recria os demais elementos; mudar o zoom atualiza o viewport externo.
- Contorno, alças, guias e laço ficam em uma camada leve separada da geometria.
- Movimentos de seleção/linha são agrupados por frame, preservando a última posição antes de soltar. Cancelar descarta o movimento pendente. O lápis mantém todas as amostras de entrada e a camada de tinta isolada já existente.
- O encaixe reaproveita a geometria de objetos imutáveis e procura os alvos em uma passada, mantendo prioridade e desempates anteriores. Os limites de uma seleção grande são calculados sem espalhar centenas de milhares de argumentos em Math.min/Math.max.
- O SVG completo para o conta-gotas só é criado ao abrir a ferramenta. Atualizações de um bloco usam mapa por ID para localizar seus elementos.

## Verificação

- Build shared/API e typecheck app passaram.
- 254 testes unitários em 43 arquivos passaram, incluindo recorte/movimento, fila por frame, encaixe equivalente e seleção com 720 mil amostras sem exceder o limite de argumentos do JavaScript.
- Lint dos arquivos envolvidos e diff check passaram.
- Export web e navegador com API simulada: recortar, cancelar, mover a imagem recortada durante o arrasto e após soltar, desfazer, preencher folha, marcar ponto, salvar/reabrir/restaurar e largura de 320 px passaram. A translação dos pixels foi comparada com a do contorno durante o gesto.
- Cenário com foto e 80 traços / 48 mil amostras: linha e lápis foram salvos sem recriar a imagem e sem alterar os nós dos traços existentes durante o movimento. Evidência local em `artifacts/drawing-performance-check.json`. Os tempos registrados são de Chrome desktop com viewport móvel, não um benchmark de celular físico.
- Os seis modelos de PDF foram gerados e conferidos por geometria/paginação; a página de desenho do EVS foi rasterizada e inspecionada visualmente. Evidências locais em `artifacts/drawing-crop-pdf/`.
- Não houve teste em aparelho físico, geração de APK ou publicação na VPS.

## Publicação

Atualizar a VPS com `npm run docker:production` depois do `git pull`: há mudanças no painel e no cálculo compartilhado com o PDF. Para APK instalado, gerar outro no computador com `npm run apk`. No Expo, recarregar o bundle atualizado. Relatórios existentes usam a nova renderização ao abrir e ao baixar o PDF novamente.
