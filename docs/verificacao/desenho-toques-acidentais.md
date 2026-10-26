# Desenho: toques e seleção automática — 25/10/2026

- Endireitar e ferramentas de desenho exigem um arrasto de pelo menos 6 pixels de tela. Toques isolados e pequenas tremidas não salvam traços; a tolerância não depende do zoom.
- O gesto registra quando o arrasto começou: um traço livre que volta ao início continua sendo salvo.
- Linhas, traços livres, cotas e pontos não ficam selecionados ao inserir. Símbolos, textos, círculos, retângulos e hachuras ficam selecionados para ajuste.
- Cada arrasto de linha/tubulação começa onde o dedo foi pressionado, mesmo se havia um início pendente de outro toque. A construção intencional por dois toques continua disponível.
- Prévia e amostras do gesto são limpas ao terminar ou iniciar outro gesto.

## Validação

- TypeScript do app, ESLint e exportação Expo web passaram.
- Teste no Chromium, 390 × 844, com API simulada: toque sem movimento, tremida de 2 pixels em dois níveis de zoom, arrastos consecutivos, traço livre fechado, seleção automática de círculo/retângulo, dois pontos consecutivos, arrasto de tubulação após início pendente, seleção por toque prolongado e salvamento passaram. Foram salvos exatamente os oito elementos intencionais.
- Regressão com eventos de toque via CDP: seleção, movimento, pinça com redimensionamento/rotação, desfazer/refazer, cancelamento, toque fora sem duplicar elementos, pan/zoom, orientação horizontal e salvamento passaram.
- Captura revisada: `drawing-intentional-strokes.png`.

Alteração no editor do app. Não houve teste em aparelho físico, geração de APK ou publicação na VPS.
