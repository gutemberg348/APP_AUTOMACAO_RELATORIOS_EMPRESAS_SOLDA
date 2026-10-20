# Desenho: gestos e ferramentas — 19/10/2026

- Ferramentas em duas linhas roláveis, começando por Endireitar, Tubulação, Lápis, Selecionar, Ponto, Símbolos e Texto. Limpar traços, desenho e pontos aparecem antes das outras ações.
- Tela cheia abre com ferramentas recolhidas; o botão com seta abre a paleta. Escolher uma ferramenta recolhe a paleta. Os ajustes ficam disponíveis por comando explícito, sem abrir depois de cada movimento.
- O enquadramento inicial em tela cheia preenche o espaço disponível com a página; o comando Ajustar mostra a página inteira. Pan e zoom continuam disponíveis para acessar as outras partes.
- Símbolos e textos ficam selecionados após a inserção. A seleção mantém a transparência e o contorno e pode ser arrastada imediatamente, sem mudar para Selecionar.
- Segurar por 450 ms sobre um elemento, em qualquer ferramenta, seleciona o elemento, cancela o traço provisório e solicita vibração. Pequenos movimentos de até 10 px não cancelam o reconhecimento.
- Com o primeiro dedo sobre o selecionado, o segundo dedo permite girar e mover. Iniciar no espaço vazio mantém pan/zoom da página. Um gesto equivale a uma operação de desfazer. Interromper o gesto descarta a prévia.
- A rotação preserva texto, dimensões, espessura, fechamento das formas e vínculos dos pontos. Os números dos pontos permanecem legíveis; gestos movem sua posição sem girar o número.

## Validação

- TypeScript do app e ESLint dos arquivos alterados: passaram.
- 132 testes unitários: passaram, incluindo rotação/translação, limites da página e preservação dos vínculos.
- Exportação Expo para web, Android e iOS: passou.
- Chromium com eventos de toque via CDP e API simulada: passaram seleção em 550 ms de espera, movimento sem traço acidental, rotação de 90° com dois dedos, desfazer/refazer, seleção automática de texto e símbolo, desenho normal com lápis, pan/zoom no espaço vazio e salvamento.
- Revisão visual de capturas em 390 × 844 e 844 × 390. Área do desenho acima de 650 px na tela vertical simulada com ferramentas recolhidas e sem seleção. O tamanho real varia com a área segura e as barras do aparelho.
- Capturas: `drawing-tools-two-rows.png`, `drawing-gestures-mobile.png`, `drawing-gestures-landscape.png`.

Não houve teste de vibração em aparelho físico. Não foi gerado APK nem feita publicação na VPS.
