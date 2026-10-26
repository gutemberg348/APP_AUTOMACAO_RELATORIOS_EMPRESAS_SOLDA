# Navegação e seleção — 26/10/2026

- Barra compacta dentro da tela cheia: Mover folha, Selecionar elementos, Enquadrar folha inteira e Desfazer última alteração, sem abrir a lista de ferramentas.
- Mão não ativa seleção por pressão prolongada. Segurar e arrastar sobre objetos move apenas a visualização.
- Enquadrar seleção aproxima o elemento ou bloco usando seus limites e centro comuns, sem modificar o desenho.
- Sobrepostos permite escolher explicitamente entre imagem, linha, texto, símbolo ou ponto encontrados no local tocado. Assim, o elemento de cima não impede selecionar o de baixo.
- Tolerância de seleção acompanha o zoom em pixels de tela. Pequenos movimentos menores que 6 px não deslocam elementos ou cantos de hachura; desfazer continua disponível para movimentos intencionais.
- Painel da seleção tem altura limitada e rolagem, e recolhe enquanto as ferramentas estão abertas. Instruções dos pontos explicam mover a marcação mantendo o vínculo.

## Validação

- TypeScript do app, ESLint e exportação web passaram.
- Chromium 390 × 844 e 844 × 390, API simulada: segurar sobre linha em Mão, navegar, escolher sobrepostos, enquadrar seleção, arrastar e desfazer, tocar fora para desmarcar e verificar que nenhuma alteração pendente é criada só pela navegação.
- Regressão de desenho: toques e tremores não criam linhas, arrastar cria trechos independentes, lápis mantém laços fechados, figuras selecionam ao inserir, pontos permanecem sem seleção automática e pressão prolongada continua disponível no lápis.
- Capturas revisadas: drawing-navigation-mobile.png e drawing-navigation-landscape.png.
- Alterações desta rodada são apenas no app, sem mudança de contrato da API. Sem teste em aparelho físico ou APK gerado.
