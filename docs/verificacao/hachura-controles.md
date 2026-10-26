# Hachura: densidade e controles — 26/10/2026

- Novas hachuras usam espaçamento 8 (antes 18) e contorno 1,2, com linhas internas de 0,54. Hachuras existentes preservam suas configurações.
- Controles contextuais junto à seleção: Vertical, Horizontal, duas diagonais, engrossar/afinar e aproximar/afastar traços. Também ficam disponíveis durante a criação. A inclinação numérica continua no painel de ajustes.
- Espessura usa o campo já existente `strokeWidth`; altera contorno e preenchimento proporcionalmente. Espaçamento e direção também usam os campos existentes, sem migração ou alteração de contrato da API.
- Controles rápidos lembram a última configuração para a próxima hachura nesta sessão do editor.
- Cantos provisórios são círculos de raio 3, sem números, exclusivamente na prévia. Os cantos de ajuste usam raio 4, mantendo a área de toque maior para facilitar o arraste.
- Ao marcar os três cantos, a figura fica selecionada e o painel grande não abre automaticamente. A instrução de próximo canto fica fora da superfície do desenho.

## Validação

- Build compartilhado, TypeScript do app, ESLint e exportação web passaram.
- 137 testes unitários passaram, incluindo densidade, direção, espessura e marcadores exclusivos de prévia.
- Chromium em 390 × 844, com API simulada: criação pelos três cantos, alteração imediata de direção/espessura/espaçamento, limite mínimo, desfazer, seleção, cancelamento de construção e salvamento validado pelo schema passaram.
- Captura revisada: `hatch-quick-controls.png`. Não houve teste em aparelho físico, geração de APK ou publicação na VPS.
