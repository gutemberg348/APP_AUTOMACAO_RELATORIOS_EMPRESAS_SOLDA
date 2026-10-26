# Opções junto da seleção

26/10/2026 — ajuste de usabilidade do editor.

A chave aparece junto da seleção após soltar o dedo. Durante o gesto ela fica oculta. Abre um painel absoluto, limitado à área do desenho, sem alterar o tamanho ou a posição da folha. Cor, espessura, traço contínuo/pontilhado/tracejado e tamanho podem ser ajustados ali. Blocos aplicam o estilo aos elementos com traço; imagens e pontos preservam suas propriedades. Opções adicionais continuam acessíveis.

Validação no Chromium com API simulada, em 390 × 844 e 320 × 640:

- Chave ausente enquanto o dedo está pressionado e presente após soltar.
- Espessura, cor vermelha e pontilhado aplicados à linha selecionada.
- Área da folha idêntica antes e depois de selecionar, abrir o painel, editar e mover.
- Painel desaparece ao iniciar outro gesto e a chave retorna após soltar.
- Painel contido na área do desenho em tela estreita.
- Regressão do laço, quatro alças, exclusão contextual e desfazer passou.
- Nenhum salvamento nem chamada à API de produção durante a verificação.

TypeScript, ESLint dos arquivos alterados e exportação web passaram. A interação nativa em aparelho físico não foi executada nesta verificação.

## Ajuste fino de tamanho

Incluídos botões −/+ no painel inferior da seleção, em passos de 5% do tamanho atual. A porcentagem usa como referência o tamanho ao iniciar aquela seleção e acompanha a geometria real, incluindo alterações por gestos e limites de tamanho. Mover ou girar não altera a medida. O painel permanece flutuante e fica oculto durante gestos ou enquanto as opções contextuais estão abertas.

Teste de interação com API simulada passou: linha reduzida de 200 para 190 unidades, reduções consecutivas, aumento, rotação sem mudar a porcentagem, bloco do laço reduzido proporcionalmente e botões visíveis em 320 px sem mover a folha.
