# Mover e girar elementos — 16/10/2026

Segure um elemento por 1 segundo e arraste para movê-lo, em qualquer ferramenta. Textos, símbolos, linhas, formas, cotas e marcações usam a mesma seleção por proximidade já existente. A ferramenta continua ativa depois do movimento, sem exigir o botão Selecionar. Ao soltar, os ajustes do elemento ficam disponíveis; a edição pode ser desfeita/refeita.

O gesto é cancelado se o usuário começar um arraste normal antes do tempo, usar dois dedos para zoom, trocar ferramenta/desenho, fechar a tela cheia ou sair do editor. A prévia do traço é descartada quando a pressão vira movimento de um elemento. Arrastes normais continuam desenhando.

O campo **Rotação do componente** agora modifica o símbolo que acabou de ser inserido, além de definir o ângulo das próximas inserções. Escolher outro componente encerra essa seleção. Nos ajustes de símbolos e textos, há botões para girar 15° à esquerda, 15° à direita e 90°, além do campo numérico. Ao segurar um elemento e soltar, esses controles aparecem sem trocar a ferramenta ativa.

## Verificação

- TypeScript e ESLint do editor passaram.
- Exportação Expo web, iOS e Android passou.
- Chrome/Playwright com API simulada: movimento por pressão de texto, símbolo, linha, forma e ponto, preservando a ferramenta Lápis; eventos reais de mouse e toque via CDP; rotação imediata do símbolo inserido; desfazer/refazer; desenho normal sobre elementos existentes; cancelamento por zoom com dois dedos.
- As verificações não alteraram dados na API online. Não houve build completo de novo APK nem teste em aparelho físico nesta etapa.

Captura local: [desenho no celular](drawing-hold-mobile.png).
