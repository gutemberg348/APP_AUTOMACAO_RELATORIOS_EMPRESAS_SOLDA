# Teclado e barras do sistema

Revisão de 13/10/2026.

Os campos de texto passam por `Field` e `MaskedTextInput`. As páginas, o login e as janelas de seleção/formulário agora fornecem rolagem ao campo focado, repetida depois de mudanças no teclado e no tamanho da área disponível. Isso cobre empresas, obras, relatórios, pontos, responsáveis, pessoas, tutoriais, legendas, buscas e calendário.

No Android, a configuração do app pede `softwareKeyboardLayoutMode: resize`. Também há espaço adicional de rolagem quando a janela continua inteira atrás do teclado, como ocorreu no Expo Go durante o teste. As coordenadas da barra de status são consideradas para comparar o campo com a posição do teclado. Na web, a rolagem automática preserva o foco; no iOS, permanecem os ajustes de teclado do ScrollView e das janelas.

O menu inferior usa o recuo do sistema mais 8 dp de distância e fica oculto durante a digitação. As telas principais respeitam os recuos laterais em orientação horizontal. Em áreas baixas, cabeçalho e textos longos ficam mais compactos enquanto o usuário edita. O Android mantém a edição dentro do formulário, sem trocar para o editor de texto em tela cheia do teclado.

Conferências:

- Emulador Pixel 7, Android API 37, Expo Go 57.0.9, com API simulada: e-mail e senha do login; telefone, e-mail e observações da empresa; descrição da obra; identificação do relatório; telefone no cadastro de pessoas em janela.
- Os campos medidos ficaram acima do teclado. A senha passou a terminar em 1393 px, com teclado começando em 1428 px, no cenário que antes ficava coberto.
- Navegação por gestos: os botões do menu terminaram em 2316 px e a barra do sistema começou em 2337 px. Com três botões: 2253 px e 2274 px, respectivamente. Ambos mantiveram 21 px de distância, equivalentes a 8 dp na densidade do emulador.
- Orientação horizontal: texto longo permaneceu acima do teclado e o menu respeitou a barra lateral do sistema.
- Navegador: redução de área de 390 × 844 para 390 × 430 durante o foco, cobrindo login, máscaras, textos longos, relatório/data e formulário de pessoa em janela; menu oculto/restaurado, sem perda de foco ou transbordamento.
- Regressões no navegador: validações, preservação de dados após falha e ações somente na conclusão nos cinco modelos de relatório.
- Cinco testes existentes do cálculo de rolagem passaram. TypeScript, ESLint e exportações web, Android e iOS conferidos.

Capturas: [senha com teclado](android-login-keyboard.png), [campo da empresa](android-company-keyboard.png), [pessoa em janela](android-person-modal-keyboard.png), [menu por gestos](android-menu-gestures.png), [menu com três botões](android-menu-three-buttons.png), [teclado na horizontal](android-landscape-keyboard.png) e [menu na horizontal](android-landscape-menu.png).

Os cenários nativos foram executados em emulador. Não foi executado teste em iPhone físico. A API simulada bloqueou gravações de negócio; os cadastros reais não foram usados nos testes.

Referências: [teclado no Expo](https://docs.expo.dev/guides/keyboard-handling/) e [barras do sistema e áreas seguras](https://docs.expo.dev/develop/user-interface/system-bars/).
