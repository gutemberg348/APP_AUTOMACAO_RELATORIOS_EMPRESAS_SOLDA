# Alinhamento dos relatórios recentes

A etiqueta aninhada no seletor usava `alignSelf: flex-start`, posicionando o texto acima da seta. O seletor agora tem um único fundo por situação, com ponto, texto e seta centralizados e alturas de linha explícitas. O texto nativo usa `includeFontPadding: false` e `textAlignVertical: center`.

No resumo recente, as linhas têm mínimo de 82 px, títulos/subtítulos com alturas de linha de 18/16 px, espaçamento regular, ícone centralizado e seletor de 126 px de largura com área de toque de 44 px. Enquanto salva, o indicador ocupa a posição da seta e o nome do status permanece visível, mantendo a altura da linha. Nos cartões e na tabela, o seletor tem largura explícita de 150 px, evitando o encolhimento do texto no layout nativo.

Typecheck e lint passaram, assim como exports Expo web, iOS e Android. A conferência no navegador em tema escuro mediu seis linhas e verificou os centros verticais de texto, ponto, seta, grupo do nome e controle; a diferença foi inferior a 1,5 px. Larguras de 320, 390, 768 e 1440 px não tiveram transbordamento. O seletor continua abrindo sem navegar para detalhes. Captura: `recent-reports-aligned-dark.png`. A conferência física no iOS/Android segue pendente.

Nenhuma API, banco ou processo Expo do usuário foi alterado nesta correção visual.
