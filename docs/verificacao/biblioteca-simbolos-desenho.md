# Biblioteca de formas do desenho — 11/11/2026

Referências visuais: `01.pdf`, `02.pdf` e `03.pdf`, fornecidos pelo usuário. As três páginas foram renderizadas e conferidas antes de criar a geometria vetorial.

A ferramenta Símbolos oferece um seletor **Tipo de componente**. Os componentes anteriores ficam em Gerais. Foram acrescentadas 68 variações em 12 famílias: redução isométrica, cap isométrico, flange cego, sentido de fluxo isométrico, válvula globo, medidor de vazão, válvula esfera isométrica, válvula retenção, válvula borboleta, marca de solda, junta flangeada isométrica e terminação em laço. As diferentes orientações têm prévias individuais. A rotação e o tamanho continuam ajustáveis depois da inserção.

Os símbolos usam a mesma biblioteca compartilhada pelo app e pelo gerador de PDF. Os detalhes preenchidos, como centros das válvulas, acompanham a cor escolhida. A geometria de cada orientação também fornece os limites para seleção e transformação. Os códigos anteriores foram mantidos, sem migração de banco.

Validação: 104 testes de símbolos, seleção, estilo de traço e desenho passaram. Os testes novos cobrem os 68 códigos, salvamento/reabertura, cor, detalhes preenchidos, seleção e transformação. TypeScript dos três workspaces, ESLint e exportação web passaram. A biblioteca foi renderizada no Chromium e inspecionada visualmente em `artifacts/symbol-references/catalog.png`.

Não foi conferido em aparelho Android/iOS físico. É necessário atualizar a API/web e gerar outro APK, pois a validação dos códigos e a renderização usam o pacote compartilhado.
