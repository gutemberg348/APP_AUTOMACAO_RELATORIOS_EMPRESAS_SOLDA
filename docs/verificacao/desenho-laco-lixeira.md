# Laço, redimensionamento e lixeira

Verificado em 26/10/2026 no Chromium, com API simulada e telas de 390 × 844 e 320 × 640. Nenhuma alteração enviada à API de produção.

- Atalho de laço ao lado da lixeira na barra flutuante, sem abrir o menu de ferramentas.
- Seleção por um laço desenhado em torno de duas linhas e um ponto, deixando a imagem maior fora da seleção.
- Quatro alças nos cantos do bloco. Arrastar uma delas reduz o conjunto proporcionalmente sem deslocar a área do desenho.
- Lixeira com seleção exclui diretamente os objetos selecionados. Sem seleção, abre as opções de limpeza.
- Desfazer restaura o tamanho e os objetos excluídos. Os registros de inspeção e suas fotos são preservados pela exclusão de objetos do desenho.
- Barra cabe em 320 px e o atalho do laço mantém área de toque de pelo menos 44 px.
- Após desfazer as alterações, o relatório permanece sem alterações pendentes e sem chamadas de salvamento.

TypeScript do app, ESLint dos arquivos de desenho, build do pacote compartilhado e exportação web passaram. A suíte geral passou com 159 testes em 27 arquivos. Gestos nativos em aparelho físico ainda precisam de conferência no Expo Go/APK.
