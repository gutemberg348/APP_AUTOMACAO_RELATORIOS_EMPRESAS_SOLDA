# Fluidez do pincel livre

- O início do traço aparece no primeiro movimento útil, sem esperar um quadro adicional. Os movimentos seguintes continuam limitados à frequência de atualização da tela.
- A prévia calcula somente os segmentos novos da curva. O cache é reiniciado ao limpar, trocar de traço ou compactar os pontos; a geometria continua igual à usada no salvamento e no PDF.
- A captura usa distância em pixels da tela, mantendo movimentos pequenos consistentes em diferentes níveis de zoom, sem encaixe na grade.
- A camada do desenho existente é memorizada. O lápis não cria uma segunda prévia no desenho principal nem pesquisa todos os objetos sobrepostos a cada início; essa pesquisa acontece quando é necessário selecionar.
- Desenho principal, observações e pintura sobre fotos compartilham a melhoria. Cor, espessura, transparência, borracha e histórico continuam disponíveis.

## Validação

32 testes de desenho e marcação de fotos passaram, incluindo equivalência entre caminho incremental e caminho salvo, compactação de traços longos e sensibilidade em quatro escalas de zoom. Build compartilhado, TypeScript do aplicativo, ESLint e formatação passaram.

Exportação web e teste no Chrome com viewport móvel passaram: oito traços curtos consecutivos, toque sem riscar, curva de 100 amostras sem alterar o SVG de fundo durante o movimento, desfazer, escrita nas observações, cores, fechar/reabrir e salvar. Foi usada somente uma API simulada; não houve teste em aparelho físico.

Microteste local: 200 atualizações de um traço de 1.000 pontos, com caminhos finais idênticos. Cálculo completo: 416,13 ms; incremental: 43,93 ms. Esses números medem somente a construção do caminho em JavaScript, não FPS nem latência em aparelho físico.

Não altera contratos da API ou o formato dos relatórios. A instalação do aplicativo precisa de novo APK; no Expo, basta recarregar após atualizar o código. As migrações de funcionalidades anteriores continuam independentes desta otimização.
