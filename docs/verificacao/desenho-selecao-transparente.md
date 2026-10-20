# Seleção e posicionamento

- Ao selecionar ou segurar um elemento para mover, ele fica com 50% de visibilidade e contorno azul tracejado. O contorno acompanha a posição, o tamanho e a rotação de textos e símbolos.
- Em **Ajustar selecionado**, a visibilidade pode ser definida em 25%, 50%, 75% ou 100%. O passo dos botões de movimento pode variar de 1 a 100 unidades do desenho.
- As ações da seleção aparecem primeiro na barra. **Concluir ajuste** remove a seleção e fecha o painel.
- Contornos e transparência são opções da visualização, não dados persistidos do desenho. O PDF mantém a aparência normal.

Verificação: 130 testes unitários passaram, incluindo seleção de linha, texto, símbolo, ponto, marcação, cota e hachura sem alterar o resultado normal da exportação. TypeScript, ESLint e exportações Expo Android/iOS/web passaram. No navegador em 390×844, com API simulada, foram verificados segurar/mover, contorno durante o arraste, transparência ajustável, deslocamento de uma unidade, rotação, concluir e salvar sem persistir os efeitos de seleção. Captura `drawing-selection-mobile.png` inspecionada. Sem teste em aparelho físico ou publicação.
