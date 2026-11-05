# Seleção e fluidez do desenho

- Com outra ferramenta ativa, segurar um objeto por 1,2 segundo permite selecioná-lo. Selecionar continua imediato; imagens mantêm a pressão curta nessa ferramenta.
- Endireitar usa a camada isolada de tinta durante o gesto, sem redesenhar o formulário e todos os objetos a cada amostra. Ao soltar, mantém o ajuste da linha e o histórico.
- Movimentação e redimensionamento de objetos selecionados respondem a partir de 3 pixels de deslocamento. Os limites para começar um novo traço permanecem iguais.
- Arrastar um bloco reutiliza seu centro inicial, evitando recalcular seus limites em cada movimento.

Verificação: TypeScript e ESLint do app; 28 testes de gestos, seleção, traçado e ajustes; interface web em viewport móvel com pressão de 800 ms sem seleção, seleção após 1,2 segundo, início de linha sobre uma extremidade, rotação, escala, arraste, desfazer/refazer, zoom e mudança de orientação. Sem erros de execução nesses fluxos. A fluidez no aparelho físico ainda precisa ser conferida no novo APK.

Alteração no cliente; não exige atualização da API. O painel web precisa de nova publicação para receber os mesmos ajustes.
