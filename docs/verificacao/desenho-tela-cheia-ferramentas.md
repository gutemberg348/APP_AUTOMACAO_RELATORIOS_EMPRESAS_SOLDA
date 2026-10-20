# Acesso à tela cheia e ferramentas do desenho

- O botão **Tela cheia** fica imediatamente acima do canvas, em toda a largura disponível.
- As barras de ferramentas e ações possuem setas fixas de 44 px nas laterais. Cada toque avança aproximadamente 80% da área visível.
- As setas ficam desabilitadas nos respectivos limites. Arrastar a barra continua funcionando.
- Os controles possuem nomes acessíveis distintos para ferramentas e ações.

## Verificação

- TypeScript do app e ESLint dos dois componentes: sem erros.
- Expo export para Android, iOS e web: concluído.
- Playwright com API simulada, em 390×844, 844×390 e 1440×1100: botão próximo ao canvas, rolagem nos dois sentidos, limites das setas, seleção de ferramenta e saída da tela cheia.
- Captura móvel inspecionada: `drawing-toolbar-mobile.png`.
- Não houve teste em aparelho físico nem publicação nesta verificação.
