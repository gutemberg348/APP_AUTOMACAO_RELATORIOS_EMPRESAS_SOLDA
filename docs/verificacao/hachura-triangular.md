# Hachura triangular e escolha das duas fotos

## Uso

No ponto vazio, **Selecionar as duas fotos** abre as opções de origem. **Galeria · selecionar as duas fotos** permite escolher o par, com ordem, vínculo ao ponto e progresso por arquivo. Os espaços individuais, câmera, arquivos, legendas, remoção e repetição no mesmo ponto continuam disponíveis.

No desenho, escolha **Hachura triangular** e toque nos três cantos. O terceiro canto não pode ficar na mesma linha dos anteriores. A forma acompanha o trecho escolhido; não depende de proporções fixas. **Cancelar hachura** abandona os cantos ainda não concluídos, e Desfazer retira o último canto.

Depois de inserir, arraste as bolinhas dos cantos para ajustar cada extremidade. O painel permite aumentar, diminuir, girar, espelhar, alterar o espaçamento e a inclinação dos riscos, além de ajustar as posições numericamente. Segurar no interior por 1 segundo permite mover o conjunto. Os controles Afinar e Engrossar também se aplicam à hachura.

As posições representam o espaço do desenho, sem escala física. Medidas reais como `4 × 2"` devem ser informadas com **Texto** ou **Cota**; a ferramenta não calcula medidas de tubulação.

## Implementação

A forma usa uma polilinha fechada com três vértices e configuração opcional de hachura. Os riscos são segmentos recortados nas bordas do triângulo, compartilhados pelo app e pelo PDF, sem dependência de padrões SVG. A forma e as propriedades são preservadas ao salvar.

Atualizar a API/shared antes de salvar desenhos com hachura na API online. Essa propriedade fica no JSON do desenho e não exige nova migração além das mudanças de fotos já preparadas.

## Conferência

- 17 testes de geometria/renderização passaram, incluindo recorte dos riscos, fechamento do triângulo, ajuste dos cantos e transformações.
- TypeScript e ESLint aprovados; exportação web, Android e iOS concluída.
- Navegador com API simulada: criação por três cantos, recusa de triângulo achatado, espaçamento/inclinação, tamanho, rotação, espelhamento, arraste dos cantos em viewport de celular e persistência de duas hachuras após salvar/reabrir.
- Fluxo das duas fotos reconferido: escolha em lote, repetição ao lado, bloqueio em outro ponto e preservação da imagem válida após falha parcial.
- Captura: `triangle-hatch-mobile.png`. Teste em aparelho físico não realizado.
