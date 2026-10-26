# Seleção e tamanho no desenho — 20/10/2026

- Durante o ajuste, tocar em outro elemento troca a seleção; tocar no vazio apenas desmarca. Esse gesto não passa para a ferramenta de inserção.
- Concluir o ajuste, excluir o selecionado ou desfazer um ajuste deixa a ferramenta Selecionar ativa. Escolher explicitamente outra ferramenta retoma a inserção ou o desenho.
- Segurar por 350 ms seleciona em qualquer ferramenta, com tolerância ao pequeno movimento do dedo e solicitação de vibração.
- Botões de diminuir/aumentar ficam junto à seleção. Símbolos e textos respeitam os limites de tamanho do formato salvo, com botões desabilitados nos limites. Linhas e formas mudam proporcionalmente, preservando espessuras e textos de medidas; pontos preservam numeração e vínculo.
- Com o primeiro dedo sobre o selecionado, dois dedos permitem redimensionar, girar e mover em uma única operação de desfazer. Iniciar no vazio mantém o pan/zoom da página.
- Retirado o aviso redundante após inserir texto, que cobria a superfície e interceptava toques.
- Controles compactados em telas largas e cabeçalho reduzido na horizontal.

## Verificação

- Build do pacote compartilhado, TypeScript do app e ESLint passaram.
- 134 testes unitários passaram, incluindo limites de tamanho, transformação proporcional, imutabilidade, formas fechadas e preservação dos vínculos.
- Exportação Expo para Android, iOS e web passou; após o ajuste final de espaçamento, exportação web e verificações estáticas passaram novamente.
- Chromium com toque via CDP, tela 390 × 844 e API simulada: seleção por toque prolongado, troca de seleção, reduzir/ampliar, pinça com redução pela metade e rotação de 90°, desfazer/refazer, toque fora sem duplicar símbolo/texto, desenho com lápis, arraste, cancelamento do gesto, pan/zoom no vazio e salvamento passaram. Conferida também área do desenho na horizontal em 844 × 390.
- Captura revisada: `drawing-selection-resize-mobile.png`.

Não houve teste em aparelho físico nem publicação na VPS ou geração de APK.

## Correção do contorno deslocado — 20/10/2026

- O contorno agora é um caminho com quatro cantos calculados nas coordenadas da página, incluindo a rotação. Isso elimina a combinação de posição `x/y` do retângulo com uma transformação SVG separada, que podia deslocar o contorno no renderizador nativo.
- O mesmo cálculo atende símbolos e textos e acompanha a geometria provisória durante os gestos.
- 136 testes unitários passaram. Os novos casos conferem centro e dimensões em cinco rotações e três escalas, após translação, além dos cantos do texto girado.
- TypeScript, ESLint, build compartilhado e exportação web passaram.
- Teste do editor com toque simulado e API simulada passou, incluindo comparação do centro do contorno com a origem visual do símbolo antes e depois da pinça com rotação. Captura revisada: `drawing-selection-frame-aligned.png`.
- A confirmação final no aparelho físico continua pendente; não foi gerado APK.
