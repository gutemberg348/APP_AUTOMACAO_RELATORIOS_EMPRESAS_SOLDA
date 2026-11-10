# Seleção e fluidez do desenho

- Com outra ferramenta ativa, segurar um objeto por 1,2 segundo permite selecioná-lo. Selecionar continua imediato; imagens mantêm a pressão curta nessa ferramenta.
- Endireitar usa a camada isolada de tinta durante o gesto, sem redesenhar o formulário e todos os objetos a cada amostra. Ao soltar, mantém o ajuste da linha e o histórico.
- Movimentação e redimensionamento de objetos selecionados respondem a partir de 3 pixels de deslocamento. Os limites para começar um novo traço permanecem iguais.
- Arrastar um bloco reutiliza seu centro inicial, evitando recalcular seus limites em cada movimento.

Verificação: TypeScript e ESLint do app; 28 testes de gestos, seleção, traçado e ajustes; interface web em viewport móvel com pressão de 800 ms sem seleção, seleção após 1,2 segundo, início de linha sobre uma extremidade, rotação, escala, arraste, desfazer/refazer, zoom e mudança de orientação. Sem erros de execução nesses fluxos. A fluidez no aparelho físico ainda precisa ser conferida no novo APK.

Alteração no cliente; não exige atualização da API. O painel web precisa de nova publicação para receber os mesmos ajustes.

## Pressão longa com lápis em tablets

- A sensibilidade de 0,35 pixel do lápis estava cancelando a pressão longa diante da menor oscilação. A tentativa de selecionar agora tem tolerância própria de 10 pixels de tela, independente da sensibilidade do traço livre.
- Enquanto a pressão pode se tornar uma seleção, os pontos iniciais ficam em memória sem pintar. Um arraste maior inicia o traço com essas amostras; a seleção acontece após 1,2 segundo mesmo com pequena oscilação.
- A movimentação começa a partir da posição no momento da seleção, evitando deslocar o objeto ou grupo com a oscilação anterior. Uma pressão incompleta e pausada não deixa um risco. Traços rápidos e pequenos do lápis continuam disponíveis sobre objetos e fotos.
- Verificação desta correção: TypeScript, ESLint, exportação web e 28 testes de seleção, traçado e ajustes. Interações no navegador em 390 × 844 e 1024 × 768: eventos de toque com oscilação até 8 pixels, movimentos subpixel, pressão incompleta, traços curtos e longos, seleção seguida de arraste e ausência de tinta extra. Também conferidos rotação, escala, enquadramento, desfazer/refazer, zoom e orientação. Os testes usam emulação de interação; a confirmação em tablet físico depende de instalar o novo APK.
